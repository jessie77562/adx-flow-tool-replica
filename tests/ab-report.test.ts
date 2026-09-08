import assert from "node:assert/strict";
import test from "node:test";
import {
  AB_EXPERIMENTS,
  defaultAbDateRange,
  filterAbExperimentsByKeyword,
  filterAndSortAbTrafficLogs,
  generateAbDailyRows,
  generateAbHourlyRows,
  generateAbTrafficLogs,
  getOngoingAbExperiments,
  metricLift,
  resolveAbExperimentId,
  sortAbExperimentsByCreatedAt,
  summarizeAbGroup,
  validateAbDateRange,
  validateAbHourlyDate,
  type AbExperimentSource,
} from "../app/ab-report.ts";

const experiments: AbExperimentSource[] = [
  { id: 1, name: "已结束实验", enabled: false, ab: true },
  { id: 2, name: "进行中实验一", enabled: true, ab: true },
  { id: 3, name: "普通分组", enabled: true, ab: false },
  { id: 4, name: "进行中实验二", enabled: true, ab: true },
  { id: 5, name: "默认分组", enabled: true, ab: true, isDefault: true },
];

test("lists only ongoing non-default A/B experiments", () => {
  assert.deepEqual(getOngoingAbExperiments(experiments).map((experiment) => experiment.id), [2, 4]);
});

test("defaults to the first ongoing experiment and preserves a valid selection", () => {
  const ongoing = getOngoingAbExperiments(experiments);
  assert.equal(resolveAbExperimentId(ongoing, ""), "2");
  assert.equal(resolveAbExperimentId(ongoing, "4"), "4");
  assert.equal(resolveAbExperimentId(ongoing, "99"), "2");
  assert.equal(resolveAbExperimentId([], ""), "");
});

test("sorts the A/B experiment overview by creation time descending", () => {
  const sorted = sortAbExperimentsByCreatedAt(AB_EXPERIMENTS);
  assert.ok(sorted.every((experiment, index) => index === 0 || sorted[index - 1].startAt >= experiment.startAt));
  assert.deepEqual(sorted.map((experiment) => experiment.id), [1006, 1005, 1003, 1002, 1001, 1004]);
});

test("searches ongoing experiments by group or test name", () => {
  const ongoing = getOngoingAbExperiments(AB_EXPERIMENTS);
  assert.deepEqual(filterAbExperimentsByKeyword(ongoing, "高价值").map((experiment) => experiment.optionLabel), ["高价值用户组"]);
  assert.deepEqual(filterAbExperimentsByKeyword(ongoing, "频控").map((experiment) => experiment.optionLabel), ["回流用户组"]);
  assert.equal(filterAbExperimentsByKeyword(ongoing, "").length, ongoing.length);
});

test("keeps the chart range inside the experiment lifecycle", () => {
  const experiment = AB_EXPERIMENTS[0];
  assert.deepEqual(defaultAbDateRange(experiment, new Date(2026, 8, 7)), {
    startDate: "2026-09-01",
    endDate: "2026-09-07",
  });
  assert.equal(validateAbDateRange("2026-08-20", "2026-09-07", experiment), "日期范围不可超出实验生效时间");
  assert.equal(validateAbDateRange("2026-09-07", "2026-09-01", experiment), "结束日期不能早于开始日期");
  assert.equal(validateAbDateRange("2026-09-01", "2026-09-07", experiment), "");
});

test("builds deterministic daily comparison data and weighted summaries", () => {
  const experiment = AB_EXPERIMENTS[0];
  const rows = generateAbDailyRows(experiment, "2026-09-01", "2026-09-07");
  assert.equal(rows.length, 7);
  assert.deepEqual(rows, generateAbDailyRows(experiment, "2026-09-01", "2026-09-07"));
  const groupA = summarizeAbGroup(rows, "a");
  const groupB = summarizeAbGroup(rows, "b");
  assert.ok(groupA && groupB);
  assert.equal(groupA.requests, rows.reduce((total, row) => total + row.a.requests, 0));
  assert.equal(groupB.requests, rows.reduce((total, row) => total + row.b.requests, 0));
  assert.equal(metricLift(100, 110), 0.1);
  assert.equal(metricLift(0, 110), null);
});

test("filters traffic configuration logs by date and supports time ordering", () => {
  const logs = generateAbTrafficLogs(AB_EXPERIMENTS[0]);
  assert.equal(logs.length, 4);
  assert.ok(logs.every((log) => log.aTraffic + log.bTraffic === 100));
  const allDescending = filterAndSortAbTrafficLogs(logs, "", "", "desc");
  assert.equal(allDescending.length, logs.length);
  assert.ok(allDescending[0].date > allDescending.at(-1)!.date);
  const ascending = filterAndSortAbTrafficLogs(logs, "2026-08-21", "2026-09-18", "asc");
  assert.equal(ascending[0].date, logs[0].date);
  const descending = filterAndSortAbTrafficLogs(logs, "2026-09-01", "2026-09-18", "desc");
  assert.ok(descending.length < logs.length);
  assert.ok(descending[0].date > descending.at(-1)!.date);
});

test("generates hourly data from 00:00 with a minimum one-hour interval", () => {
  const experiment = AB_EXPERIMENTS[0];
  const rows = generateAbHourlyRows(experiment, "2026-09-07", new Date(2026, 8, 7, 10, 35, 0));
  assert.equal(rows.length, 11);
  assert.equal(rows[0].date, "2026-09-07 00:00");
  assert.equal(rows.at(-1)?.date, "2026-09-07 10:00");
  assert.equal(validateAbHourlyDate("2026-08-20", experiment), "日期不可超出实验生效时间");
  assert.equal(validateAbHourlyDate("2026-09-07", experiment), "");
});
