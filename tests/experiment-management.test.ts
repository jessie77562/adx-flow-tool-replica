import assert from "node:assert/strict";
import test from "node:test";
import { allocateAllTraffic, startExperiment, validateExperiment, type GroupExperiment } from "../app/experiment-management.ts";

const draft: GroupExperiment = {
  groupId: 34,
  testName: "瀑布流广告位 eCPM 优化测试",
  status: "draft",
  aTraffic: 50,
  bTraffic: 50,
  allocation: "split",
  copyAtoB: true,
  createdAt: null,
  updatedAt: "2026-09-07 09:00:00",
  aConfig: [],
  bConfig: [],
};

test("validates experiment name and complementary traffic ratios", () => {
  assert.equal(validateExperiment("", 50, 50), "请输入测试名称");
  assert.equal(validateExperiment("测试", 40, 50), "对照组与实验组流量比例之和必须为100%");
  assert.equal(validateExperiment("测试", 50, 50), "");
});

test("uses the start action time as the experiment creation time", () => {
  const running = startExperiment(draft, new Date(2026, 8, 7, 10, 11, 12));
  assert.equal(running.status, "running");
  assert.equal(running.createdAt, "2026-09-07 10:11:12");
  assert.equal(startExperiment(running, new Date(2026, 8, 8, 10, 0, 0)).createdAt, running.createdAt);
});

test("supports switching a running experiment to all A or all B traffic", () => {
  const allA = allocateAllTraffic(startExperiment(draft), "A");
  assert.deepEqual([allA.aTraffic, allA.bTraffic, allA.allocation], [100, 0, "allA"]);
  const allB = allocateAllTraffic(allA, "B");
  assert.deepEqual([allB.aTraffic, allB.bTraffic, allB.allocation], [0, 100, "allB"]);
});
