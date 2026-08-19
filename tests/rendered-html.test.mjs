import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the ADX flow group management page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ADX 流量分组管理<\/title>/i);
  assert.match(html, /流量分组管理/);
  assert.match(html, /添加分组/);
  assert.match(html, /添加PID/);
  assert.match(html, /DSP来源/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the restored interactions in the client surface", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const feature of [
    "saveGroup",
    "copyGroup",
    "saveDsp",
    "patchDsp",
    "localStorage",
    "查看A/B测试数据",
  ]) assert.match(page, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
