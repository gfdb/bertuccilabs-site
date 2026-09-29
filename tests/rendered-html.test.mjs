import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Bertucci Labs homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Bertucci Labs \| Intelligence, engineered<\/title>/i,
  );
  assert.match(html, /Intelligence, engineered/);
  assert.match(html, /Applied research/);
  assert.match(html, /AI systems/);
  assert.match(html, /Custom software/);
  assert.match(html, /Approach/);
  assert.match(html, /Have a project in mind/);
  assert.doesNotMatch(html, /mailto:|[A-Za-z0-9._%+-]+@bertuccilabs\.com/i);
  assert.match(html, /Start a conversation/);
  assert.match(html, /dark-mode-logo\.svg/);
  assert.match(html, /Tell us about the project/);
  assert.match(html, /contact-name/);
  assert.match(html, /contact-email/);
  assert.match(html, /contact-company/);
  assert.match(html, /contact-message/);
  assert.match(html, /contact-website/);
  assert.doesNotMatch(html, /Research &amp; prototyping|Complexity, made useful|From first principles to production|Explore our services/);
  assert.doesNotMatch(
    html,
    /codex-preview|SkeletonPreview|react-loading-skeleton/i,
  );
});

test("removes disposable starter preview references", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview|codex-preview/);
  assert.doesNotMatch(page, /function LogoMark|logo-top|logo-spine/);
  assert.doesNotMatch(page, /brand-lockup|brand-mark|brand-wordmark/);
  assert.doesNotMatch(
    page,
    /bertucci-labs-lockup-red-corners|bertucci-bl-mark-red-corners/,
  );
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
