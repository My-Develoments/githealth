import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import { newDb } from "pg-mem";
import type {
  AuthSessionRecord,
  GitHubOAuthPendingStateRecord,
  GitHubOAuthStateRecord,
  UserRecord,
  WorkspaceGitHubConnectionRecord,
  WorkspaceGitHubOAuthConnectionRecord,
  WorkspaceRecord
} from "../../domain/auth/types.js";
import type { AuthStore, CreateUserWorkspaceSessionInput, PersistedAuthContext, PersistedUserWorkspaceContext } from "./authStore.js";
import { getDatabaseConfig } from "../persistence/databaseConfig.js";

type Queryable = {
  query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
};

type PoolLike = Queryable & {
  connect(): Promise<PoolClientLike>;
  end?: () => Promise<void>;
};

type PoolClientLike = Queryable & {
  release(): void;
};

const AUTH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  default_workspace_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_workspace_id ON auth_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS workspace_github_connections (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  organization TEXT NOT NULL,
  installation_id TEXT NOT NULL UNIQUE,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_github_oauth_connections (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  github_user_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  access_token_tag TEXT NOT NULL,
  scopes TEXT NOT NULL,
  selected_organization TEXT,
  organization_options TEXT,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE workspace_github_oauth_connections
ADD COLUMN IF NOT EXISTS organization_options TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_github_oauth_connections_github_user_id
ON workspace_github_oauth_connections(github_user_id);

CREATE TABLE IF NOT EXISTS github_oauth_states (
  state_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_github_oauth_states_expires_at ON github_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS github_oauth_pending_states (
  state_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_github_oauth_pending_states_expires_at ON github_oauth_pending_states(expires_at);
`;

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  default_workspace_id: string;
  created_at: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

type AuthSessionRow = {
  id: string;
  token_hash: string;
  user_id: string;
  workspace_id: string;
  created_at: string;
  expires_at: string;
};

type WorkspaceGitHubConnectionRow = {
  workspace_id: string;
  provider: "app";
  organization: string;
  installation_id: number | string;
  connected_at: string;
  updated_at: string;
};

type WorkspaceGitHubOAuthConnectionRow = {
  workspace_id: string;
  user_id: string;
  github_user_id: string;
  github_login: string;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  scopes: string;
  selected_organization: string | null;
  organization_options: string | null;
  connected_at: string;
  updated_at: string;
};

type GitHubOAuthStateRow = {
  state_hash: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
};

type GitHubOAuthPendingStateRow = {
  state_hash: string;
  created_at: string;
  expires_at: string;
};

type PersistedAuthContextRow = {
  session_id: string;
  session_token_hash: string;
  session_user_id: string;
  session_workspace_id: string;
  session_created_at: string;
  session_expires_at: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  user_password_hash: string;
  user_default_workspace_id: string;
  user_created_at: string;
  workspace_id: string;
  workspace_name: string;
  workspace_owner_user_id: string;
  workspace_created_at: string;
};

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    defaultWorkspaceId: row.default_workspace_id,
    createdAt: row.created_at
  };
}

function mapWorkspaceRow(row: WorkspaceRow): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at
  };
}

function mapSessionRow(row: AuthSessionRow): AuthSessionRecord {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function mapWorkspaceGitHubConnectionRow(row: WorkspaceGitHubConnectionRow): WorkspaceGitHubConnectionRecord {
  return {
    workspaceId: row.workspace_id,
    provider: row.provider,
    organization: row.organization,
    installationId: typeof row.installation_id === "number" ? row.installation_id : Number(row.installation_id),
    connectedAt: row.connected_at,
    updatedAt: row.updated_at
  };
}

function mapWorkspaceGitHubOAuthConnectionRow(
  row: WorkspaceGitHubOAuthConnectionRow
): WorkspaceGitHubOAuthConnectionRecord {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    githubUserId: row.github_user_id,
    githubLogin: row.github_login,
    accessTokenCiphertext: row.access_token_ciphertext,
    accessTokenIv: row.access_token_iv,
    accessTokenTag: row.access_token_tag,
    scopes: row.scopes
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0),
    selectedOrganization: row.selected_organization ?? undefined,
    organizationOptions: row.organization_options
      ? row.organization_options
          .split(",")
          .map((organization) => organization.trim())
          .filter((organization) => organization.length > 0)
      : undefined,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at
  };
}

function mapGitHubOAuthStateRow(row: GitHubOAuthStateRow): GitHubOAuthStateRecord {
  return {
    stateHash: row.state_hash,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function mapGitHubOAuthPendingStateRow(row: GitHubOAuthPendingStateRow): GitHubOAuthPendingStateRecord {
  return {
    stateHash: row.state_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function createRuntimePool(): Pool {
  const config = getDatabaseConfig();
  const poolConfig: PoolConfig = {
    connectionString: config.connectionString
  };

  if (config.sslMode === "require") {
    poolConfig.ssl = {
      rejectUnauthorized: true
    };
  }

  return new Pool(poolConfig);
}

async function withTransaction<T>(pool: PoolLike, run: (client: PoolClientLike) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

function createStoreError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

export function createPostgresAuthStore(
  pool: PoolLike = createRuntimePool(),
  options?: { initializeSchema?: () => Promise<void> }
): AuthStore {
  let initializePromise: Promise<void> | undefined;

  async function initialize(): Promise<void> {
    if (!initializePromise) {
      initializePromise = options?.initializeSchema
        ? options.initializeSchema()
        : pool.query(AUTH_SCHEMA_SQL).then(() => undefined);

      initializePromise = initializePromise.catch(() => {
        throw new Error(
          "Failed to initialize PostgreSQL auth persistence. Verify DATABASE_URL, DATABASE_SSL_MODE, and database permissions."
        );
      });
    }

    return initializePromise;
  }

  return {
    async initialize() {
      await initialize();
    },
    async createUserWorkspaceSession(input: CreateUserWorkspaceSessionInput): Promise<void> {
      await initialize();

      if (input.workspace.ownerUserId !== input.user.id) {
        throw createStoreError("Workspace owner must match user id for signup transaction.", "23503");
      }

      if (input.user.defaultWorkspaceId !== input.workspace.id) {
        throw createStoreError("User default workspace must reference the created workspace.", "23503");
      }

      if (input.session.userId !== input.user.id || input.session.workspaceId !== input.workspace.id) {
        throw createStoreError("Session must reference the created user and workspace.", "23503");
      }

      await withTransaction(pool, async (client) => {
        try {
          await client.query(
            `INSERT INTO app_users (id, email, display_name, password_hash, default_workspace_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [input.user.id, input.user.email, input.user.displayName, input.user.passwordHash, input.user.defaultWorkspaceId, input.user.createdAt]
          );
          await client.query(
            `INSERT INTO workspaces (id, name, owner_user_id, created_at)
             VALUES ($1, $2, $3, $4)`,
            [input.workspace.id, input.workspace.name, input.workspace.ownerUserId, input.workspace.createdAt]
          );
          await client.query(
            `INSERT INTO auth_sessions (id, token_hash, user_id, workspace_id, created_at, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [input.session.id, input.session.tokenHash, input.session.userId, input.session.workspaceId, input.session.createdAt, input.session.expiresAt]
          );
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw error;
          }

          throw error;
        }
      });
    },
    async findUserByEmail(email: string): Promise<UserRecord | undefined> {
      await initialize();
      const result = await pool.query<UserRow>(
        `SELECT id, email, display_name, password_hash, default_workspace_id, created_at
         FROM app_users
         WHERE email = $1`,
        [email.trim().toLowerCase()]
      );
      return result.rows[0] ? mapUserRow(result.rows[0]) : undefined;
    },
    async findUserById(userId: string): Promise<UserRecord | undefined> {
      await initialize();
      const result = await pool.query<UserRow>(
        `SELECT id, email, display_name, password_hash, default_workspace_id, created_at
         FROM app_users
         WHERE id = $1`,
        [userId]
      );
      return result.rows[0] ? mapUserRow(result.rows[0]) : undefined;
    },
    async findWorkspaceById(workspaceId: string): Promise<WorkspaceRecord | undefined> {
      await initialize();
      const result = await pool.query<WorkspaceRow>(
        `SELECT id, name, owner_user_id, created_at
         FROM workspaces
         WHERE id = $1`,
        [workspaceId]
      );
      return result.rows[0] ? mapWorkspaceRow(result.rows[0]) : undefined;
    },
    async createSession(session: AuthSessionRecord): Promise<void> {
      await initialize();
      await withTransaction(pool, async (client) => {
        const ownership = await client.query<{ owner_user_id: string }>(
          `SELECT owner_user_id
           FROM workspaces
           WHERE id = $1`,
          [session.workspaceId]
        );

        if (!ownership.rows[0]) {
          throw createStoreError("Workspace was not found for session creation.", "23503");
        }

        if (ownership.rows[0].owner_user_id !== session.userId) {
          throw createStoreError("Session user does not own the target workspace.", "23503");
        }

        await client.query(
          `INSERT INTO auth_sessions (id, token_hash, user_id, workspace_id, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [session.id, session.tokenHash, session.userId, session.workspaceId, session.createdAt, session.expiresAt]
        );
      });
    },
    async findPersistedAuthContextByTokenHash(tokenHash: string): Promise<PersistedAuthContext | undefined> {
      await initialize();
      const result = await pool.query<PersistedAuthContextRow>(
        `SELECT
           s.id AS session_id,
           s.token_hash AS session_token_hash,
           s.user_id AS session_user_id,
           s.workspace_id AS session_workspace_id,
           s.created_at AS session_created_at,
           s.expires_at AS session_expires_at,
           u.id AS user_id,
           u.email AS user_email,
           u.display_name AS user_display_name,
           u.password_hash AS user_password_hash,
           u.default_workspace_id AS user_default_workspace_id,
           u.created_at AS user_created_at,
           w.id AS workspace_id,
           w.name AS workspace_name,
           w.owner_user_id AS workspace_owner_user_id,
           w.created_at AS workspace_created_at
         FROM auth_sessions s
         INNER JOIN app_users u ON u.id = s.user_id
         INNER JOIN workspaces w ON w.id = s.workspace_id
         WHERE s.token_hash = $1`,
        [tokenHash]
      );

      const row = result.rows[0];
      if (!row) {
        return undefined;
      }

      return {
        session: {
          id: row.session_id,
          tokenHash: row.session_token_hash,
          userId: row.session_user_id,
          workspaceId: row.session_workspace_id,
          createdAt: row.session_created_at,
          expiresAt: row.session_expires_at
        },
        user: {
          id: row.user_id,
          email: row.user_email,
          displayName: row.user_display_name,
          passwordHash: row.user_password_hash,
          defaultWorkspaceId: row.user_default_workspace_id,
          createdAt: row.user_created_at
        },
        workspace: {
          id: row.workspace_id,
          name: row.workspace_name,
          ownerUserId: row.workspace_owner_user_id,
          createdAt: row.workspace_created_at
        }
      };
    },
    async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
      await initialize();
      await pool.query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [tokenHash]);
    },
    async upsertWorkspaceGitHubConnection(connection: WorkspaceGitHubConnectionRecord): Promise<void> {
      await initialize();
      await withTransaction(pool, async (client) => {
        const workspaceRow = await client.query<{ id: string }>(
          `SELECT id FROM workspaces WHERE id = $1`,
          [connection.workspaceId]
        );

        if (!workspaceRow.rows[0]) {
          throw createStoreError("Workspace does not exist for GitHub connection upsert.", "23503");
        }

        const installationOwner = await client.query<{ workspace_id: string }>(
          `SELECT workspace_id
           FROM workspace_github_connections
           WHERE installation_id = $1`,
          [String(connection.installationId)]
        );

        if (
          installationOwner.rows[0] &&
          installationOwner.rows[0].workspace_id !== connection.workspaceId
        ) {
          throw createStoreError("GitHub installation is already connected to another workspace.", "23505");
        }

        await client.query(
          `INSERT INTO workspace_github_connections (workspace_id, provider, organization, installation_id, connected_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (workspace_id)
           DO UPDATE SET
             provider = EXCLUDED.provider,
             organization = EXCLUDED.organization,
             installation_id = EXCLUDED.installation_id,
             connected_at = EXCLUDED.connected_at,
             updated_at = EXCLUDED.updated_at`,
          [
            connection.workspaceId,
            connection.provider,
            connection.organization,
            String(connection.installationId),
            connection.connectedAt,
            connection.updatedAt
          ]
        );
      });
    },
    async findWorkspaceGitHubConnection(workspaceId: string): Promise<WorkspaceGitHubConnectionRecord | undefined> {
      await initialize();
      const result = await pool.query<WorkspaceGitHubConnectionRow>(
        `SELECT workspace_id, provider, organization, installation_id, connected_at, updated_at
         FROM workspace_github_connections
         WHERE workspace_id = $1`,
        [workspaceId]
      );
      return result.rows[0] ? mapWorkspaceGitHubConnectionRow(result.rows[0]) : undefined;
    },
    async deleteWorkspaceGitHubConnection(workspaceId: string): Promise<void> {
      await initialize();
      await pool.query(
        `DELETE FROM workspace_github_connections
         WHERE workspace_id = $1`,
        [workspaceId]
      );
    },
    async createGitHubOAuthState(state: GitHubOAuthStateRecord): Promise<void> {
      await initialize();
      await pool.query(
        `INSERT INTO github_oauth_states (state_hash, workspace_id, user_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [state.stateHash, state.workspaceId, state.userId, state.createdAt, state.expiresAt]
      );
    },
    async consumeGitHubOAuthState(stateHash: string): Promise<GitHubOAuthStateRecord | undefined> {
      await initialize();
      const result = await withTransaction(pool, async (client) => {
        const selected = await client.query<GitHubOAuthStateRow>(
          `SELECT state_hash, workspace_id, user_id, created_at, expires_at
           FROM github_oauth_states
           WHERE state_hash = $1`,
          [stateHash]
        );

        if (!selected.rows[0]) {
          return undefined;
        }

        await client.query(`DELETE FROM github_oauth_states WHERE state_hash = $1`, [stateHash]);
        return mapGitHubOAuthStateRow(selected.rows[0]);
      });

      return result;
    },
    async createGitHubOAuthPendingState(state: GitHubOAuthPendingStateRecord): Promise<void> {
      await initialize();
      await pool.query(
        `INSERT INTO github_oauth_pending_states (state_hash, created_at, expires_at)
         VALUES ($1, $2, $3)`,
        [state.stateHash, state.createdAt, state.expiresAt]
      );
    },
    async consumeGitHubOAuthPendingState(stateHash: string): Promise<GitHubOAuthPendingStateRecord | undefined> {
      await initialize();
      const result = await withTransaction(pool, async (client) => {
        const selected = await client.query<GitHubOAuthPendingStateRow>(
          `SELECT state_hash, created_at, expires_at
           FROM github_oauth_pending_states
           WHERE state_hash = $1`,
          [stateHash]
        );

        if (!selected.rows[0]) {
          return undefined;
        }

        await client.query(`DELETE FROM github_oauth_pending_states WHERE state_hash = $1`, [stateHash]);
        return mapGitHubOAuthPendingStateRow(selected.rows[0]);
      });

      return result;
    },
    async upsertWorkspaceGitHubOAuthConnection(connection: WorkspaceGitHubOAuthConnectionRecord): Promise<void> {
      await initialize();
      await withTransaction(pool, async (client) => {
        const workspaceOwnership = await client.query<{ owner_user_id: string }>(
          `SELECT owner_user_id
           FROM workspaces
           WHERE id = $1`,
          [connection.workspaceId]
        );

        if (!workspaceOwnership.rows[0]) {
          throw createStoreError("Workspace does not exist for OAuth connection upsert.", "23503");
        }

        if (workspaceOwnership.rows[0].owner_user_id !== connection.userId) {
          throw createStoreError("User does not own workspace for OAuth connection upsert.", "23503");
        }

        await client.query(
          `INSERT INTO workspace_github_oauth_connections (
            workspace_id,
            user_id,
            github_user_id,
            github_login,
            access_token_ciphertext,
            access_token_iv,
            access_token_tag,
            scopes,
            selected_organization,
            organization_options,
            connected_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (workspace_id, user_id)
          DO UPDATE SET
            github_user_id = EXCLUDED.github_user_id,
            github_login = EXCLUDED.github_login,
            access_token_ciphertext = EXCLUDED.access_token_ciphertext,
            access_token_iv = EXCLUDED.access_token_iv,
            access_token_tag = EXCLUDED.access_token_tag,
            scopes = EXCLUDED.scopes,
            selected_organization = EXCLUDED.selected_organization,
            organization_options = EXCLUDED.organization_options,
            connected_at = EXCLUDED.connected_at,
            updated_at = EXCLUDED.updated_at`,
          [
            connection.workspaceId,
            connection.userId,
            connection.githubUserId,
            connection.githubLogin,
            connection.accessTokenCiphertext,
            connection.accessTokenIv,
            connection.accessTokenTag,
            connection.scopes.join(","),
            connection.selectedOrganization ?? null,
            connection.organizationOptions?.join(",") ?? null,
            connection.connectedAt,
            connection.updatedAt
          ]
        );
      });
    },
    async findWorkspaceGitHubOAuthConnection(
      workspaceId: string,
      userId: string
    ): Promise<WorkspaceGitHubOAuthConnectionRecord | undefined> {
      await initialize();
      const result = await pool.query<WorkspaceGitHubOAuthConnectionRow>(
        `SELECT
           workspace_id,
           user_id,
           github_user_id,
           github_login,
           access_token_ciphertext,
           access_token_iv,
           access_token_tag,
           scopes,
           selected_organization,
           organization_options,
           connected_at,
           updated_at
         FROM workspace_github_oauth_connections
         WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId]
      );

      return result.rows[0] ? mapWorkspaceGitHubOAuthConnectionRow(result.rows[0]) : undefined;
    },
    async findUserWorkspaceByGitHubUserId(githubUserId: string): Promise<PersistedUserWorkspaceContext | undefined> {
      await initialize();
      const result = await pool.query<{
        user_id: string;
        user_email: string;
        user_display_name: string;
        user_password_hash: string;
        user_default_workspace_id: string;
        user_created_at: string;
        workspace_id: string;
        workspace_name: string;
        workspace_owner_user_id: string;
        workspace_created_at: string;
      }>(
        `SELECT
           u.id AS user_id,
           u.email AS user_email,
           u.display_name AS user_display_name,
           u.password_hash AS user_password_hash,
           u.default_workspace_id AS user_default_workspace_id,
           u.created_at AS user_created_at,
           w.id AS workspace_id,
           w.name AS workspace_name,
           w.owner_user_id AS workspace_owner_user_id,
           w.created_at AS workspace_created_at
         FROM workspace_github_oauth_connections c
         INNER JOIN app_users u ON u.id = c.user_id
         INNER JOIN workspaces w ON w.id = c.workspace_id
         WHERE c.github_user_id = $1`,
        [githubUserId]
      );

      const row = result.rows[0];
      if (!row) {
        return undefined;
      }

      return {
        user: {
          id: row.user_id,
          email: row.user_email,
          displayName: row.user_display_name,
          passwordHash: row.user_password_hash,
          defaultWorkspaceId: row.user_default_workspace_id,
          createdAt: row.user_created_at
        },
        workspace: {
          id: row.workspace_id,
          name: row.workspace_name,
          ownerUserId: row.workspace_owner_user_id,
          createdAt: row.workspace_created_at
        }
      };
    },
    async deleteWorkspaceGitHubOAuthConnection(workspaceId: string, userId: string): Promise<void> {
      await initialize();
      await pool.query(
        `DELETE FROM workspace_github_oauth_connections
         WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId]
      );
    }
  };
}

export function createPgMemAuthStore(): AuthStore {
  const db = newDb();
  const { Pool: PgMemPool } = db.adapters.createPg();
  const pool = new PgMemPool();
  const schemaStatements = AUTH_SCHEMA_SQL
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  return createPostgresAuthStore(pool, {
    initializeSchema: async () => {
      for (const statement of schemaStatements) {
        db.public.none(statement);
      }
    }
  });
}