const http = require("http");

const PORT = process.env.PORT || 10000;

const BACKEND_URL =
  "https://betterproxy-backend.onrender.com";

const allowedHosts = [
  "example.com",
  "www.example.com",
  "example.org",
  "www.example.org",
  "iana.org",
  "www.iana.org"
];


// ====================================
// URL ENCODING
// ====================================

function encodeTarget(url) {
  return Buffer.from(url)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


function decodeTarget(encoded) {
  try {
    let base64 = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    while (base64.length % 4) {
      base64 += "=";
    }

    return Buffer.from(
      base64,
      "base64"
    ).toString("utf8");

  } catch {
    return null;
  }
}


function proxyUrl(url) {
  return (
    BACKEND_URL +
    "/proxy/" +
    encodeTarget(url)
  );
}


// ====================================
// FETCH INTERCEPTOR
// ====================================

function fetchInterceptor() {
  return `
<script>
(function () {

  const originalFetch = window.fetch;

  const BACKEND =
    "${BACKEND_URL}";

  function encodeTarget(url) {
    return btoa(url)
      .replace(/\\+/g, "-")
      .replace(/\\//g, "_")
      .replace(/=+$/, "");
  }

  window.fetch = function(input, init) {

    let url;

    if (typeof input === "string") {
      url = input;
    } else if (input && input.url) {
      url = input.url;
    } else {
      return originalFetch(input, init);
    }

    if (
      url.startsWith("http://") ||
      url.startsWith("https://")
    ) {

      const proxied =
        BACKEND +
        "/proxy/" +
        encodeTarget(url);

      console.log(
        "BetterProxy fetch:",
        url
      );

      return originalFetch(
        proxied,
        init
      );
    }

    return originalFetch(
      input,
      init
    );
  };

})();
</script>
`;
}


// ====================================
// TEST PAGE
// ====================================

function testPage() {

  const exampleProxy =
    proxyUrl(
      "https://example.com/"
    );

  return `<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">

  <title>
    BetterProxy Phase 6C Test
  </title>
</head>

<body>

  <h1>
    BetterProxy Phase 6C
  </h1>

  <p id="message">
    Ready.
  </p>

  <button id="test">
    Test proxied fetch
  </button>

  <script>

    const originalFetch =
      window.fetch;

    const BACKEND =
      "${BACKEND_URL}";

    function encodeTarget(url) {
      return btoa(url)
        .replace(/\\+/g, "-")
        .replace(/\\//g, "_")
        .replace(/=+$/, "");
    }

    window.fetch =
      function(input, init) {

        let url;

        if (typeof input === "string") {
          url = input;
        } else {
          url = input.url;
        }

        if (
          url.startsWith("http://") ||
          url.startsWith("https://")
        ) {

          const proxied =
            BACKEND +
            "/proxy/" +
            encodeTarget(url);

          return originalFetch(
            proxied,
            init
          );
        }

        return originalFetch(
          input,
          init
        );
      };


    document
      .getElementById("test")
      .addEventListener(
        "click",
        async function() {

          const message =
            document.getElementById(
              "message"
            );

          message.textContent =
            "Testing...";

          try {

            const response =
              await fetch(
                "https://example.com/"
              );

            if (!response.ok) {
              throw new Error(
                "HTTP " +
                response.status
              );
            }

            const text =
              await response.text();

            message.textContent =
              "Success! Received " +
              text.length +
              " characters.";

          } catch (error) {

            console.error(error);

            message.textContent =
              "Failed: " +
              error.message;
          }

        }
      );

  </script>

</body>
</html>`;
}


// ====================================
// HTML REWRITING
// ====================================

function rewriteHtml(
  html,
  baseUrl
) {

  // Inject fetch interceptor
  // before the page's scripts.

  const interceptor =
    fetchInterceptor();


  if (
    /<head\b[^>]*>/i.test(html)
  ) {

    html =
      html.replace(
        /<head\b[^>]*>/i,
        match =>
          match +
          interceptor
      );

  } else {

    html =
      interceptor +
      html;

  }


  // -------------------------------
  // Links
  // -------------------------------

  html = html.replace(
    /(<a\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi,

    (
      match,
      start,
      url,
      end
    ) => {

      try {

        const absolute =
          new URL(
            url,
            baseUrl
          ).href;

        if (
          !absolute.startsWith(
            "http://"
          ) &&
          !absolute.startsWith(
            "https://"
          )
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
  );


  // -------------------------------
  // Images
  // -------------------------------

  html = html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,

    (
      match,
      start,
      url,
      end
    ) => {

      try {

        const absolute =
          new URL(
            url,
            baseUrl
          ).href;

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


  // -------------------------------
  // Stylesheets
  // -------------------------------

  html = html.replace(
    /(<link\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi,

    (
      match,
      start,
      url,
      end
    ) => {

      try {

        const absolute =
          new URL(
            url,
            baseUrl
          ).href;

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


  // -------------------------------
  // External JavaScript
  // -------------------------------

  html = html.replace(
    /(<script\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,

    (
      match,
      start,
      url,
      end
    ) => {

      try {

        const absolute =
          new URL(
            url,
            baseUrl
          ).href;

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


  return html;
}


// ====================================
// CSS REWRITING
// ====================================

function rewriteCss(
  css,
  baseUrl
) {

  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,

    (
      match,
      quote,
      url
    ) => {

      const trimmed =
        url.trim();

      if (
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:")
      ) {
        return match;
      }

      try {

        const absolute =
          new URL(
            trimmed,
            baseUrl
          ).href;

        return (
          `url("${proxyUrl(absolute)}")`
        );

      } catch {

        return match;
      }
    }
  );
}


// ====================================
// SERVER
// ====================================

const server =
  http.createServer(
    async (req, res) => {

      console.log(
        "Request:",
        req.url
      );


      // -------------------------------
      // CORS
      // -------------------------------

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );


      // -------------------------------
      // OPTIONS
      // -------------------------------

      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(
          204,
          {
            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET,HEAD,OPTIONS",

            "Access-Control-Allow-Headers":
              "*"
          }
        );

        res.end();

        return;
      }


      // -------------------------------
      // Homepage
      // -------------------------------

      if (
        req.url === "/"
      ) {

        res.writeHead(
          200,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "BetterProxy backend is running!"
        );

        return;
      }


      // -------------------------------
      // Backend test
      // -------------------------------

      if (
        req.url === "/proxy/test"
      ) {

        res.writeHead(
          200,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "Backend works! 🎉"
        );

        return;
      }


      // -------------------------------
      // Phase 6C test
      // -------------------------------

      if (
        req.url === "/test"
      ) {

        res.writeHead(
          200,
          {
            "Content-Type":
              "text/html; charset=utf-8"
          }
        );

        res.end(
          testPage()
        );

        return;
      }


      // -------------------------------
      // Proxy route
      // -------------------------------

      if (
        !req.url.startsWith(
          "/proxy/"
        )
      ) {

        res.writeHead(
          404,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "Not found"
        );

        return;
      }


      // -------------------------------
      // Decode URL
      // -------------------------------

      const encoded =
        req.url.slice(
          "/proxy/".length
        );

      const target =
        decodeTarget(
          encoded
        );


      if (!target) {

        res.writeHead(
          400,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "Invalid encoded URL"
        );

        return;
      }


      console.log(
        "Decoded target:",
        target
      );


      // -------------------------------
      // Parse target
      // -------------------------------

      let targetURL;

      try {

        targetURL =
          new URL(
            target
          );

      } catch {

        res.writeHead(
          400,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "Invalid target URL"
        );

        return;
      }


      // -------------------------------
      // Allowlist
      // -------------------------------

      if (
        !allowedHosts.includes(
          targetURL.hostname
        )
      ) {

        console.log(
          "Blocked host:",
          targetURL.hostname
        );

        res.writeHead(
          403,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "This site is not enabled yet."
        );

        return;
      }


      // -------------------------------
      // Fetch target
      // -------------------------------

      try {

        const response =
          await fetch(
            targetURL.href,
            {
              redirect:
                "manual",

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


        // -----------------------------
        // Redirects
        // -----------------------------

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

              res.writeHead(
                403,
                {
                  "Content-Type":
                    "text/plain; charset=utf-8"
                }
              );

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

            res.writeHead(
              502,
              {
                "Content-Type":
                  "text/plain; charset=utf-8"
              }
            );

            res.end(
              "Invalid redirect"
            );

            return;
          }
        }


        // -----------------------------
        // HTML
        // -----------------------------

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


          res.end(
            body
          );

          return;
        }


        // -----------------------------
        // CSS
        // -----------------------------

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


          res.end(
            body
          );

          return;
        }


        // -----------------------------
        // Other resources
        // -----------------------------

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


        res.end(
          buffer
        );


      } catch (error) {

        console.error(
          "Fetch error:",
          error
        );


        res.writeHead(
          502,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "Backend fetch failed"
        );
      }
    }
  );


// ====================================
// START
// ====================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Backend listening on port ${PORT}`
    );

  }
);
