const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Allow requests from the frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Browser CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log("Request:", req.url);

  // Home
  if (req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("BetterProxy backend is running!");
    return;
  }

  // Test endpoint
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
        <p>This response came from the Render backend.</p>
      </body>
      </html>
    `);

    return;
  }

  // Not found
  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on port ${PORT}`);
});
