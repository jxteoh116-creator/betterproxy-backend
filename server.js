const http = require("http");

const PORT = process.env.PORT || 10000;
const BACKEND_URL = "https://betterproxy-backend.onrender.com";

// ============================================================
// HOSTS ALLOWED THROUGH THE EXTERNAL PROXY
// ============================================================

const allowedHosts = [
  "example.com",
  "www.example.com",
  "iana.org",
  "www.iana.org"
];


// ============================================================
// BASE64 URL ENCODING
// ============================================================

function encodeTarget(url) {
  return Buffer.from(url)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


function decodeTarget(encoded) {
  try {
    let value = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    while (value.length % 4) {
      value += "=";
    }

    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}


function proxyUrl(url) {
  return BACKEND_URL + "/proxy/" + encodeTarget(url);
}


// ============================================================
// READ REQUEST BODY
// ============================================================

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


// ============================================================
// COPY REQUEST HEADERS
// ============================================================

function getForwardHeaders(req) {
  const headers = {};

  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase();

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

  if (!headers["user-agent"]) {
    headers["user-agent"] = "BetterProxy/1.0";
  }

  return headers;
}


// ============================================================
// CLIENT-SIDE FETCH + XHR INTERCEPTOR
// ============================================================

function requestInterceptor(baseUrl) {
  return `
<script>
(function () {

  const BACKEND = ${JSON.stringify(BACKEND_URL)};
  const BASE_URL = ${JSON.stringify(baseUrl)};


  function encodeTarget(url) {

    return btoa(url)
      .replace(/\\\\+/g, "-")
      .replace(/\\\\//g, "_")
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


  // ==========================================================
  // FETCH INTERCEPTOR
  // ==========================================================

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


    // Never intercept our own backend.

    if (
      absoluteUrl === BACKEND ||
      absoluteUrl.startsWith(BACKEND + "/")
    ) {

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


  // ==========================================================
  // XHR INTERCEPTOR
  // ==========================================================

  const originalOpen =
    XMLHttpRequest.prototype.open;


  XMLHttpRequest.prototype.open = function(
    method,
    url,
    async,
    user,
    password
  ) {

    const absoluteUrl =
      resolveTarget(url);


    if (!absoluteUrl) {

      return originalOpen.call(
        this,
        method,
        url,
        async,
        user,
        password
      );

    }


    // Never intercept our own backend.

    if (
      absoluteUrl === BACKEND ||
      absoluteUrl.startsWith(BACKEND + "/")
    ) {

      return originalOpen.call(
        this,
        method,
        url,
        async,
        user,
        password
      );

    }


    if (
      absoluteUrl.startsWith("http://") ||
      absoluteUrl.startsWith("https://")
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


// ============================================================
// INTERNAL METHOD TEST PAGE
// ============================================================

function testPage() {

  return `<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>BetterProxy Method Test</title>

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
  border: 1px solid #ccc;
  white-space: pre-wrap;
}

.success {
  color: green;
}

.failure {
  color: red;
}

</style>

</head>


<body>

<h1>BetterProxy Method Test</h1>

<p>
This page tests the backend's internal method endpoint.
The tests do NOT contact example.com or another external service.
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


${requestInterceptor("https://example.com/")}


<script>

const message =
  document.getElementById("message");


// ==========================================================
// RUN ONE INTERNAL TEST
// ==========================================================

async function testMethod(method) {

  try {

    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json"
      }
    };


    // POST / PUT / PATCH get a body.

    if (
      method === "POST" ||
      method === "PUT" ||
      method === "PATCH"
    ) {

      options.body =
        JSON.stringify({
          test: "BetterProxy",
          method: method,
          message: "Internal method test"
        });

    }


    // IMPORTANT:
    // This is a DIRECT backend request.
    //
    // It does NOT use /proxy/.
    //
    // Therefore it cannot accidentally become:
    // example.com/method-test

    const response =
      await fetch(
        "/method-test",
        options
      );


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

      data =
        JSON.parse(text);

    } catch {

      return (
        method +
        " → SUCCESS\\n" +
        text
      );

    }


    return (
      method +
      " → SUCCESS\\n" +
      "Server received method: " +
      data.method +
      "\\n" +
      "Server received path: " +
      data.path +
      "\\n" +
      "Server received body: " +
      (
        data.body ||
        "(none)"
      )
    );


  } catch (error) {

    return (
      method +
      " → FAILED\\n" +
      error.message
    );

  }

}


// ==========================================================
// INDIVIDUAL BUTTONS
// ==========================================================

document
  .getElementById("postButton")
  .addEventListener(
    "click",
    async function() {

      message.textContent =
        "Testing POST...";


      message.textContent =
        await testMethod("POST");

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
        await testMethod("PUT");

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
        await testMethod("PATCH");

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
        await testMethod("DELETE");

    }
  );


// ==========================================================
// TEST ALL
// ==========================================================

document
  .getElementById("allButton")
  .addEventListener(
    "click",
    async function() {

      message.textContent =
        "Testing all methods...";


      const results = [];


      results.push(
        await testMethod("POST")
      );


      results.push(
        await testMethod("PUT")
      );


      results.push(
        await testMethod("PATCH")
      );


      results.push(
        await testMethod("DELETE")
      );


      message.textContent =
        results.join("\\n\\n");

    }
  );

</script>

</body>

</html>`;
}


// ============================================================
// REWRITE HTML
// ============================================================

function rewriteHtml(html, baseUrl) {

  const interceptor =
    requestInterceptor(baseUrl);


  if (/<head\\b[^>]*>/i.test(html)) {

    html =
      html.replace(
        /<head\\b[^>]*>/i,
        match =>
          match + interceptor
      );

  } else {

    html =
      interceptor + html;

  }


  // ----------------------------------------------------------
  // A HREF
  // ----------------------------------------------------------

  html =
    html.replace(
      /(<a\\b[^>]*?\\bhref\\s*=\\s*["'])([^"']+)(["'])/gi,
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


  // ----------------------------------------------------------
  // IMG SRC
  // ----------------------------------------------------------

  html =
    html.replace(
      /(<img\\b[^>]*?\\bsrc\\s*=\\s*["'])([^"']+)(["'])/gi,
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


  // ----------------------------------------------------------
  // LINK HREF
  // ----------------------------------------------------------

  html =
    html.replace(
      /(<link\\b[^>]*?\\bhref\\s*=\\s*["'])([^"']+)(["'])/gi,
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


  // ----------------------------------------------------------
  // SCRIPT SRC
  // ----------------------------------------------------------

  html =
    html.replace(
      /(<script\\b[^>]*?\\bsrc\\s*=\\s*["'])([^"']+)(["'])/gi,
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


// ============================================================
// REWRITE CSS URLS
// ============================================================

function rewriteCss(css, baseUrl) {

  return css.replace(
    /url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/gi,
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


// ============================================================
// HTTP SERVER
// ============================================================

const server =
  http.createServer(
    async (req, res) => {

      console.log(
        "Request:",
        req.method,
        req.url
      );


      // ======================================================
      // CORS
      // ======================================================

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


      // ======================================================
      // OPTIONS
      // ======================================================

      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(204);
        res.end();

        return;

      }


      // ======================================================
      // HOME
      // ======================================================

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


      // ======================================================
      // TEST PAGE
      // ======================================================

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


      // ======================================================
      // INTERNAL METHOD TEST
      //
      // IMPORTANT:
      // This route is NOT under /proxy/.
      // It directly receives POST/PUT/PATCH/DELETE.
      // ======================================================

      if (
        req.url === "/method-test"
      ) {

        let body =
          Buffer.alloc(0);


        if (
          req.method !== "GET" &&
          req.method !== "HEAD"
        ) {

          body =
            await readRequestBody(req);

        }


        const bodyText =
          body.length > 0
            ? body.toString("utf8")
            : "";


        console.log(
          "METHOD TEST RECEIVED:",
          req.method,
          bodyText
        );


        const result = {
          success: true,
          method: req.method,
          path: req.url,
          body: bodyText
        };


        res.writeHead(
          200,
          {
            "Content-Type":
              "application/json; charset=utf-8"
          }
        );


        res.end(
          JSON.stringify(result)
        );


        return;

      }


      // ======================================================
      // PROXY ROUTE
      // ======================================================

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


        res.end("Not found");

        return;

      }


      // ======================================================
      // DECODE TARGET
      // ======================================================

      const encoded =
        req.url.slice("/proxy/".length);


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


      // ======================================================
      // PARSE TARGET
      // ======================================================

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


      // ======================================================
      // EXTERNAL HOST ALLOWLIST
      // ======================================================

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


      // ======================================================
      // READ PROXY REQUEST BODY
      // ======================================================

      let requestBody =
        null;


      if (
        req.method !== "GET" &&
        req.method !== "HEAD"
      ) {

        requestBody =
          await readRequestBody(req);

      }


      // ======================================================
      // FORWARD EXTERNAL REQUEST
      // ======================================================

      try {

        const headers =
          getForwardHeaders(req);


        const options = {
          method: req.method,
          headers: headers,
          redirect: "manual"
        };


        if (
          requestBody &&
          requestBody.length > 0
        ) {

          options.body =
            requestBody;

        }


        const response =
          await fetch(
            targetURL.href,
            options
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


        // ====================================================
        // REDIRECT
        // ====================================================

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

          return;

        }


        // ====================================================
        // HTML
        // ====================================================

        if (
          contentType.includes("text/html")
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


        // ====================================================
        // CSS
        // ====================================================

        if (
          contentType.includes("text/css") ||
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


        // ====================================================
        // OTHER RESOURCES
        // ====================================================

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
          "Backend fetch failed: " +
          error.message
        );

      }

    }
  );


// ============================================================
// START
// ============================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "BetterProxy backend listening on port " +
      PORT
    );

  }
);
