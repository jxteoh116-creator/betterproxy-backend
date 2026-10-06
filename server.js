const http = require("http");

const PORT = process.env.PORT || 10000;
const BACKEND_URL = "https://betterproxy-backend.onrender.com";

const dns = require("dns").promises;
const net = require("net");

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();

  return (
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:")
  );
}

async function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  if (net.isIP(host) === 4) {
    return isPrivateIPv4(host);
  }

  if (net.isIP(host) === 6) {
    return isPrivateIPv6(host);
  }

  try {
    const addresses =
      await dns.lookup(host, {
        all: true
      });

    return addresses.some(address => {

      if (address.family === 4) {
        return isPrivateIPv4(address.address);
      }

      if (address.family === 6) {
        return isPrivateIPv6(address.address);
      }

      return true;

    });

  } catch {
    return true;
  }
}

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

    while (value.length % 4 !== 0) {
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

function readBody(req) {
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

function forwardHeaders(req) {
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

  return headers;
}


// ============================================================
// INTERNAL METHOD TEST PAGE
// ============================================================

function testPage() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>BetterProxy Method Test</title>

<style>
body {
  font-family: sans-serif;
  padding: 30px;
}

button {
  padding: 10px 15px;
  margin: 5px;
}

pre {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ccc;
  white-space: pre-wrap;
}
</style>
</head>

<body>

<h1>BetterProxy Method Test</h1>

<button onclick="runTest('POST')">POST</button>
<button onclick="runTest('PUT')">PUT</button>
<button onclick="runTest('PATCH')">PATCH</button>
<button onclick="runTest('DELETE')">DELETE</button>
<button onclick="runAll()">Test All</button>

<pre id="result">Ready.</pre>

<script>

async function runTest(method) {

  const result = document.getElementById("result");

  result.textContent = "Testing " + method + "...";

  try {

    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (
      method === "POST" ||
      method === "PUT" ||
      method === "PATCH"
    ) {

      options.body = JSON.stringify({
        test: "BetterProxy",
        method: method
      });

    }

    const response = await fetch(
      "/method-test",
      options
    );

    const text = await response.text();

    if (!response.ok) {

      result.textContent =
        method +
        " → FAILED: HTTP " +
        response.status +
        "\\n\\n" +
        text;

      return false;
    }

    result.textContent =
      method +
      " → SUCCESS\\n\\n" +
      text;

    return true;

  } catch (error) {

    result.textContent =
      method +
      " → FAILED: " +
      error.message;

    return false;
  }
}


async function runAll() {

  const result =
    document.getElementById("result");

  result.textContent =
    "Running all tests...";

  const methods = [
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
  ];

  const output = [];

  for (const method of methods) {

    try {

      const options = {
        method: method,
        headers: {
          "Content-Type": "application/json"
        }
      };

      if (
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH"
      ) {

        options.body = JSON.stringify({
          test: "BetterProxy",
          method: method
        });

      }

      const response = await fetch(
        "/method-test",
        options
      );

      const text = await response.text();

      if (response.ok) {

        output.push(
          method +
          " → SUCCESS\\n" +
          text
        );

      } else {

        output.push(
          method +
          " → FAILED: HTTP " +
          response.status +
          "\\n" +
          text
        );

      }

    } catch (error) {

      output.push(
        method +
        " → FAILED: " +
        error.message
      );

    }
  }

  result.textContent =
    output.join("\\n\\n");

}

</script>

</body>
</html>`;
}


// ============================================================
// SERVER
// ============================================================

const server = http.createServer(async (req, res) => {

  console.log(
    "Request:",
    req.method,
    req.url
  );


  // ----------------------------------------------------------
  // CORS
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // OPTIONS
  // ----------------------------------------------------------

  if (req.method === "OPTIONS") {

    res.writeHead(204);
    res.end();

    return;
  }


  // ----------------------------------------------------------
  // HOME
  // ----------------------------------------------------------

  if (
    req.method === "GET" &&
    req.url === "/"
  ) {

    res.writeHead(200, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end(
      "BetterProxy backend is running!"
    );

    return;
  }


  // ----------------------------------------------------------
  // TEST PAGE
  // ----------------------------------------------------------

  if (
    req.method === "GET" &&
    req.url === "/test"
  ) {

    res.writeHead(200, {
      "Content-Type":
        "text/html; charset=utf-8"
    });

    res.end(
      testPage()
    );

    return;
  }


  // ----------------------------------------------------------
  // INTERNAL METHOD TEST
  // ----------------------------------------------------------

  if (req.url === "/method-test") {

    let body = "";

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {

      const buffer =
        await readBody(req);

      body =
        buffer.toString("utf8");
    }


    console.log(
      "METHOD TEST:",
      req.method,
      body
    );


    const result = {
      success: true,
      method: req.method,
      path: req.url,
      body: body
    };


    res.writeHead(200, {
      "Content-Type":
        "application/json; charset=utf-8"
    });

    res.end(
      JSON.stringify(result, null, 2)
    );

    return;
  }


  // ----------------------------------------------------------
  // PROXY
  // ----------------------------------------------------------

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


  const encoded =
    req.url.substring("/proxy/".length);

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


  // ----------------------------------------------------------
  // HOST ALLOWLIST
  // ----------------------------------------------------------

if (
  targetURL.protocol !== "http:" &&
  targetURL.protocol !== "https:"
) {

  res.writeHead(400, {
    "Content-Type":
      "text/plain; charset=utf-8"
  });

  res.end(
    "Only HTTP and HTTPS URLs are supported."
  );

  return;
}


if (
  await isBlockedHost(
    targetURL.hostname
  )
) {

  console.log(
    "Blocked private/internal host:",
    targetURL.hostname
  );

  res.writeHead(403, {
    "Content-Type":
      "text/plain; charset=utf-8"
  });

  res.end(
    "Private or internal destinations are blocked."
  );

  return;
}


  // ----------------------------------------------------------
  // BODY
  // ----------------------------------------------------------

  let body = null;

  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {

    body =
      await readBody(req);
  }


  // ----------------------------------------------------------
  // FORWARD
  // ----------------------------------------------------------

  try {

    const options = {
      method: req.method,
      headers: forwardHeaders(req),
      redirect: "manual"
    };


    if (
      body &&
      body.length > 0
    ) {

      options.body = body;
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


    // --------------------------------------------------------
    // REDIRECT
    // --------------------------------------------------------

    if (
      response.status >= 300 &&
      response.status < 400
    ) {

      const location =
        response.headers.get(
          "location"
        );


      if (location) {

        const redirectTarget =
          new URL(
            location,
            targetURL.href
          ).href;


        res.writeHead(
          response.status,
          {
            "Location":
              proxyUrl(
                redirectTarget
              )
          }
        );

        res.end();

        return;
      }
    }


    // --------------------------------------------------------
    // RESPONSE BODY
    // --------------------------------------------------------

    const responseBuffer =
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
      responseBuffer
    );

  } catch (error) {

    console.error(
      "Proxy error:",
      error
    );


    res.writeHead(502, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });


    res.end(
      "Backend fetch failed: " +
      error.message
    );

  }

});


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
