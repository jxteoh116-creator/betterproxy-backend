const http = require("http");

const PORT = process.env.PORT || 10000;

const BACKEND_URL =
  "https://betterproxy-backend.onrender.com";


// ====================================
// ALLOWED HOSTS
// ====================================

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
// FETCH + XMLHttpRequest INTERCEPTOR
// ====================================

function requestInterceptor() {

  return `
<script>
(function () {

  // ==================================
  // FETCH INTERCEPTION
  // ==================================

  const originalFetch = window.fetch;

  const BACKEND =
    "${BACKEND_URL}";


  function encodeTarget(url) {

    return btoa(url)
      .replace(/\\\\+/g, "-")
      .replace(/\\\\//g, "_")
      .replace(/=+$/, "");

  }


  window.fetch = function(input, init) {

    let url;

    if (typeof input === "string") {

      url = input;

    } else if (input && input.url) {

      url = input.url;

    } else {

      return originalFetch(
        input,
        init
      );

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


  // ==================================
  // XMLHttpRequest INTERCEPTION
  // ==================================

  const originalOpen =
    XMLHttpRequest.prototype.open;


  const originalSend =
    XMLHttpRequest.prototype.send;


  XMLHttpRequest.prototype.open =
    function(
      method,
      url,
      async,
      user,
      password
    ) {

      let finalUrl = url;


      try {

        // Convert relative URLs into
        // absolute URLs.

        finalUrl =
          new URL(
            url,
            window.location.href
          ).href;


      } catch (error) {

        console.warn(
          "BetterProxy could not resolve XHR URL:",
          url
        );

      }


      if (
        typeof finalUrl === "string" &&
        (
          finalUrl.startsWith("http://") ||
          finalUrl.startsWith("https://")
        )
      ) {

        finalUrl =
          BACKEND +
          "/proxy/" +
          encodeTarget(
            finalUrl
          );


        console.log(
          "BetterProxy XHR:",
          url
        );

      }


      return originalOpen.call(
        this,
        method,
        finalUrl,
        async,
        user,
        password
      );

    };


  // Keep the original send()
  // behavior.

  XMLHttpRequest.prototype.send =
    function(body) {

      return originalSend.call(
        this,
        body
      );

    };


  console.log(
    "BetterProxy request interceptors installed"
  );

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
    BetterProxy Request Test
  </title>

  <style>

    body {
      font-family: sans-serif;
      padding: 30px;
    }

    button {
      padding: 10px 16px;
      margin-right: 10px;
      cursor: pointer;
    }

    #message {
      margin-top: 20px;
      white-space: pre-wrap;
    }

  </style>

</head>


<body>

  <h1>
    BetterProxy Request Test
  </h1>


  <p id="message">
    Ready.
  </p>


  <button id="fetchButton">
    Test fetch()
  </button>


  <button id="xhrButton">
    Test XMLHttpRequest
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


    // ==================================
    // FETCH TEST INTERCEPTOR
    // ==================================

    window.fetch =
      function(input, init) {

        let url;


        if (
          typeof input === "string"
        ) {

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


    // ==================================
    // XHR TEST INTERCEPTOR
    // ==================================

    const originalOpen =
      XMLHttpRequest.prototype.open;


    XMLHttpRequest.prototype.open =
      function(
        method,
        url,
        async,
        user,
        password
      ) {

        let finalUrl;


        try {

          finalUrl =
            new URL(
              url,
              window.location.href
            ).href;

        } catch {

          finalUrl = url;

        }


        if (
          typeof finalUrl === "string" &&
          (
            finalUrl.startsWith("http://") ||
            finalUrl.startsWith("https://")
          )
        ) {

          finalUrl =
            BACKEND +
            "/proxy/" +
            encodeTarget(
              finalUrl
            );

        }


        return originalOpen.call(
          this,
          method,
          finalUrl,
          async,
          user,
          password
        );

      };


    // ==================================
    // FETCH TEST
    // ==================================

    document
      .getElementById("fetchButton")
      .addEventListener(
        "click",
        async function() {

          const message =
            document.getElementById(
              "message"
            );


          message.textContent =
            "Testing fetch()...";


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
              "fetch() worked!\\n" +
              "Received " +
              text.length +
              " characters.";

          } catch (error) {

            console.error(error);


            message.textContent =
              "fetch() failed: " +
              error.message;

          }

        }
      );


    // ==================================
    // XHR TEST
    // ==================================

    document
      .getElementById("xhrButton")
      .addEventListener(
        "click",
        function() {

          const message =
            document.getElementById(
              "message"
            );


          message.textContent =
            "Testing XMLHttpRequest...";


          const xhr =
            new XMLHttpRequest();


          xhr.open(
            "GET",
            "https://example.com/",
            true
          );


          xhr.onload =
            function() {

              if (
                xhr.status >= 200 &&
                xhr.status < 300
              ) {

                message.textContent =
                  "XMLHttpRequest worked!\\n" +
                  "Received " +
                  xhr.responseText.length +
                  " characters.";

              } else {

                message.textContent =
                  "XMLHttpRequest failed: HTTP " +
                  xhr.status;

              }

            };


          xhr.onerror =
            function() {

              message.textContent =
                "XMLHttpRequest failed.";

            };


          xhr.send();

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

  // Inject both request interceptors.

  const interceptor =
    requestInterceptor();


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


  // --------------------------------
  // Links
  // --------------------------------

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
  );


  // --------------------------------
  // Images
  // --------------------------------

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


  // --------------------------------
  // Stylesheets
  // --------------------------------

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


  // --------------------------------
  // External JavaScript
  // --------------------------------

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


      // --------------------------------
      // CORS
      // --------------------------------

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );


      // --------------------------------
      // OPTIONS
      // --------------------------------

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


      // --------------------------------
      // Homepage
      // --------------------------------

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


      // --------------------------------
      // Backend test
      // --------------------------------

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


      // --------------------------------
      // Test page
      // --------------------------------

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


      // --------------------------------
      // Proxy route
      // --------------------------------

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


      // --------------------------------
      // Decode target
      // --------------------------------

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


      // --------------------------------
      // Parse target
      // --------------------------------

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


      // --------------------------------
      // Allowlist
      // --------------------------------

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


      // --------------------------------
      // Fetch target
      // --------------------------------

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


          res.end(
            body
          );


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


          res.end(
            body
          );


          return;

        }


        // --------------------------------
        // Other resources
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
// START SERVER
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
