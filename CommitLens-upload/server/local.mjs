import { createServer } from 'node:http';
import { createServer as createViteServer, preview } from 'vite';
import { handle } from './http.mjs';

const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
function route(req, res, next) {
  if (req.url?.split('?')[0] === '/api/process') return void handle(req, res);
  next();
}
if (process.argv.includes('--built')) {
  const server = await preview({
    configLoader: 'native',
    preview: { host, port, strictPort: true },
    plugins: [{ name: 'commitlens-api', configurePreviewServer(server) { server.middlewares.use(route); } }]
  });
  server.printUrls();
} else {
  const vite = await createViteServer({ configLoader: 'native', server: { middlewareMode: true }, appType: 'spa' });
  createServer((req, res) => route(req, res, () => vite.middlewares(req, res)))
    .listen(port, host, () => console.log('CommitLens is ready at http://' + host + ':' + port));
}
