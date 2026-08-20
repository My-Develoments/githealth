import express from "express";
import { authRoutes } from "./http/authRoutes.js";
import { requireAuthenticatedAppAccess } from "./http/authSession.js";
import { githubConnectionRoutes } from "./http/githubConnectionRoutes.js";
import { githubHealthScoreRoutes } from "./http/githubHealthScoreRoutes.js";
import { healthScoreRoutes } from "./http/healthScoreRoutes.js";
import { opsRoutes } from "./http/opsRoutes.js";
import { isLocalDevelopmentCorsEnabled, localDevelopmentCors } from "./http/localDevelopmentCors.js";
import { requestLogger } from "./infrastructure/observability/requestLogger.js";
import { initializePersistentInfrastructure, validateStartupConfiguration } from "./infrastructure/runtime/startupValidation.js";
import { attachRequestContext } from "./http/requestContext.js";
import { sendApiError } from "./http/errorEnvelope.js";
import { unexpectedErrorHandler } from "./http/unexpectedErrorHandler.js";

type CreateAppOptions = {
  additionalRoutes?: (app: express.Express) => void;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  if (isLocalDevelopmentCorsEnabled()) {
    app.use(localDevelopmentCors);
  }
  app.use(attachRequestContext);
  app.use(requestLogger);
  app.use(opsRoutes);
  app.use("/auth", authRoutes);
  app.use("/github/connection", requireAuthenticatedAppAccess, githubConnectionRoutes);

  app.use("/health-score", healthScoreRoutes);
  app.use("/health-score/github", requireAuthenticatedAppAccess, githubHealthScoreRoutes);

  options.additionalRoutes?.(app);

  app.use((_req, res) => {
    sendApiError(res, {
      status: 404,
      code: "NOT_FOUND",
      message: "Resource not found."
    });
  });

  app.use(unexpectedErrorHandler);

  return app;
}

async function start(): Promise<void> {
  validateStartupConfiguration();
  await initializePersistentInfrastructure();

  const app = createApp();
  const port = Number(process.env.PORT) || 4000;

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

await start();
