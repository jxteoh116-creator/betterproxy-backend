const http = require("http");

const PORT = process.env.PORT || 10000;

const allowedHosts = [
  "example.com",
  "www.example.com",
  "example.org",
  "www.example.org"
];

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

function encodeTarget(url) {
  return Buffer.from(url)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function proxyUrl(url) {
  return "/proxy/" + encodeTarget(url);
}

function rewriteHtml(html, baseUrl) {
  return html
    .replace(
      /(<a\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi,
      (match, start, url, end) => {
        try {
          const absolute = new URL(url, baseUrl).href;

          if (
            !absolute.startsWith("http://") &&
            !absolute.startsWith("https://")
          ) {
            return match;
          }

          return start + proxyUrl(absolute) + end;
        } catch {
          return match;
        }
      }
    )
    .replace(
      /(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
      (match, start, url, end) => {
        try {
          const absolute = new URL(url, baseUrl).href;
          return start + proxyUrl(absolute) + end;
        } catch {
          return match;
        }
      }
    )
    .replace(
      /(<link\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi,
      (match, start, url, end) => {
        try {
          const absolute = new URL(url, baseUrl).href;
          return start + proxyUrl(absolute) + end;
        } catch {
          return match;
        }
      }
    );
}

const server = http.createServer(async (req, res) => {
  console.log("Request:", req.url);

  res.setHeader("Access-Control-Allow-Origin", "*");

  // Test endpoint
  if (req.url === "/proxy/test") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Backend works! 🎉");
    return;
  }

  // Homepage
  if (req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("BetterProxy backend is running!");
    return;
  }

  // Anything other than /proxy/... is not found
  if (!req.url.startsWith("/proxy/")) {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Not found");
    return;
  }

  // Decode target URL
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

  // Only allow our test domains for now
  if (!allowedHosts.includes(targetURL.hostname)) {
    res.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("This site is not enabled yet.");
    return;
  }

  try {
    const response = await fetch(targetURL.href, {
      headers: {
        "User-Agent": "BetterProxy-Test/1.0"
      }
    });

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    console.log(
      "Response:",
      response.status,
      contentType
    );

    // HTML needs to be treated as text so we can rewrite it
    if (contentType.includes("text/html")) {
      let body = await response.text();

      body = rewriteHtml(body, targetURL.href);

      res.writeHead(response.status, {
        "Content-Type": contentType
      });

      res.end(body);
      return;
    }

    // Everything else stays binary-safe
    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.writeHead(response.status, {
      "Content-Type": contentType
    });

    res.end(buffer);

  } catch (error) {
    console.error("Fetch error:", error);

    res.writeHead(502, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Backend fetch failed");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on port ${PORT}`);
});
