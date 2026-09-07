import assert from "node:assert/strict";
import test from "node:test";
import { filterPidRecords, type PidDraft, type PidRecord, validatePidDraft } from "../app/pid-management.ts";

const records: PidRecord[] = [
  { id: 1, pid: "pid-10001", dspSource: "穿山甲", enabled: true, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", groupIds: [211], minSdkVersion: "9.01.0", maxSdkVersion: "" },
  { id: 2, pid: "pid-android-feed", dspSource: "AdMob", enabled: false, platform: "Android", scene: "社区-信息流", adSlot: "3101-社区信息流广告", groupIds: [], minSdkVersion: "9.02.0", maxSdkVersion: "10.00.0" },
];

const validDraft: PidDraft = { pid: "new-pid-01", dspSource: "腾讯广告", enabled: true, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", minSdkVersion: "9.01.0", maxSdkVersion: "10.00.0" };

test("validates required PID fields", () => {
  const errors = validatePidDraft({ ...validDraft, pid: "", dspSource: "", scene: "", platform: "", adSlot: "", minSdkVersion: "" }, records, null);
  assert.equal(errors.pid, "请输入 PID");
  assert.equal(errors.dspSource, "请选择 DSP 来源");
  assert.equal(errors.scene, "请选择广告场景");
  assert.equal(errors.platform, "请选择平台");
  assert.equal(errors.adSlot, "请选择广告位");
  assert.equal(errors.minSdkVersion, "版本输入格式错误");
});

test("enforces global PID uniqueness while allowing the current edit", () => {
  assert.equal(validatePidDraft({ ...validDraft, pid: "PID-10001" }, records, null).pid, "该 PID 已存在，请重新输入");
  assert.equal(validatePidDraft({ ...validDraft, pid: "pid-10001" }, records, 1).pid, undefined);
});

test("validates PID format and SDK version range", () => {
  assert.equal(validatePidDraft({ ...validDraft, pid: "无效 PID" }, records, null).pid, "PID 格式错误");
  assert.equal(validatePidDraft({ ...validDraft, maxSdkVersion: "9.00.0" }, records, null).maxSdkVersion, "最大版本必须大于最小版本");
  assert.equal(validatePidDraft({ ...validDraft, maxSdkVersion: "10.0" }, records, null).maxSdkVersion, "版本输入格式错误");
});

test("filters PID records by the applied conditions", () => {
  const defaults = { scene: "", platform: "", adSlot: "", dspSources: [], sdkVersionOperator: "gte" as const, sdkVersion: "", groupIds: [], showAll: false };
  assert.deepEqual(filterPidRecords(records, defaults).map((record) => record.id), [1]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, scene: "社区-信息流", platform: "Android", showAll: true }).map((record) => record.id), [2]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, adSlot: "1000-美柚-开屏广告" }).map((record) => record.id), [1]);
});

test("filters PID records by multiple DSP sources, groups and SDK versions", () => {
  const defaults = { scene: "", platform: "", adSlot: "", dspSources: [], sdkVersionOperator: "gte" as const, sdkVersion: "", groupIds: [], showAll: true };
  assert.deepEqual(filterPidRecords(records, { ...defaults, dspSources: ["穿山甲", "AdMob"] }).map((record) => record.id), [1, 2]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, groupIds: ["211"] }).map((record) => record.id), [1]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, sdkVersion: "9.02.0" }).map((record) => record.id), [2]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, sdkVersionOperator: "lte", sdkVersion: "9.01.0" }).map((record) => record.id), [1]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, sdkVersionOperator: "gt", sdkVersion: "9.01.0" }).map((record) => record.id), [2]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, sdkVersionOperator: "lt", sdkVersion: "9.02.0" }).map((record) => record.id), [1]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, sdkVersionOperator: "contains", sdkVersion: "10.00" }).map((record) => record.id), [2]);
});
