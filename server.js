const http = require("http");

const PORT = process.env.PORT || 10000;

function decodeTarget(encoded) {
  try {
    let base64 = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    while (base64.length % 4) {
      base64 += "=";
    }

    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  console.log("Request:", req.url);

  // Allow requests from the frontend
  res.setHeader("Access-Control-Allow-Origin", "*");

  // -------------------------
  // TEST ROUTE
  // -------------------------
  if (req.url === "/proxy/test") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Backend works! 🎉");
    return;
  }

  // -------------------------
  // PROXY ROUTE
  // -------------------------
  if (req.url.startsWith("/proxy/")) {
    const encoded = req.url.slice("/proxy/".length);

    const target = decodeTarget(encoded);

    if (!target) {
      res.writeHead(400, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Invalid encoded URL");
      return;
    }

    console.log("Decoded target:", target);

    let targetURL;

    try {
      targetURL = new URL(target);
    } catch {
      res.writeHead(400, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Invalid target URL");
      return;
    }

    // -------------------------
    // ALLOWED TEST SITES
    // -------------------------
    const allowedHosts = [
      "example.com",
      "www.example.com",
      "example.org",
      "www.example.org"
    ];

    if (!allowedHosts.includes(targetURL.hostname)) {
      res.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("This site is not enabled yet.");
      return;
    }

    // -------------------------
    // FETCH TARGET
    // -------------------------
    try {
      const response = await fetch(targetURL.href, {
        headers: {
          "User-Agent": "BetterProxy-Test/1.0"
        }
      });

      const body = await response.text();

      res.writeHead(response.status, {
        "Content-Type":
          response.headers.get("content-type") ||
          "text/html; charset=utf-8"
      });

      res.end(body);

    } catch (error) {
      console.error("Fetch error:", error);

      res.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Backend fetch failed");
    }

    return;
  }

  // -------------------------
  // HOME
  // -------------------------
  if (req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("BetterProxy backend is running!");
    return;
  }

  // -------------------------
  // NOT FOUND
  // -------------------------
  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on port ${PORT}`);
});
