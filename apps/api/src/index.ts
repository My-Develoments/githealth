import express from "express";
import { githubHealthScoreRoutes } from "./http/githubHealthScoreRoutes.js";
import { healthScoreRoutes } from "./http/healthScoreRoutes.js";
import { opsRoutes } from "./http/opsRoutes.js";
import { localDevelopmentCors } from "./http/localDevelopmentCors.js";
import { requestLogger } from "./infrastructure/observability/requestLogger.js";
import { validateStartupConfiguration } from "./infrastructure/runtime/startupValidation.js";
import { attachRequestContext } from "./http/requestContext.js";
import { sendApiError } from "./http/errorEnvelope.js";
import { GitHubAdapterError } from "./infrastructure/github/errors.js";

type CreateAppOptions = {
  additionalRoutes?: (app: express.Express) => void;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.use(localDevelopmentCors);
  app.use(attachRequestContext);
  app.use(requestLogger);
  app.use(opsRoutes);

  app.use("/health-score", healthScoreRoutes);
  app.use("/health-score/github", githubHealthScoreRoutes);

  options.additionalRoutes?.(app);

  app.use((_req, res) => {
    sendApiError(res, {
      status: 404,
      code: "NOT_FOUND",
      message: "Resource not found."
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof GitHubAdapterError) {
      sendApiError(res, {
        status: error.status,
        code: error.code,
        message: error.message
      });
      return;
    }

    sendApiError(res, {
      status: 500,
      code: "UPSTREAM_UNAVAILABLE",
      message: "Internal server error."
    });
  });

  return app;
}

function start(): void {
  validateStartupConfiguration();

  const app = createApp();
  const port = Number(process.env.PORT) || 4000;

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

start();
