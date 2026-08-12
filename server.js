const http = require("http");

const PORT = process.env.PORT || 10000;

// Sites currently allowed through the proxy
const allowedHosts = [
  "example.com",
  "www.example.com",
  "example.org",
  "www.example.org",
  "iana.org",
  "www.iana.org"
];


// ------------------------------------
// Base64 URL encoding / decoding
// ------------------------------------

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


// ------------------------------------
// Convert a target URL into a proxy URL
// ------------------------------------

function proxyUrl(url) {
  return (
    "https://betterproxy-backend.onrender.com/proxy/" +
    encodeTarget(url)
  );
}


// ------------------------------------
// Rewrite URLs inside HTML
// ------------------------------------

function rewriteHtml(html, baseUrl) {
  return html

    // <a href="...">
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

    // <img src="...">
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

    // <link href="...">
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

    // <script src="...">
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
// Rewrite URLs inside CSS
// ------------------------------------

function rewriteCss(css, baseUrl) {
  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, quote, url) => {
      const trimmed = url.trim();

      // Don't rewrite embedded data
      // or blob URLs.
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
// Create server
// ------------------------------------

const server = http.createServer(async (req, res) => {
  console.log("Request:", req.url);

  // Allow browser requests
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );


  // ------------------------------------
  // Test endpoint
  // ------------------------------------

  if (req.url === "/proxy/test") {
    res.writeHead(200, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end("Backend works! 🎉");
    return;
  }


  // ------------------------------------
  // Backend homepage
  // ------------------------------------

  if (req.url === "/") {
    res.writeHead(200, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end(
      "BetterProxy backend is running!"
    );

    return;
  }


  // ------------------------------------
  // Only /proxy/... is allowed
  // ------------------------------------

  if (!req.url.startsWith("/proxy/")) {
    res.writeHead(404, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end("Not found");
    return;
  }


  // ------------------------------------
  // Decode target URL
  // ------------------------------------

  const encoded =
    req.url.slice("/proxy/".length);

  const target =
    decodeTarget(encoded);

  if (!target) {
    res.writeHead(400, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end("Invalid encoded URL");
    return;
  }

  console.log(
    "Decoded target:",
    target
  );


  // ------------------------------------
  // Validate target URL
  // ------------------------------------

  let targetURL;

  try {
    targetURL = new URL(target);
  } catch {
    res.writeHead(400, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end("Invalid target URL");
    return;
  }


  // ------------------------------------
  // Check allowed hostname
  // ------------------------------------

  if (
    !allowedHosts.includes(
      targetURL.hostname
    )
  ) {
    res.writeHead(403, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end(
      "This site is not enabled yet."
    );

    return;
  }


  // ------------------------------------
  // Fetch target
  // ------------------------------------

  try {
    const response = await fetch(
      targetURL.href,
      {
        // Don't automatically follow redirects.
        redirect: "manual",

        headers: {
          "User-Agent":
            "BetterProxy-Test/1.0"
        }
      }
    );

    const contentType =
      response.headers.get(
        "content-type"
      ) ||
      "application/octet-stream";

    console.log(
      "Response:",
      response.status,
      contentType
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
      const location =
        response.headers.get(
          "location"
        );

      if (!location) {
        res.writeHead(
          response.status
        );

        res.end();
        return;
      }

      try {
        // Convert relative redirects
        // into absolute URLs.
        const redirectTarget =
          new URL(
            location,
            targetURL.href
          ).href;

        const redirectURL =
          new URL(redirectTarget);

        // Make sure the redirect
        // stays on an allowed site.
        if (
          !allowedHosts.includes(
            redirectURL.hostname
          )
        ) {
          res.writeHead(403, {
            "Content-Type":
              "text/plain; charset=utf-8"
          });

          res.end(
            "Redirect target is not enabled."
          );

          return;
        }

        // Send browser to the proxy
        // instead of the real destination.
        res.writeHead(
          response.status,
          {
            Location:
              proxyUrl(
                redirectTarget
              )
          }
        );

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

        res.end(
          "Invalid redirect"
        );

        return;
      }
    }


    // ------------------------------------
    // HTML response
    // ------------------------------------

    if (
      contentType.includes(
        "text/html"
      )
    ) {
      let body =
        await response.text();

      body = rewriteHtml(
        body,
        targetURL.href
      );

      res.writeHead(
        response.status,
        {
          "Content-Type":
            contentType
        }
      );

      res.end(body);
      return;
    }


    // ------------------------------------
    // CSS response
    // ------------------------------------

    if (
      contentType.includes(
        "text/css"
      ) ||
      targetURL.pathname.endsWith(
        ".css"
      )
    ) {
      let body =
        await response.text();

      body = rewriteCss(
        body,
        targetURL.href
      );

      res.writeHead(
        response.status,
        {
          "Content-Type":
            contentType
        }
      );

      res.end(body);
      return;
    }


    // ------------------------------------
    // Images, fonts, etc.
    // Keep binary data intact.
    // ------------------------------------

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.writeHead(
      response.status,
      {
        "Content-Type":
          contentType
      }
    );

    res.end(buffer);

  } catch (error) {
    console.error(
      "Fetch error:",
      error
    );

    res.writeHead(502, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end(
      "Backend fetch failed"
    );
  }
});


// ------------------------------------
// Start server
// ------------------------------------

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Backend listening on port ${PORT}`
    );
  }
);
