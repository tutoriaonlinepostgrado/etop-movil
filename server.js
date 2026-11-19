import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOCKED_FILES = new Set([
  '/server.js',
  '/server.test.js',
  '/etop-core.test.js',
  '/package.json',
  '/package-lock.json',
  '/metadata.json',
  '/README.md',
]);

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    const normalizedPath = req.path.replace(/\/+$/, '') || '/';
    if (
      BLOCKED_FILES.has(normalizedPath) ||
      normalizedPath.startsWith('/node_modules') ||
      normalizedPath.startsWith('/.')
    ) {
      return res.status(404).send('Not Found');
    }
    next();
  });

  app.use(
    express.static(__dirname, {
      dotfiles: 'ignore',
      index: ['index.html'],
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.webmanifest')) {
          res.type('application/manifest+json');
        }
      },
    })
  );

  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`ETOP Móvil server running at http://${HOST}:${PORT}`);
  });
}
