import express from "express";
import { githubHealthScoreRoutes } from "./http/githubHealthScoreRoutes.js";
import { healthScoreRoutes } from "./http/healthScoreRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/health-score", healthScoreRoutes);
app.use("/health-score/github", githubHealthScoreRoutes);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
