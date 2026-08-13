const http = require("http");

const PORT = process.env.PORT || 10000;
const BACKEND_URL = "https://betterproxy-backend.onrender.com";


// ====================================
// ALLOWED HOSTS
// ====================================

const allowedHosts = [
  "example.com",
  "www.example.com",
  "example.org",
  "www.example.org",
  "iana.org",
  "www.iana.org",
  "httpbin.org",
  "www.httpbin.org"
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
  return BACKEND_URL + "/proxy/" + encodeTarget(url);
}


// ====================================
// READ REQUEST BODY
// ====================================

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}


// ====================================
// FORWARDABLE HEADERS
// ====================================

function getForwardHeaders(req) {
  const headers = {};

  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase();

    // These are controlled by fetch/Node.
    if (
      lower === "host" ||
      lower === "content-length" ||
      lower === "connection"
    ) {
      continue;
    }

    if (value !== undefined) {
      headers[name] = value;
    }
  }

  // Use a normal user agent if the browser didn't provide one.
  if (!headers["user-agent"]) {
    headers["user-agent"] = "BetterProxy/1.0";
  }

  return headers;
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
      return new URL(input, BASE_URL).href;
    } catch {
      return null;
    }
  }


  // ==================================
  // FETCH INTERCEPTOR
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

    const absoluteUrl = resolveTarget(originalUrl);

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

      return originalFetch(proxied, init);
    }

    return originalFetch(input, init);
  };


  // ==================================
  // XHR INTERCEPTOR
  // ==================================

  const originalOpen =
    XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open =
    function(method, url, async, user, password) {

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
    "BetterProxy fetch + XHR interceptors installed"
  );

})();
</script>
`;
}


// ====================================
// CONTROLLED METHOD TEST
// ====================================

function testPage() {

  const simulatedOrigin =
    "https://httpbin.org/";


  return `<!DOCTYPE html>
<html>

<head>

  <meta charset="UTF-8">

  <base href="https://httpbin.org/">

  <title>
    BetterProxy Method Test
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
    BetterProxy Method Test
  </h1>

  <p>
    These tests verify that BetterProxy preserves
    HTTP methods and request bodies.
  </p>


  <button id="postButton">
    Test POST
  </button>

  <button id="putButton">
    Test PUT
  </button>

  <button id="patchButton">
    Test PATCH
  </button>

  <button id="deleteButton">
    Test DELETE
  </button>

  <button id="allButton">
    Test All
  </button>


  <div id="message">
    Ready.
  </div>


  ${requestInterceptor(simulatedOrigin)}


  <script>

    const message =
      document.getElementById("message");


    // ==================================
    // TEST FETCH METHOD
    // ==================================

    async function testFetchMethod(method) {

      try {

        const options = {
          method: method,
          headers: {
            "Content-Type":
              "application/json"
          }
        };


        if (method !== "DELETE") {

          options.body =
            JSON.stringify({
              test: "BetterProxy",
              method: method,
              message: "Hello from BetterProxy"
            });

        }


        const response =
          await fetch("/anything", options);


        const text =
          await response.text();


        if (!response.ok) {

          return (
            method +
            " → FAILED: HTTP " +
            response.status +
            "\\n" +
            text
          );

        }


        let data;

        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }


        if (data) {

          return (
            method +
            " → SUCCESS\\n" +
            "Server saw method: " +
            data.method +
            "\\n" +
            "Server saw body: " +
            (
              data.json
                ? JSON.stringify(data.json)
                : "(none)"
            )
          );

        }


        return (
          method +
          " → SUCCESS\\n" +
          text
        );

      } catch (error) {

        return (
          method +
          " → FAILED\\n" +
          error.message
        );

      }

    }


    // ==================================
    // BUTTONS
    // ==================================

    document
      .getElementById("postButton")
      .addEventListener(
        "click",
        async function() {

          message.textContent =
            "Testing POST...";

          message.textContent =
            await testFetchMethod("POST");

        }
      );


    document
      .getElementById("putButton")
      .addEventListener(
        "click",
        async function() {

          message.textContent =
            "Testing PUT...";

          message.textContent =
            await testFetchMethod("PUT");

        }
      );


    document
      .getElementById("patchButton")
      .addEventListener(
        "click",
        async function() {

          message.textContent =
            "Testing PATCH...";

          message.textContent =
            await testFetchMethod("PATCH");

        }
      );


    document
      .getElementById("deleteButton")
      .addEventListener(
        "click",
        async function() {

          message.textContent =
            "Testing DELETE...";

          message.textContent =
            await testFetchMethod("DELETE");

        }
      );


    document
      .getElementById("allButton")
      .addEventListener(
        "click",
        async function() {

          message.textContent =
            "Testing all methods...";


          const post =
            await testFetchMethod("POST");

          const put =
            await testFetchMethod("PUT");

          const patch =
            await testFetchMethod("PATCH");

          const del =
            await testFetchMethod("DELETE");


          message.textContent =
            post +
            "\\n\\n" +
            put +
            "\\n\\n" +
            patch +
            "\\n\\n" +
            del;

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


  if (/<head\\b[^>]*>/i.test(html)) {

    html =
      html.replace(
        /<head\\b[^>]*>/i,
        match => match + interceptor
      );

  } else {

    html =
      interceptor + html;

  }


  // Links

  html = html.replace(
    /(<a\\b[^>]*?\\bhref\\s*=\\s*["'])([^"']+)(["'])/gi,
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
  );


  // Images

  html = html.replace(
    /(<img\\b[^>]*?\\bsrc\\s*=\\s*["'])([^"']+)(["'])/gi,
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


  // Stylesheets

  html = html.replace(
    /(<link\\b[^>]*?\\bhref\\s*=\\s*["'])([^"']+)(["'])/gi,
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


  // External scripts

  html = html.replace(
    /(<script\\b[^>]*?\\bsrc\\s*=\\s*["'])([^"']+)(["'])/gi,
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


  return html;
}


// ====================================
// CSS REWRITING
// ====================================

function rewriteCss(css, baseUrl) {

  return css.replace(
    /url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/gi,
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
          'url("' +
          proxyUrl(absolute) +
          '")'
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
        req.method,
        req.url
      );


      // ==================================
      // CORS
      // ==================================

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Headers",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS"
      );


      // ==================================
      // OPTIONS
      // ==================================

      if (req.method === "OPTIONS") {

        res.writeHead(204);
        res.end();

        return;

      }


      // ==================================
      // HOME
      // ==================================

      if (
        req.method === "GET" &&
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


      // ==================================
      // METHOD TEST PAGE
      // ==================================

      if (
        req.method === "GET" &&
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


      // ==================================
      // PROXY ROUTE
      // ==================================

      if (
        !req.url.startsWith("/proxy/")
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


      // ==================================
      // DECODE TARGET
      // ==================================

      const encoded =
        req.url.slice(
          "/proxy/".length
        );


      const target =
        decodeTarget(encoded);


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


      // ==================================
      // PARSE URL
      // ==================================

      let targetURL;

      try {

        targetURL =
          new URL(target);

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


      // ==================================
      // ALLOWLIST
      // ==================================

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


      // ==================================
      // READ BODY
      // ==================================

      let requestBody = null;

      if (
        req.method !== "GET" &&
        req.method !== "HEAD"
      ) {

        requestBody =
          await readRequestBody(req);

      }


      // ==================================
      // FORWARD REQUEST
      // ==================================

      try {

        const headers =
          getForwardHeaders(req);


        const fetchOptions = {
          method: req.method,
          headers: headers,
          redirect: "manual"
        };


        if (
          requestBody &&
          requestBody.length > 0
        ) {

          fetchOptions.body =
            requestBody;

        }


        const response =
          await fetch(
            targetURL.href,
            fetchOptions
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


        // ==================================
        // REDIRECTS
        // ==================================

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


        // ==================================
        // HTML
        // ==================================

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


        // ==================================
        // CSS
        // ==================================

        if (
          contentType.includes(
            "text/css"
          ) ||
          targetURL.pathname.endsWith(".css")
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


        // ==================================
        // OTHER RESOURCES
        // ==================================

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
