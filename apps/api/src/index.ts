import express from "express";
import { healthScoreRoutes } from "./http/healthScoreRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/health-score", healthScoreRoutes);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
