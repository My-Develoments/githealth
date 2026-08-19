# GitHub App Onboarding Setup

GitHealth supports two backend GitHub authentication providers:

- `pat`: existing local development flow using `GITHUB_TOKEN`
- `app`: GitHub App installation authentication managed server-side

## Required API environment variables for `GITHUB_AUTH_PROVIDER=app`

- `GITHUB_AUTH_PROVIDER=app`
- `GITHUB_APP_ID`: GitHub App ID
- `GITHUB_APP_PRIVATE_KEY`: PEM private key for the app
- One of:
  - `GITHUB_APP_INSTALLATION_ID`: installation ID for an already installed app
  - `GITHUB_APP_INSTALL_URL`: installation URL used by the onboarding flow

## Optional API environment variables

- `GITHUB_APP_CLIENT_ID`: reserved for future OAuth-style app extensions
- `GITHUB_APP_CLIENT_SECRET`: reserved for future OAuth-style app extensions
- `GITHUB_APP_ONBOARDING_REDIRECT_URL`: frontend URL to redirect to after the GitHub App setup callback, for example `http://localhost:5173`

## GitHub App settings required outside the repository

1. Create a GitHub App in GitHub organization or personal settings.
2. Grant the minimum read permissions needed for GitHealth scoring. The current flow reads organization, repository, pull request, workflow, and security-related metadata.
3. Generate a private key and provide it through `GITHUB_APP_PRIVATE_KEY`.
4. Copy the App ID into `GITHUB_APP_ID`.
5. Copy the installation URL into `GITHUB_APP_INSTALL_URL`.
6. If you want GitHub to return users to the web app after installation, set the app Setup URL to the API callback endpoint:
   - `/github/connection/callback` on your deployed API origin
7. If using callback redirects, set `GITHUB_APP_ONBOARDING_REDIRECT_URL` to the web application URL.
8. After installation, set `GITHUB_APP_INSTALLATION_ID` in the API environment and restart the API.

## Current limitations

- The API does not persist installation IDs from callbacks.
- The callback flow is safe and stateless, but final installation binding is still completed through environment configuration.
- `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` are accepted for future expansion but are not required by the current install flow.