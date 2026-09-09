import assert from "node:assert/strict";
import test from "node:test";
import { filterPidRecords, normalizePidRecords, type PidDraft, type PidRecord, validatePidDraft } from "../app/pid-management.ts";

const records: PidRecord[] = [
  { id: 1, pid: "pid-10001", dspSource: "穿山甲", enabled: true, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", groupIds: [211], appVersion: "9.01.0" },
  { id: 2, pid: "pid-android-feed", dspSource: "AdMob", enabled: false, platform: "Android", scene: "社区-信息流", adSlot: "3101-社区信息流广告", groupIds: [], appVersion: "10.00.0" },
];

const validDraft: PidDraft = { pid: "new-pid-01", dspSource: "腾讯广告", enabled: true, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", appVersion: "9.01.0" };

test("validates required PID fields", () => {
  const errors = validatePidDraft({ ...validDraft, pid: "", dspSource: "", scene: "", platform: "", adSlot: "", appVersion: "" }, records, null);
  assert.equal(errors.pid, "请输入 PID");
  assert.equal(errors.dspSource, "请选择 DSP 来源");
  assert.equal(errors.scene, "请选择广告场景");
  assert.equal(errors.platform, "请选择平台");
  assert.equal(errors.adSlot, "请选择广告位");
  assert.equal(errors.appVersion, "请输入应用版本");
});

test("enforces global PID uniqueness while allowing the current edit", () => {
  assert.equal(validatePidDraft({ ...validDraft, pid: "PID-10001" }, records, null).pid, "该 PID 已存在，请重新输入");
  assert.equal(validatePidDraft({ ...validDraft, pid: "pid-10001" }, records, 1).pid, undefined);
});

test("validates PID and application version formats", () => {
  assert.equal(validatePidDraft({ ...validDraft, pid: "无效 PID" }, records, null).pid, "PID 格式错误");
  assert.equal(validatePidDraft({ ...validDraft, appVersion: "10.0" }, records, null).appVersion, "应用版本格式错误");
});

test("filters PID records by the applied conditions", () => {
  const defaults = { scene: "", platform: "", adSlot: "", pid: "", dspSources: [], groupIds: [], showAll: false };
  assert.deepEqual(filterPidRecords(records, defaults).map((record) => record.id), [1]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, scene: "社区-信息流", platform: "Android", showAll: true }).map((record) => record.id), [2]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, adSlot: "1000-美柚-开屏广告" }).map((record) => record.id), [1]);
});

test("filters PID records by PID text, multiple DSP sources and groups", () => {
  const defaults = { scene: "", platform: "", adSlot: "", pid: "", dspSources: [], groupIds: [], showAll: true };
  assert.deepEqual(filterPidRecords(records, { ...defaults, dspSources: ["穿山甲", "AdMob"] }).map((record) => record.id), [1, 2]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, groupIds: ["211"] }).map((record) => record.id), [1]);
  assert.deepEqual(filterPidRecords(records, { ...defaults, pid: "ANDROID" }).map((record) => record.id), [2]);
});

test("migrates saved SDK version data to the application version field", () => {
  const legacy = [{ ...records[0], appVersion: undefined, minSdkVersion: "8.09.0" }];
  assert.equal(normalizePidRecords(legacy)[0].appVersion, "8.09.0");
});
