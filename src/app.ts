import express, { type Express, type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';

export function createApp(): Express {
  const app = express();

  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(fileURLToPath(new URL('./login.html', import.meta.url)));
  });

  app.get('/login.css', (_req: Request, res: Response) => {
    res.sendFile(fileURLToPath(new URL('./login.css', import.meta.url)));
  });

  app.get('/login.js', (_req: Request, res: Response) => {
    res.sendFile(fileURLToPath(new URL('../dist/login.js', import.meta.url)));
  });

  app.get('/health', (_req: Request, res: Response) => {

    res.json({ status: 'UP', uptime: process.uptime() });

  });

  return app;
}
