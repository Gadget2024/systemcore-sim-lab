import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

function addresses() {
  const all = [];
  for (const [adapter, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      all.push({
        adapter,
        address: entry.address,
        kind: entry.address.startsWith("100.") ? "tailscale" : "lan"
      });
    }
  }
  return all;
}

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/api/health") {
    return json(response, 200, { ok: true, service: "systemcore-sim" });
  }

  if (url.pathname === "/api/network") {
    return json(response, 200, { port, addresses: addresses() });
  }

  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    return json(response, 403, { error: "Forbidden" });
  }

  try {
    const contents = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mime.get(extname(filePath)) ?? "application/octet-stream",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff"
    });
    if (request.method === "HEAD") return response.end();
    response.end(contents);
  } catch (error) {
    if (error?.code === "ENOENT") return json(response, 404, { error: "Not found" });
    console.error(error);
    return json(response, 500, { error: "Server error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`SystemCore Sim running at http://localhost:${port}`);
  for (const item of addresses()) {
    console.log(`${item.kind === "tailscale" ? "Tailscale" : "Network"}: http://${item.address}:${port}`);
  }
});
