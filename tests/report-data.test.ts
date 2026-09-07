import assert from "node:assert/strict";
import test from "node:test";
import { defaultReportDateRange, generateDailyReport, inclusiveDateSpan, sortReportRowsByDate, summarizeReport, validateReportDateRange, type ReportFilters } from "../app/report-data.ts";

const filters: ReportFilters = { startDate: "2026-07-06", endDate: "2026-07-12", scene: "", platform: "", group: "", app: "美柚", abGroup: "", adSources: [], versionOperator: "", appVersion: "" };

test("defaults the report to the latest seven inclusive days", () => {
  const range = defaultReportDateRange(new Date(2026, 6, 12));
  assert.deepEqual(range, { startDate: "2026-07-06", endDate: "2026-07-12" });
  assert.equal(inclusiveDateSpan(range.startDate, range.endDate), 7);
});

test("validates report date order and the 90 day limit", () => {
  assert.equal(validateReportDateRange("", "2026-07-12"), "请选择日期范围");
  assert.equal(validateReportDateRange("2026-07-12", "2026-07-06"), "结束日期不能早于开始日期");
  assert.equal(validateReportDateRange("2026-01-01", "2026-04-01"), "时间范围不能超过 90 天");
  assert.equal(validateReportDateRange("2026-07-06", "2026-07-12"), "");
});

test("generates one deterministic report row per day in ascending order", () => {
  const rows = generateDailyReport(filters);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].date, "2026-07-06");
  assert.equal(rows[6].date, "2026-07-12");
  assert.deepEqual(rows, generateDailyReport(filters));
});

test("supports selecting multiple ad sources", () => {
  const singleSource = generateDailyReport({ ...filters, adSources: ["腾讯广告"] });
  const multipleSources = generateDailyReport({ ...filters, adSources: ["腾讯广告", "穿山甲"] });
  assert.equal(multipleSources.length, 7);
  assert.deepEqual(multipleSources, generateDailyReport({ ...filters, adSources: ["穿山甲", "腾讯广告"] }));
  assert.ok(multipleSources.reduce((sum, row) => sum + row.revenue, 0) > singleSource.reduce((sum, row) => sum + row.revenue, 0));
});

test("sorts report detail rows by date without changing the chart source order", () => {
  const rows = generateDailyReport(filters);
  assert.equal(sortReportRowsByDate(rows, "asc")[0].date, "2026-07-06");
  assert.equal(sortReportRowsByDate(rows, "desc")[0].date, "2026-07-12");
  assert.equal(rows[0].date, "2026-07-06");
});

test("recalculates weighted summary metrics from summed bases", () => {
  const rows = generateDailyReport(filters);
  const total = summarizeReport(rows);
  assert.ok(total);
  assert.equal(total.date, "总计");
  assert.equal(total.requests, rows.reduce((sum, row) => sum + row.requests, 0));
  assert.equal(total.revenue, rows.reduce((sum, row) => sum + row.revenue, 0));
  assert.equal(total.ecpm, total.revenue / total.impressions * 1000);
  assert.equal(total.ctr, total.clicks / total.impressions);
});
