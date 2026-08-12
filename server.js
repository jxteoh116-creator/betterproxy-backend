const http = require("http");

const PORT = process.env.PORT || 10000;

const allowedHosts = [
  "example.com",
  "www.example.com",
  "example.org",
  "www.example.org",
  "iana.org",
  "www.iana.org"
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
  return (
    "https://betterproxy-backend.onrender.com/proxy/" +
    encodeTarget(url)
  );
}


// ------------------------------------
// Built-in JavaScript test page
// ------------------------------------

function testPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>BetterProxy Fetch Test</title>
</head>

<body>
  <h1>BetterProxy Fetch Test</h1>

  <p id="message">
    JavaScript has not run yet.
  </p>

  <button id="testButton">
    Test API Request
  </button>

  <script>
    document.getElementById("message").textContent =
      "JavaScript loaded successfully!";

    document.getElementById("testButton").addEventListener(
      "click",
      async function () {

        const message =
          document.getElementById("message");

        message.textContent =
          "Sending fetch request...";

        try {

          const response =
            await fetch("/proxy/test");

          if (!response.ok) {
            throw new Error(
              "HTTP " + response.status
            );
          }

          const text =
            await response.text();

          message.textContent =
            "Fetch worked: " + text;

        } catch (error) {

          console.error(error);

          message.textContent =
            "Fetch failed: " +
            error.message;
        }
      }
    );
  </script>
</body>
</html>`;
}
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>BetterProxy JavaScript Test</title>
</head>

<body>
  <h1>BetterProxy JavaScript Test</h1>

  <p id="message">
    JavaScript has not run yet.
  </p>

  <button id="testButton">
    Click me
  </button>

  <script>
    document.getElementById("message").textContent =
      "JavaScript loaded successfully! 🎉";

    document.getElementById("testButton").addEventListener(
      "click",
      function () {
        document.getElementById("message").textContent =
          "The button JavaScript works! 🚀";
      }
    );
  </script>
</body>
</html>`;
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
          const absolute =
            new URL(url, baseUrl).href;

          if (
            !absolute.startsWith("http://") &&
            !absolute.startsWith("https://")
          ) {
            return match;
          }

          return (
            start +
            proxyUrl(absolute) +
            end
          );
        } catch {
          return match;
        }
      }
    )

    .replace(
      /(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
      (match, start, url, end) => {
        try {
          const absolute =
            new URL(url, baseUrl).href;

          return (
            start +
            proxyUrl(absolute) +
            end
          );
        } catch {
          return match;
        }
      }
    )

    .replace(
      /(<link\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi,
      (match, start, url, end) => {
        try {
          const absolute =
            new URL(url, baseUrl).href;

          return (
            start +
            proxyUrl(absolute) +
            end
          );
        } catch {
          return match;
        }
      }
    )

    .replace(
      /(<script\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
      (match, start, url, end) => {
        try {
          const absolute =
            new URL(url, baseUrl).href;

          return (
            start +
            proxyUrl(absolute) +
            end
          );
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
        const absolute =
          new URL(trimmed, baseUrl).href;

        return (
          `url("${proxyUrl(absolute)}")`
        );
      } catch {
        return match;
      }
    }
  );
}


// ------------------------------------
// Server
// ------------------------------------

const server = http.createServer(
  async (req, res) => {

    console.log(
      "Request:",
      req.url
    );

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );


    // --------------------------------
    // JavaScript test page
    // --------------------------------

    if (req.url === "/test") {
      res.writeHead(200, {
        "Content-Type":
          "text/html; charset=utf-8"
      });

      res.end(testPage());
      return;
    }


    // --------------------------------
    // Backend test
    // --------------------------------

    if (req.url === "/proxy/test") {
      res.writeHead(200, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end(
        "Backend works! 🎉"
      );

      return;
    }


    // --------------------------------
    // Backend homepage
    // --------------------------------

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


    // --------------------------------
    // Proxy route
    // --------------------------------

    if (
      !req.url.startsWith("/proxy/")
    ) {
      res.writeHead(404, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end("Not found");
      return;
    }


    // --------------------------------
    // Decode target
    // --------------------------------

    const encoded =
      req.url.slice("/proxy/".length);

    const target =
      decodeTarget(encoded);

    if (!target) {
      res.writeHead(400, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end(
        "Invalid encoded URL"
      );

      return;
    }

    console.log(
      "Decoded target:",
      target
    );


    // --------------------------------
    // Validate URL
    // --------------------------------

    let targetURL;

    try {
      targetURL =
        new URL(target);
    } catch {
      res.writeHead(400, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end(
        "Invalid target URL"
      );

      return;
    }


    // --------------------------------
    // Allowed hosts
    // --------------------------------

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


    try {

      const response =
        await fetch(
          targetURL.href,
          {
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


      // --------------------------------
      // Redirects
      // --------------------------------

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

          const redirectTarget =
            new URL(
              location,
              targetURL.href
            ).href;

          const redirectURL =
            new URL(
              redirectTarget
            );


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


      // --------------------------------
      // HTML
      // --------------------------------

      if (
        contentType.includes(
          "text/html"
        )
      ) {

        let body =
          await response.text();

        body =
          rewriteHtml(
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


      // --------------------------------
      // CSS
      // --------------------------------

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

        body =
          rewriteCss(
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


      // --------------------------------
      // Binary resources
      // --------------------------------

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
  }
);


// ------------------------------------
// Start
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
