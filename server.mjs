import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

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
  [".svg", "image/svg+xml"]
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

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  // Small API routes used by diagnostics and the browser's network hint.
  if (requestUrl.pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, service: "systemcore-sim" });
  }

  if (requestUrl.pathname === "/api/network") {
    return sendJson(response, 200, { port: serverPort, addresses: getNetworkAddresses() });
  }

  // Visiting / serves index.html. Other URLs map to files in the project folder.
  const requestedFile = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname.slice(1));
  const normalizedRelativePath = normalize(requestedFile).replace(/^(\.\.[/\\])+/, "");
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
  console.log(`SystemCore Sim running at http://localhost:${serverPort}`);
  for (const networkAddress of getNetworkAddresses()) {
    console.log(`${networkAddress.kind === "tailscale" ? "Tailscale" : "Network"}: http://${networkAddress.address}:${serverPort}`);
  }
});
