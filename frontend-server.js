const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const FRONTEND = path.join(__dirname, 'frontend');

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);

  if (ruta === '/') {
    ruta = '/login.html';
  }

  const archivo = path.normalize(
    path.join(FRONTEND, ruta)
  );

  if (!archivo.startsWith(FRONTEND)) {
    res.writeHead(403);
    return res.end('Acceso denegado');
  }

  fs.readFile(archivo, (error, contenido) => {
    if (error) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
      return res.end('Archivo no encontrado');
    }

    const extension = path.extname(archivo).toLowerCase();

    res.writeHead(200, {
      'Content-Type': tipos[extension] || 'application/octet-stream'
    });

    res.end(contenido);
  });
});

server.listen(PORT, () => {
  console.log(`Frontend disponible en http://localhost:${PORT}/login.html`);
});
