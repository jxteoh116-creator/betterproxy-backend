const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log("Request:", req.url);

  if (req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("BetterProxy backend is running!");
    return;
  }

  if (req.url === "/proxy/test") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>BetterProxy Backend Test</title>
        </head>

        <body style="font-family: Arial; padding: 40px;">
          <h1>Backend works! 🎉</h1>
          <p>This response came from the deployed Node.js server.</p>
        </body>
      </html>
    `);

    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on port ${PORT}`);
});
