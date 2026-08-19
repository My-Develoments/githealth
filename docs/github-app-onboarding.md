# GitHub App Onboarding Setup

GitHealth supports two backend GitHub authentication providers:

- `pat`: existing local development flow using `GITHUB_TOKEN`
- `app`: GitHub App installation authentication managed server-side

GitHealth now supports a stateless installation callback flow for GitHub App mode. After a successful GitHub App install, the API validates the installation server-side and returns an opaque short-lived installation session token to the browser. The browser uses that token only when calling the protected GitHealth API.

## Required API environment variables for `GITHUB_AUTH_PROVIDER=app`

- `GITHUB_AUTH_PROVIDER=app`
- `GITHUB_APP_ID`: GitHub App ID
- `GITHUB_APP_PRIVATE_KEY`: PEM private key for the app
- One of:
  - `GITHUB_APP_INSTALLATION_ID`: installation ID for an already installed app
  - `GITHUB_APP_INSTALL_URL`: installation URL used by the onboarding flow
- `ALLOWED_GITHUB_ORGS`: comma-separated allowed GitHub organizations. The installation callback validates the installed organization against this allowlist.

## Optional API environment variables

- `GITHUB_APP_CLIENT_ID`: reserved for future OAuth-style app extensions
- `GITHUB_APP_CLIENT_SECRET`: reserved for future OAuth-style app extensions
- `GITHUB_APP_ONBOARDING_REDIRECT_URL`: frontend URL to redirect to after the GitHub App setup callback, for example `http://localhost:5173`

No additional GitHub App session secret is required. GitHealth derives an internal session-token encryption key from the configured GitHub App credentials and never sends the private key, client secret, or installation access tokens to the browser.

## Callback URL requirements

- The GitHub App Setup URL must point to the API callback endpoint on your deployed API origin:
  - `/github/connection/callback`
- This callback endpoint is intentionally public because GitHub redirects the installing user back to it after installation.
- This is the smallest exception to `API_AUTH_TOKEN` protection in the GitHub connection flow:
  - `/github/connection/status` remains protected
  - `/github/connection/start` remains protected
  - GitHub health score routes remain protected
- The callback validates `installation_id` and `setup_action`, resolves installation metadata directly from the GitHub API using GitHub App authentication, and rejects invalid or unauthorized installations.

## GitHub App settings required outside the repository

1. Create a GitHub App in GitHub organization or personal settings.
2. Grant the minimum read permissions needed for GitHealth scoring. The current flow reads organization, repository, pull request, workflow, and security-related metadata.
3. Generate a private key and provide it through `GITHUB_APP_PRIVATE_KEY`.
4. Copy the App ID into `GITHUB_APP_ID`.
5. Copy the installation URL into `GITHUB_APP_INSTALL_URL`.
6. Set the GitHub App Setup URL to the API callback endpoint:
  - `https://your-api-origin/github/connection/callback`
7. Set `GITHUB_APP_ONBOARDING_REDIRECT_URL` to the web application URL that should receive callback completion redirects.
8. Ensure `ALLOWED_GITHUB_ORGS` includes the GitHub organization that will install the app.
9. If you want a deployment-level installation that does not depend on browser session state, you may still set `GITHUB_APP_INSTALLATION_ID` in the API environment.

## How the callback flow works

1. The frontend calls the protected `/github/connection/start` endpoint.
2. The API returns the GitHub App install URL.
3. The browser navigates to GitHub and the user installs the app.
4. GitHub redirects the browser to `/github/connection/callback` on the API.
5. The API callback validates the query parameters.
6. The API resolves the installation via the GitHub App API.
7. The API verifies that the installation targets an allowed organization.
8. The API creates an opaque, encrypted, short-lived installation session token.
9. The API redirects the browser to `GITHUB_APP_ONBOARDING_REDIRECT_URL` with callback status metadata and the opaque session token.
10. The frontend stores only the opaque token for the browser session and sends it back to protected API endpoints in the `x-github-app-session` header.
11. The API uses that token server-side to mint installation access tokens and run the existing GitHub scoring flow.

## Local development limitations

- The callback flow requires a reachable callback URL in GitHub App settings. Plain localhost setups usually need a tunnel or a deployed API URL for GitHub to reach the callback during real installs.
- The browser-side installation session is short-lived and scoped to the current browser session.
- The callback flow avoids manual `GITHUB_APP_INSTALLATION_ID` setup for the active browser session, but it is not a persistent multi-user installation registry.

## Production deployment considerations

- If the web app and API run on different origins, ensure the frontend can send the opaque installation session token header to the API.
- Keep `API_AUTH_TOKEN` server-managed and do not expose GitHub secrets in the browser.
- Use HTTPS for both API and frontend callback redirect URLs.
- Monitor GitHub App installation revocations or permission changes. A revoked installation causes the session-backed connection to become unauthorized.
- For long-lived tenant or organization connections across browsers and restarts, a persistent backend installation store would still be required.

## Current limitations

- The API does not persist installation IDs or browser installation sessions.
- The completed callback flow is stateless and safe, but it is not a fully persistent multi-user OAuth or tenancy system.
- A user who loses the short-lived browser installation session must run the connect flow again unless `GITHUB_APP_INSTALLATION_ID` is configured server-side.
- `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` are accepted for future expansion but are not required by the current install flow.