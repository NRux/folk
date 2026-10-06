"use strict";
const crypto = require("crypto");

// Sites dispatch supplies this identity header only after authentication. The app must
// run behind the trusted Sites dispatcher; direct Node access is disabled by default.
function authorizeOwner(req, env = process.env) {
  if (env.FOLKLY_TRUSTED_AUTH_PROXY !== "sites") {
    return { ok: false, status: 503, error: "trusted identity proxy is not configured" };
  }
  const ownerId = String(env.FOLKLY_OWNER_USER_ID || "").trim();
  if (!ownerId) return { ok: false, status: 503, error: "owner identity is not configured" };
  const userId = String(req.headers["oai-authenticated-user-id"] || "").trim();
  if (!userId) return { ok: false, status: 401, error: "sign-in required" };
  if (!safeEqual(userId, ownerId)) return { ok: false, status: 403, error: "owner access required" };
  return { ok: true, actor: userId, email: String(req.headers["oai-authenticated-user-email"] || "") };
}

// Job tokens are independent credentials and require an exact per-job scope.
function authorizeJob(req, requiredScope, env = process.env) {
  const token = String(env.FOLKLY_JOB_TOKEN || "");
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !supplied || !safeEqual(supplied, token)) return { ok: false, status: 401 };
  const scopes = String(env.FOLKLY_JOB_SCOPES || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!scopes.includes(requiredScope)) return { ok: false, status: 403 };
  return { ok: true, actor: "job:" + requiredScope };
}

function safeEqual(a, b) {
  const ah = crypto.createHash("sha256").update(String(a)).digest();
  const bh = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}
module.exports = { authorizeOwner, authorizeJob };
