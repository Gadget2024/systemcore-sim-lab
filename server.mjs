import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { Nt4Bridge } from "./lib/nt4-bridge.mjs";

// Resolve paths relative to this file so startup does not depend on the terminal folder.
const projectDirectory = fileURLToPath(new URL(".", import.meta.url));
// PORT can override 4173, for example when another simulator is already running.
const serverPort = Number.parseInt(process.env.PORT ?? "4173", 10);

// Tell the browser how to interpret each kind of file (HTML, CSS, JavaScript, etc.).
const contentTypesByExtension = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".md", "text/plain; charset=utf-8"]
]);

// Collect non-localhost IPv4 addresses for the phone-access hint.
// The 100.* check is a display heuristic, not authentication or access control.
function getNetworkAddresses() {
  const networkAddresses = [];
  for (const [adapterName, adapterAddresses] of Object.entries(networkInterfaces())) {
    for (const adapterAddress of adapterAddresses ?? []) {
      if (adapterAddress.family !== "IPv4" || adapterAddress.internal) continue;
      networkAddresses.push({
        adapter: adapterName,
        address: adapterAddress.address,
        kind: adapterAddress.address.startsWith("100.") ? "tailscale" : "lan"
      });
    }
  }
  return networkAddresses;
}

// API responses use JSON; static project files are served separately below.
function sendJson(response, statusCode, responseBody) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(responseBody));
}

const labBridge = new Nt4Bridge({ port: Number(process.env.NT_PORT ?? 5810) });
const loopbackAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const server = createServer(async (request, response) => {
  let requestUrl;
  try { requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`); }
  catch { return sendJson(response, 400, { error: "Invalid address" }); }

  if (requestUrl.pathname.startsWith("/api/lab/")) {
    // Learning controls only operate from a browser on this computer, with the same origin.
    if (!loopbackAddresses.has(request.socket.remoteAddress)
        || !["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname)
        || (request.headers.origin && request.headers.origin !== requestUrl.origin)) {
      return sendJson(response, 403, { error: "Open the learning lab on the server computer." });
    }
    if (requestUrl.pathname === "/api/lab/events" && request.method === "GET") {
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      const send = (snapshot) => response.write(`data: ${JSON.stringify(snapshot)}\n\n`);
      send(labBridge.snapshot());
      labBridge.on("snapshot", send);
      request.on("close", () => labBridge.off("snapshot", send));
      return;
    }
    if (requestUrl.pathname === "/api/lab/status" && request.method === "GET") {
      return sendJson(response, 200, labBridge.snapshot());
    }
    if (requestUrl.pathname === "/api/lab/controls" && request.method === "POST") {
      if (!request.headers["content-type"]?.startsWith("application/json")) {
        return sendJson(response, 415, { error: "Use JSON controls" });
      }
      try {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (Buffer.byteLength(body) > 2048) return sendJson(response, 413, { error: "Controls too large" });
        }
        labBridge.acceptControls(JSON.parse(body));
        return sendJson(response, 200, { ok: true });
      } catch (error) {
        return sendJson(response, error.status ?? 400, { error: error.message });
      }
    }
    return sendJson(response, 405, { error: "Unsupported lab request" });
  }

  // Small API routes used by diagnostics and the browser's network hint.
  if (requestUrl.pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, service: "systemcore-sim" });
  }

  if (requestUrl.pathname === "/api/network") {
    return sendJson(response, 200, { port: server.address().port, addresses: getNetworkAddresses() });
  }

  // Visiting / serves index.html. Other URLs map to files in the project folder.
  let requestedFile;
  try { requestedFile = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname.slice(1)); }
  catch { return sendJson(response, 400, { error: "Invalid path" }); }
  const normalizedRelativePath = normalize(requestedFile).replace(/^(\.\.[/\\])+/, "").replaceAll("\\", "/");
  // Only publish browser assets and the learning guide, never Git, dependencies, or build files.
  const publicFiles = new Set(["index.html", "learn.html", "styles.css", "learning.css", "docs/learning-lab.md"]);
  if (!publicFiles.has(normalizedRelativePath)
      && !/^src\/[a-zA-Z0-9-]+\.(?:js|mjs)$/.test(normalizedRelativePath.replaceAll("\\", "/"))) {
    return sendJson(response, 404, { error: "Not found" });
  }
  const absoluteFilePath = join(projectDirectory, normalizedRelativePath);

  if (!absoluteFilePath.startsWith(projectDirectory)) {
    return sendJson(response, 403, { error: "Forbidden" });
  }

  try {
    const fileContents = await readFile(absoluteFilePath);
    response.writeHead(200, {
      "content-type": contentTypesByExtension.get(extname(absoluteFilePath)) ?? "application/octet-stream",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff"
    });
    // HEAD asks for headers only; GET also receives the file contents.
    if (request.method === "HEAD") return response.end();
    response.end(fileContents);
  } catch (error) {
    if (error?.code === "ENOENT") return sendJson(response, 404, { error: "Not found" });
    console.error(error);
    return sendJson(response, 500, { error: "Server error" });
  }
});

// Listen on all IPv4 interfaces so other devices can reach the simulator.
// This learning server has no login; keep it on a trusted/private network.
server.listen(serverPort, "0.0.0.0", () => {
  const listeningPort = server.address().port;
  console.log(`SystemCore Sim running at http://localhost:${listeningPort}`);
  for (const networkAddress of getNetworkAddresses()) {
    console.log(`${networkAddress.kind === "tailscale" ? "Tailscale" : "Network"}: http://${networkAddress.address}:${listeningPort}`);
  }
});

// Cleanly disconnect the desktop bridge when the web server closes.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { labBridge.close(); server.closeAllConnections(); server.close(() => process.exit(0)); });
}
