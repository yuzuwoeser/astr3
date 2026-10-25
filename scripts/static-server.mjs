import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

export function serveDirectory(directory, port = 0) {
  const root = resolve(directory);
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
  };
  return createServer((request, response) => {
    try {
      let path = resolve(
        root,
        `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`,
      );
      if (path !== root && !path.startsWith(root + sep)) throw new Error('Outside root');
      if (statSync(path).isDirectory()) path += '/index.html';
      response.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
      createReadStream(path)
        .on('error', () => response.destroy())
        .pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  }).listen(port, '127.0.0.1');
}
