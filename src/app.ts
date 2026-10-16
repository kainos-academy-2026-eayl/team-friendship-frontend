import express, { type Express, type Request, type Response } from 'express';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function createApp(): Express {
  const app = express();

  app.get(['/', '/login.html'], (_req: Request, res: Response) => {
    res.sendFile(fileURLToPath(new URL('./login.html', import.meta.url)));
  });

  app.get('/sign_up.html', (_req: Request, res: Response) => {
    res.sendFile(fileURLToPath(new URL('./sign_up.html', import.meta.url)));
  });

  app.get('/auth.css', (_req: Request, res: Response) => {
    res.sendFile(fileURLToPath(new URL('./auth.css', import.meta.url)));
  });

  app.get('/sign_up.js', async (_req: Request, res: Response) => {
    const scriptPath = fileURLToPath(new URL('./sign_up.js', import.meta.url));

    try {
      await access(scriptPath);
      res.sendFile(scriptPath);
      return;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }

    const sourcePath = fileURLToPath(new URL('./sign_up.ts', import.meta.url));
    const source = await readFile(sourcePath, 'utf8');
    const { transform } = await import('esbuild');
    const { code } = await transform(source, {
      loader: 'ts',
      target: 'es2023',
      format: 'esm',
    });
    res.type('application/javascript').send(code);
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  return app;
}
