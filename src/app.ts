import express, { type Express, type Request, type Response } from "express";
import nunjucks from "nunjucks";

export function createApp(): Express {
  const app = express();

  nunjucks.configure("pages", {
    autoescape: true,
    express: app,
  });

  app.set("view engine", "njk");

  app.use(express.static("pages"));

  app.get("/", (_req: Request, res: Response) => {
    res.redirect("/login");
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/login", (_req: Request, res: Response) => {
    res.render("login");
  });

  return app;
}
