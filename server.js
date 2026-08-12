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
  return "https://betterproxy-backend.onrender.com/proxy/" +
    encodeTarget(url);
}


// ------------------------------------
// Rewrite HTML
// ------------------------------------

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
    )

    .replace(
      /(<script\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
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


// ------------------------------------
// Rewrite CSS
// ------------------------------------

function rewriteCss(css, baseUrl) {
  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, quote, url) => {
      const trimmed = url.trim();

      if (
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:")
      ) {
        return match;
      }

      try {
        const absolute = new URL(trimmed, baseUrl).href;

        return `url("${proxyUrl(absolute)}")`;
      } catch {
        return match;
      }
    }
  );
}


// ------------------------------------
// Server
// ------------------------------------

const server = http.createServer(async (req, res) => {
  console.log("Request:", req.url);

  res.setHeader("Access-Control-Allow-Origin", "*");


  // Test
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


  // Proxy route
  if (!req.url.startsWith("/proxy/")) {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Not found");
    return;
  }


  // Decode target
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


  // Validate URL
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


  // Allowed hosts
  if (!allowedHosts.includes(targetURL.hostname)) {
    res.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("This site is not enabled yet.");
    return;
  }


  try {
    // IMPORTANT:
    // Don't automatically follow redirects.
    const response = await fetch(targetURL.href, {
      redirect: "manual",

      headers: {
        "User-Agent": "BetterProxy-Test/1.0"
      }
    });

    console.log(
      "Response:",
      response.status,
      response.headers.get("content-type") || ""
    );


    // ------------------------------------
    // Handle redirects
    // ------------------------------------

    if (
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308
    ) {
      const location = response.headers.get("location");

      if (!location) {
        res.writeHead(response.status);
        res.end();
        return;
      }

      try {
        const redirectTarget =
          new URL(location, targetURL.href).href;

        const redirectHost =
          new URL(redirectTarget).hostname;

        if (!allowedHosts.includes(redirectHost)) {
          res.writeHead(403, {
            "Content-Type":
              "text/plain; charset=utf-8"
          });

          res.end(
            "Redirect target is not enabled."
          );

          return;
        }

        res.writeHead(response.status, {
          "Location": proxyUrl(redirectTarget)
        });

        res.end();

        console.log(
          "Proxy redirect:",
          redirectTarget
        );

        return;

      } catch {
        res.writeHead(502, {
          "Content-Type":
            "text/plain; charset=utf-8"
        });

        res.end("Invalid redirect");
        return;
      }
    }


    // ------------------------------------
    // HTML
    // ------------------------------------

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    if (contentType.includes("text/html")) {
      let body = await response.text();

      body = rewriteHtml(
        body,
        targetURL.href
      );

      res.writeHead(response.status, {
        "Content-Type": contentType
      });

      res.end(body);
      return;
    }


    // ------------------------------------
    // CSS
    // ------------------------------------

    if (
      contentType.includes("text/css") ||
      targetURL.pathname.endsWith(".css")
    ) {
      let body = await response.text();

      body = rewriteCss(
        body,
        targetURL.href
      );

      res.writeHead(response.status, {
        "Content-Type": contentType
      });

      res.end(body);
      return;
    }


    // ------------------------------------
    // Binary resources
    // ------------------------------------

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
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end("Backend fetch failed");
  }
});


server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Backend listening on port ${PORT}`
  );
});
