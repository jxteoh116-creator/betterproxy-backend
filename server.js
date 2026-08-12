const http = require("http");

const PORT = process.env.PORT || 10000;

function decodeTarget(encoded) {
  try {
    // Convert URL-safe base64 back to normal base64
    let base64 = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // Restore padding
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

  // Allow the StackBlitz frontend to call this backend
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Test route
  if (req.url === "/proxy/test") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Backend works! 🎉");
    return;
  }

  // Proxy route
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

    // Keep the public test proxy restricted for now.
    // We can expand this later after the basic setup works.
    if (targetURL.hostname !== "example.com") {
      res.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("For now, only example.com is allowed.");
      return;
    }

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

  // Home/test page
  if (req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("BetterProxy backend is running!");
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
