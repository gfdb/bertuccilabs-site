const MAX_BODY_BYTES = 32 * 1024;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const EXPECTED_ACTION = "contact";
const REQUEST_TIMEOUT_MS = 6000;
const TEST_SECRET_PREFIXES = ["1x000000", "2x000000", "3x000000"];

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfig(env = process.env) {
  const config = {
    resendApiKey: env.RESEND_API_KEY,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    contactFrom: env.CONTACT_FROM,
    contactTo: env.CONTACT_TO,
    allowedOrigins: splitList(env.ALLOWED_ORIGINS),
    turnstileHostnames: splitList(env.TURNSTILE_HOSTNAMES),
    appEnv: env.APP_ENV || "development",
  };

  const missing = [];
  for (const [key, value] of Object.entries(config)) {
    if (Array.isArray(value) ? value.length === 0 : !value) missing.push(key);
  }

  if (
    config.appEnv === "production" &&
    TEST_SECRET_PREFIXES.some((prefix) =>
      String(config.turnstileSecretKey || "").startsWith(prefix),
    )
  ) {
    missing.push("production_turnstile_secret");
  }

  return { config, missing };
}

function lowerHeaders(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers || {})) {
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(",") : String(value);
  }
  return normalized;
}

function getMethod(event) {
  return String(
    event?.http?.method || event?.method || event?.__ow_method || "GET",
  ).toUpperCase();
}

function getHeaders(event) {
  return lowerHeaders(event?.http?.headers || event?.headers || {});
}

function response(statusCode, payload, origin, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

function optionsResponse(origin) {
  return response(204, {}, origin, {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
}

function log(stage, requestId, detail) {
  console.log(JSON.stringify({ stage, requestId, detail }));
}

function safeByteLength(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function decodeBody(event) {
  const raw = event?.http?.body ?? event?.body ?? "";
  const isBase64Encoded = Boolean(event?.http?.isBase64Encoded ?? event?.isBase64Encoded);
  const body = isBase64Encoded
    ? Buffer.from(String(raw), "base64").toString("utf8")
    : String(raw || "");
  if (safeByteLength(body) > MAX_BODY_BYTES) {
    return { error: "body_too_large" };
  }
  return { body };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidEmail(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 254 &&
    !/[\r\n]/.test(value) &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
  );
}

function validatePayload(payload) {
  if (!isObject(payload)) return { error: "validation_failed" };

  const expected = ["name", "email", "company", "message", "website", "turnstileToken", "requestId"];
  for (const field of expected) {
    if (typeof payload[field] !== "string") return { error: "validation_failed" };
  }

  const validated = {
    name: payload.name.trim(),
    email: payload.email.trim(),
    company: payload.company.trim(),
    message: payload.message.trim(),
    website: payload.website,
    turnstileToken: payload.turnstileToken,
    requestId: payload.requestId,
  };

  if (validated.website.trim()) return { honeypot: true };
  if (!validated.name || validated.name.length > 120) return { error: "validation_failed" };
  if (!isValidEmail(validated.email)) return { error: "validation_failed" };
  if (validated.company.length > 120) return { error: "validation_failed" };
  if (validated.message.length < 10 || validated.message.length > 5000) {
    return { error: "validation_failed" };
  }
  if (!validated.turnstileToken || validated.turnstileToken.length > 2048) {
    return { error: "validation_failed" };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(validated.requestId)) {
    return { error: "validation_failed" };
  }

  return { validated };
}

async function fetchWithTimeout(url, options, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyTurnstile(token, config, requestId, fetchImpl) {
  const form = new URLSearchParams();
  form.set("secret", config.turnstileSecretKey);
  form.set("response", token);

  const result = await fetchWithTimeout(
    TURNSTILE_VERIFY_URL,
    { method: "POST", body: form },
    fetchImpl,
  );
  const body = await result.json().catch(() => ({}));
  if (!result.ok || body.success !== true) {
    log("turnstile_rejected", requestId, { status: result.status });
    return false;
  }
  if (!config.turnstileHostnames.includes(body.hostname) || body.action !== EXPECTED_ACTION) {
    log("turnstile_mismatch", requestId, {
      hostname: body.hostname,
      action: body.action,
    });
    return false;
  }
  return true;
}

function buildEmailPayload(validated, config) {
  const companyLine = validated.company ? `Company: ${validated.company}\n` : "";
  return {
    from: config.contactFrom,
    to: [config.contactTo],
    reply_to: validated.email,
    subject: "Bertucci Labs website inquiry",
    text:
      `Name: ${validated.name}\n` +
      `Email: ${validated.email}\n` +
      companyLine +
      `\nMessage:\n${validated.message}`,
  };
}

async function sendEmail(validated, config, requestId, fetchImpl) {
  const emailPayload = buildEmailPayload(validated, config);
  const result = await fetchWithTimeout(
    RESEND_EMAIL_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `bertucci-contact-${requestId}`,
      },
      body: JSON.stringify(emailPayload),
    },
    fetchImpl,
  );
  const body = await result.json().catch(() => ({}));
  if (!result.ok || typeof body.id !== "string" || !body.id) {
    log("resend_failed", requestId, { status: result.status });
    return false;
  }
  log("resend_accepted", requestId, { resendId: body.id });
  return true;
}

async function main(event = {}, context = {}) {
  const fetchImpl = context.fetch || globalThis.fetch;
  const { config, missing } = getConfig(context.env || process.env);
  const method = getMethod(event);
  const headers = getHeaders(event);
  const origin = headers.origin || "";
  const allowedOrigin = config.allowedOrigins.includes(origin) ? origin : "";

  if (missing.length > 0) {
    log("config_error", undefined, { missing });
    return response(500, { ok: false, error: "service_unavailable" }, allowedOrigin);
  }

  if (!origin || !allowedOrigin) {
    return response(403, { ok: false, error: "origin_not_allowed" }, undefined);
  }

  if (method === "OPTIONS") return optionsResponse(allowedOrigin);
  if (method !== "POST") {
    return response(405, { ok: false, error: "method_not_allowed" }, allowedOrigin, {
      Allow: "POST, OPTIONS",
    });
  }

  if (!/^application\/json\b/i.test(headers["content-type"] || "")) {
    return response(415, { ok: false, error: "unsupported_media_type" }, allowedOrigin);
  }

  const decoded = decodeBody(event);
  if (decoded.error) {
    return response(413, { ok: false, error: decoded.error }, allowedOrigin);
  }

  let payload;
  try {
    payload = JSON.parse(decoded.body || "{}");
  } catch {
    return response(400, { ok: false, error: "invalid_json" }, allowedOrigin);
  }

  const validation = validatePayload(payload);
  if (validation.honeypot) {
    return response(200, { ok: true }, allowedOrigin);
  }
  if (validation.error || !validation.validated) {
    return response(400, { ok: false, error: "validation_failed" }, allowedOrigin);
  }

  const requestId = validation.validated.requestId;
  try {
    const verified = await verifyTurnstile(
      validation.validated.turnstileToken,
      config,
      requestId,
      fetchImpl,
    );
    if (!verified) {
      return response(400, { ok: false, error: "verification_failed" }, allowedOrigin);
    }

    const sent = await sendEmail(validation.validated, config, requestId, fetchImpl);
    if (!sent) {
      return response(502, { ok: false, error: "service_error" }, allowedOrigin);
    }

    return response(200, { ok: true }, allowedOrigin);
  } catch (error) {
    log("handler_error", requestId, {
      name: error instanceof Error ? error.name : "unknown",
    });
    return response(502, { ok: false, error: "service_error" }, allowedOrigin);
  }
}

module.exports = {
  main,
  __test: {
    buildEmailPayload,
    decodeBody,
    getConfig,
    validatePayload,
  },
};
