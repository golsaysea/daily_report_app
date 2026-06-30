const http = require("http");
const https = require("https");

const maxBodyBytes = 8 * 1024 * 1024;
const requestTimeoutMs = 30000;

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function normalizeEndpoint(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  text = text.replace(/\/+$/, "");
  text = text.replace(/\/api\/cloud-data$/i, "").replace(/\/cloud-data$/i, "");
  text = text.replace(/\/api\/app-auth$/i, "").replace(/\/app-auth$/i, "");
  return text.replace(/\/+$/, "");
}

function workerEndpoint() {
  return normalizeEndpoint(
    process.env.CLOUD_SYNC_ENDPOINT ||
    process.env.CLOUDFLARE_SYNC_URL ||
    process.env.CLOUDFLARE_WORKER_URL ||
    ""
  );
}

function normalizePath(value) {
  const path = String(value || "").trim();
  return path.startsWith("/") ? path : "/" + path;
}

function isAllowedPath(path) {
  return ["/api/cloud-data", "/cloud-data", "/api/app-auth", "/app-auth"].includes(path);
}

function forwardedHeaders(req, body) {
  const headers = { Accept: "application/json" };
  const contentType = req.headers["content-type"];
  if (contentType) headers["Content-Type"] = String(contentType);
  const teamToken = req.headers["x-team-token"];
  if (teamToken) headers["X-Team-Token"] = String(teamToken);
  const appPassword = req.headers["x-app-password"];
  if (appPassword) headers["X-App-Password"] = String(appPassword);
  if (body && body.length) headers["Content-Length"] = Buffer.byteLength(body);
  return headers;
}

async function readRawBody(req) {
  if (req.body && Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (req.body && typeof req.body === "object") return Buffer.from(JSON.stringify(req.body));
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function requestUpstream(url, method, headers, body) {
  const target = new URL(url);
  const client = target.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const request = client.request(target, { method, headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        status: response.statusCode || 502,
        headers: response.headers || {},
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.setTimeout(requestTimeoutMs, () => {
      request.destroy(new Error("Cloudflare Worker request timed out."));
    });
    request.on("error", reject);
    if (body && body.length && method !== "GET") request.write(body);
    request.end();
  });
}

function sendUpstream(res, upstream) {
  const contentType = String(upstream.headers["content-type"] || "");
  let body = upstream.body || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    try {
      JSON.parse(body || "{}");
    } catch {
      const snippet = body.replace(/\s+/g, " ").trim().slice(0, 300);
      body = JSON.stringify({
        ok: false,
        error: `Cloudflare Worker returned a non-JSON response (status ${upstream.status})${snippet ? `: ${snippet}` : ""}`,
        upstream_status: upstream.status,
        upstream_body: body.slice(0, 1000)
      });
    }
  }
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { ok: false, error: "Method Not Allowed" });
    const endpoint = workerEndpoint();
    if (!endpoint) return send(res, 503, { ok: false, error: "CLOUD_SYNC_ENDPOINT is not configured." });
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const path = normalizePath(url.searchParams.get("path") || "");
    if (!isAllowedPath(path)) return send(res, 400, { ok: false, error: "Unsupported Cloudflare sync path." });
    const body = req.method === "GET" ? null : await readRawBody(req);
    const upstream = await requestUpstream(endpoint + path, req.method, forwardedHeaders(req, body), body);
    return sendUpstream(res, upstream);
  } catch (error) {
    return send(res, 502, { ok: false, error: error.message || "Cloudflare sync proxy failed." });
  }
};
