// Запуск: node server.js  →  http://localhost:8080
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

http.createServer((req, res) => {
  const name = req.url.split("?")[0] === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]).slice(1);
  const file = path.join(__dirname, path.normalize(name));
  if (!file.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": (TYPES[path.extname(file)] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
