import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { main, __test } = require("../functions/packages/contact/send/send.js");

const env = {
  RESEND_API_KEY: "re_test_key",
  TURNSTILE_SECRET_KEY: "prod_secret_not_a_test_key",
  CONTACT_FROM: "Bertucci Labs website <contact@forms.bertuccilabs.com>",
  CONTACT_TO: "owner@example.com",
  ALLOWED_ORIGINS: "https://bertuccilabs.com",
  TURNSTILE_HOSTNAMES: "bertuccilabs.com",
  APP_ENV: "production",
};

const goodPayload = {
  name: "Gianfranco",
  email: "visitor@example.com",
  company: "Acme",
  message: "I would like to discuss a technical project.",
  website: "",
  turnstileToken: "valid-token",
  requestId: "123e4567-e89b-42d3-a456-426614174000",
};

function event({ method = "POST", origin = "https://bertuccilabs.com", body = goodPayload, headers = {} } = {}) {
  return {
    http: {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
      isBase64Encoded: false,
    },
  };
}

function json(response) {
  return JSON.parse(response.body || "{}");
}

function makeFetch({ turnstile = {}, resend = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes("turnstile")) {
      return Response.json({ success: true, hostname: "bertuccilabs.com", action: "contact", ...turnstile }, { status: turnstile.status || 200 });
    }
    return Response.json({ id: "email_123", ...resend }, { status: resend.status || 200 });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("accepts a valid request, verifies Turnstile, and sends through Resend", async () => {
  const fetchImpl = makeFetch();
  const response = await main(event(), { env, fetch: fetchImpl });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(json(response), { ok: true });
  assert.equal(fetchImpl.calls.length, 2);
  assert.match(String(fetchImpl.calls[0].url), /turnstile/);
  assert.match(String(fetchImpl.calls[1].url), /resend/);
  assert.equal(fetchImpl.calls[1].options.headers["Idempotency-Key"], `bertucci-contact-${goodPayload.requestId}`);
  const emailPayload = JSON.parse(fetchImpl.calls[1].options.body);
  assert.equal(emailPayload.from, env.CONTACT_FROM);
  assert.deepEqual(emailPayload.to, [env.CONTACT_TO]);
  assert.equal(emailPayload.reply_to, goodPayload.email);
  assert.match(emailPayload.text, /Gianfranco/);
  assert.doesNotMatch(emailPayload.text, /valid-token/);
});

test("handles OPTIONS with strict CORS", async () => {
  const response = await main(event({ method: "OPTIONS" }), { env, fetch: makeFetch() });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://bertuccilabs.com");
  assert.equal(response.headers.Vary, "Origin");
  assert.match(response.headers["Access-Control-Allow-Methods"], /POST/);
});

test("rejects disallowed origins before external calls", async () => {
  const fetchImpl = makeFetch();
  const response = await main(event({ origin: "https://evil.example" }), { env, fetch: fetchImpl });

  assert.equal(response.statusCode, 403);
  assert.equal(fetchImpl.calls.length, 0);
});

test("rejects invalid JSON and incorrect content type without external calls", async () => {
  const fetchImpl = makeFetch();
  const badJson = await main(event({ body: "{" }), { env, fetch: fetchImpl });
  const badType = await main(event({ headers: { "Content-Type": "text/plain" } }), { env, fetch: fetchImpl });

  assert.equal(badJson.statusCode, 400);
  assert.equal(json(badJson).error, "invalid_json");
  assert.equal(badType.statusCode, 415);
  assert.equal(fetchImpl.calls.length, 0);
});

test("rejects invalid field types, invalid email, oversized payloads, and missing token without Resend", async () => {
  const invalids = [
    { ...goodPayload, name: "" },
    { ...goodPayload, email: "bad\n@example.com" },
    { ...goodPayload, company: "x".repeat(121) },
    { ...goodPayload, message: "short" },
    { ...goodPayload, turnstileToken: "" },
    { ...goodPayload, requestId: "not-a-uuid" },
  ];

  for (const payload of invalids) {
    const fetchImpl = makeFetch();
    const response = await main(event({ body: payload }), { env, fetch: fetchImpl });
    assert.equal(response.statusCode, 400);
    assert.equal(json(response).error, "validation_failed");
    assert.equal(fetchImpl.calls.length, 0);
  }

  const fetchImpl = makeFetch();
  const response = await main(event({ body: JSON.stringify({ value: "x".repeat(33 * 1024) }) }), { env, fetch: fetchImpl });
  assert.equal(response.statusCode, 413);
  assert.equal(fetchImpl.calls.length, 0);
});

test("filled honeypot returns accepted without calling Turnstile or Resend", async () => {
  const fetchImpl = makeFetch();
  const response = await main(event({ body: { ...goodPayload, website: "bot.example" } }), { env, fetch: fetchImpl });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(json(response), { ok: true });
  assert.equal(fetchImpl.calls.length, 0);
});

test("Turnstile failures, hostname mismatch, and action mismatch never call Resend", async () => {
  const cases = [
    { success: false },
    { success: true, hostname: "preview.example", action: "contact" },
    { success: true, hostname: "bertuccilabs.com", action: "other" },
  ];

  for (const turnstile of cases) {
    const fetchImpl = makeFetch({ turnstile });
    const response = await main(event(), { env, fetch: fetchImpl });
    assert.equal(response.statusCode, 400);
    assert.equal(json(response).error, "verification_failed");
    assert.equal(fetchImpl.calls.length, 1);
  }
});

test("Resend failures do not return success", async () => {
  const fetchImpl = makeFetch({ resend: { status: 500, id: undefined } });
  const response = await main(event(), { env, fetch: fetchImpl });

  assert.equal(response.statusCode, 502);
  assert.equal(json(response).error, "service_error");
});

test("production rejects known Turnstile test secret configuration", async () => {
  const response = await main(event(), {
    env: { ...env, TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" },
    fetch: makeFetch(),
  });

  assert.equal(response.statusCode, 500);
  assert.equal(json(response).error, "service_unavailable");
});

test("validation helper trims accepted data", () => {
  const result = __test.validatePayload({ ...goodPayload, name: "  Name  ", company: "  Co  " });
  assert.equal(result.validated.name, "Name");
  assert.equal(result.validated.company, "Co");
});
