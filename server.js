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

    return Buffer.from(base64, "base64").toString("utf8");
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
// REQUEST INTERCEPTOR
// ====================================

function requestInterceptor(baseUrl) {

  return `
<script>
(function () {

  const BACKEND = ${JSON.stringify(BACKEND_URL)};
  const BASE_URL = ${JSON.stringify(baseUrl)};


  function encodeTarget(url) {

    return btoa(url)
      .replace(/\\+/g, "-")
      .replace(/\\//g, "_")
      .replace(/=+$/, "");

  }


  function resolveTarget(input) {

    try {

      return new URL(
        input,
        BASE_URL
      ).href;

    } catch {

      return null;

    }

  }


  // ==================================
  // FETCH
  // ==================================

  const originalFetch = window.fetch;

  window.fetch = function(input, init) {

    let originalUrl;


    if (typeof input === "string") {

      originalUrl = input;

    } else if (input && input.url) {

      originalUrl = input.url;

    } else {

      return originalFetch(input, init);

    }


    const absoluteUrl =
      resolveTarget(originalUrl);


    if (!absoluteUrl) {

      return originalFetch(input, init);

    }


    if (
      absoluteUrl.startsWith("http://") ||
      absoluteUrl.startsWith("https://")
    ) {

      const proxied =
        BACKEND +
        "/proxy/" +
        encodeTarget(absoluteUrl);


      console.log(
        "BetterProxy fetch:",
        originalUrl,
        "=>",
        absoluteUrl
      );


      return originalFetch(
        proxied,
        init
      );

    }


    return originalFetch(input, init);

  };


  // ==================================
  // XMLHttpRequest
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

      const absoluteUrl =
        resolveTarget(url);


      if (
        absoluteUrl &&
        (
          absoluteUrl.startsWith("http://") ||
          absoluteUrl.startsWith("https://")
        )
      ) {

        console.log(
          "BetterProxy XHR:",
          url,
          "=>",
          absoluteUrl
        );


        const proxied =
          BACKEND +
          "/proxy/" +
          encodeTarget(absoluteUrl);


        return originalOpen.call(
          this,
          method,
          proxied,
          async,
          user,
          password
        );

      }


      return originalOpen.call(
        this,
        method,
        url,
        async,
        user,
        password
      );

    };


  console.log(
    "BetterProxy relative-request interceptor installed"
  );

})();
</script>
`;

}


// ====================================
// CONTROLLED RELATIVE-REQUEST TEST
// ====================================

function testPage() {

  const simulatedOrigin =
    "https://example.com/";


  return `<!DOCTYPE html>
<html>

<head>

  <meta charset="UTF-8">

  <base href="https://example.com/">

  <title>
    BetterProxy Relative Request Test
  </title>

  <style>

    body {
      font-family: sans-serif;
      padding: 30px;
      line-height: 1.5;
    }

    button {
      padding: 10px 16px;
      margin: 5px;
      cursor: pointer;
    }

    #message {
      margin-top: 20px;
      padding: 15px;
      white-space: pre-wrap;
      border: 1px solid #ccc;
    }

  </style>

</head>


<body>

  <h1>
    BetterProxy Relative Request Test
  </h1>


  <p>
    The requests below use relative URLs.
  </p>


  <button id="fetchButton">
    Test relative fetch()
  </button>


  <button id="xhrButton">
    Test relative XMLHttpRequest
  </button>


  <button id="bothButton">
    Test Both
  </button>


  <div id="message">
    Ready.
  </div>


  ${requestInterceptor(simulatedOrigin)}


  <script>

    const BACKEND =
      ${JSON.stringify(BACKEND_URL)};


    const message =
      document.getElementById(
        "message"
      );


    function encodeTarget(url) {

      return btoa(url)
        .replace(/\\+/g, "-")
        .replace(/\\//g, "_")
        .replace(/=+$/, "");

    }


    function show(text) {

      message.textContent = text;

    }


    // ==================================
    // RELATIVE FETCH
    // ==================================

    async function testFetch() {

      try {

        const response =
          await fetch(
            "/"
          );


        if (!response.ok) {

          throw new Error(
            "HTTP " +
            response.status
          );

        }


        const text =
          await response.text();


        return (
          "Relative fetch(): SUCCESS\\n" +
          "Received " +
          text.length +
          " characters."
        );

      } catch (error) {

        return (
          "Relative fetch(): FAILED\\n" +
          error.message
        );

      }

    }


    // ==================================
    // RELATIVE XHR
    // ==================================

    function testXHR() {

      return new Promise(
        function(resolve) {

          const xhr =
            new XMLHttpRequest();


          xhr.open(
            "GET",
            "/",
            true
          );


          xhr.onload =
            function() {

              if (
                xhr.status >= 200 &&
                xhr.status < 300
              ) {

                resolve(
                  "Relative XMLHttpRequest: SUCCESS\\n" +
                  "Received " +
                  xhr.responseText.length +
                  " characters."
                );

              } else {

                resolve(
                  "Relative XMLHttpRequest: FAILED\\n" +
                  "HTTP " +
                  xhr.status
                );

              }

            };


          xhr.onerror =
            function() {

              resolve(
                "Relative XMLHttpRequest: FAILED\\n" +
                "Network error"
              );

            };


          xhr.send();

        }
      );

    }


    // ==================================
    // BUTTONS
    // ==================================

    document
      .getElementById("fetchButton")
      .addEventListener(
        "click",
        async function() {

          show(
            "Running relative fetch()..."
          );


          show(
            await testFetch()
          );

        }
      );


    document
      .getElementById("xhrButton")
      .addEventListener(
        "click",
        async function() {

          show(
            "Running relative XMLHttpRequest..."
          );


          show(
            await testXHR()
          );

        }
      );


    document
      .getElementById("bothButton")
      .addEventListener(
        "click",
        async function() {

          show(
            "Running both relative-request tests..."
          );


          const fetchResult =
            await testFetch();


          const xhrResult =
            await testXHR();


          show(
            fetchResult +
            "\\n\\n" +
            xhrResult
          );

        }
      );

  </script>

</body>

</html>`;
}


// ====================================
// HTML REWRITING
// ====================================

function rewriteHtml(html, baseUrl) {

  const interceptor =
    requestInterceptor(baseUrl);


  if (/<head\b[^>]*>/i.test(html)) {

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


  // Links

  html = html.replace(
    /(<a\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi,
    (match, start, url, end) => {

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


  // Images

  html = html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
    (match, start, url, end) => {

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


  // Stylesheets

  html = html.replace(
    /(<link\b[^>]*?\bhref\s*=\s*["'])([^"']+)(["'])/gi,
    (match, start, url, end) => {

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


  // Scripts

  html = html.replace(
    /(<script\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
    (match, start, url, end) => {

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

function rewriteCss(css, baseUrl) {

  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, quote, url) => {

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


      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );


      // OPTIONS

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


      // HOME

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


      // TEST

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


      // PROXY ROUTE

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


      // ALLOWLIST

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


        // REDIRECTS

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

        }


        // HTML

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


        // CSS

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


        // OTHER RESOURCES

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
