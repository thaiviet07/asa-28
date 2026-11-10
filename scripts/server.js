const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

function handler(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Default security headers & CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Prevent directory traversal
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '').replace(/^\//, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  function serveFile(targetPath, statusCode = 200) {
    fs.stat(targetPath, (err, stats) => {
      if (err || !stats.isFile()) {
        serve404();
        return;
      }

      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Support Range requests (especially for MP4 videos)
      const range = req.headers.range;
      if (range && stats.size > 0) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });

        const stream = fs.createReadStream(targetPath, { start, end });
        stream.pipe(res);
      } else {
        res.writeHead(statusCode, {
          'Content-Length': stats.size,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes'
        });

        const stream = fs.createReadStream(targetPath);
        stream.pipe(res);
      }
    });
  }

  function serve404() {
    const notFoundPath = path.join(PUBLIC_DIR, '404.html');
    fs.access(notFoundPath, fs.constants.F_OK, (err) => {
      if (!err) {
        serveFile(notFoundPath, 404);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });
  }

  function tryResolve(paths, callback) {
    if (paths.length === 0) {
      return callback(null);
    }
    const current = paths[0];
    fs.stat(current, (err, stats) => {
      if (!err && stats.isFile()) {
        return callback(current);
      }
      tryResolve(paths.slice(1), callback);
    });
  }

  let candidates = [filePath];
  if (safePath.startsWith('assets/')) {
    const sub = safePath.slice('assets/'.length);
    candidates.push(
      path.join(PUBLIC_DIR, 'assets', 'fonts', sub),
      path.join(PUBLIC_DIR, 'assets', 'images', sub),
      path.join(PUBLIC_DIR, 'assets', 'videos', sub),
      path.join(PUBLIC_DIR, 'images', sub)
    );
  } else if (safePath.startsWith('images/')) {
    const sub = safePath.slice('images/'.length);
    candidates.push(
      path.join(PUBLIC_DIR, 'assets', 'images', sub)
    );
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.access(indexPath, fs.constants.F_OK, (indexErr) => {
        if (!indexErr) {
          serveFile(indexPath);
        } else {
          serve404();
        }
      });
    } else if (!err && stats.isFile()) {
      serveFile(filePath);
    } else {
      tryResolve(candidates.slice(1), (matched) => {
        if (matched) {
          serveFile(matched);
          return;
        }

        // Check if adding .html finds a file (clean URLs)
        const htmlPath = filePath + '.html';
        fs.access(htmlPath, fs.constants.F_OK, (htmlErr) => {
          if (!htmlErr) {
            serveFile(htmlPath);
          } else {
            // Check if it's a directory with index.html without trailing slash
            const dirIndexPath = path.join(filePath, 'index.html');
            fs.access(dirIndexPath, fs.constants.F_OK, (dirErr) => {
              if (!dirErr) {
                serveFile(dirIndexPath);
              } else {
                serve404();
              }
            });
          }
        });
      });
    }
  });
}

const server = http.createServer(handler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
  });
}

module.exports = handler;
