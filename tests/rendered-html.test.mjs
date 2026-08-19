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

test("renders the ad-slot strategy management page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ADX 广告位策略管理<\/title>/i);
  assert.match(html, /广告位策略管理/);
  assert.match(html, /当前最小配置单元/);
  assert.match(html, /同广告位流量互斥/);
  assert.match(html, /添加策略/);
  assert.match(html, /添加PID/);
  assert.match(html, /DSP来源/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps ad-slot scoping and exclusive matching in the client surface", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const feature of [
    "saveStrategy",
    "copyStrategy",
    "saveDsp",
    "patchDsp",
    "adSlotId",
    "selectExclusiveStrategy",
    "buildExclusiveMatchTrace",
    "同一广告位的策略优先级不能重复",
    "localStorage",
    "查看A/B测试数据",
  ]) assert.match(page, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
