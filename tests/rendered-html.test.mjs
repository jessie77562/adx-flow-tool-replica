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
  assert.match(html, /分组管理/);
  assert.match(html, /仅展示生效中/);
  assert.match(html, /生效中/);
  assert.match(html, /社区-信息流/);
  assert.match(html, /社区-详情页/);
  assert.match(html, /社区-其他广告位/);
  assert.match(html, /添加PID/);
  assert.match(html, /批量操作/);
  assert.match(html, /DSP来源/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the restored interactions in the client surface", async () => {
  const [page, pidManager, reportManager, abReportManager, abReport, experimentManager, experimentData] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pid-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/report-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ab-report-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ab-report.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/group-experiment-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/experiment-management.ts", import.meta.url), "utf8"),
  ]);
  const clientSurface = `${page}\n${pidManager}\n${reportManager}\n${abReportManager}\n${abReport}\n${experimentManager}\n${experimentData}`;
  for (const feature of [
    "saveGroup",
    "copyGroup",
    "saveDsp",
    "patchDsp",
    "localStorage",
    "查看A/B测试数据",
    "submitBatchOperation",
    "设置价格",
    "请输入价格",
    "确认执行",
    "拖拽调整分组优先级",
    "全选非默认分组",
    "批量启用",
    "批量停用",
    "批量修改底价",
    "showEffectiveOnly",
    "groupListExpanded",
    "aria-controls=\"group-list\"",
    "展开全部分组",
    "highestEffectiveGroupId",
    "managedGroupDraft",
    "confirmGroupManager",
    "openDeleteGroupConfirmation",
    "confirmDeleteGroup",
    "仅已失效的非默认分组可删除",
    "删除后不可恢复，该分组下的 PID 配置也将同步删除",
    "currentView",
    "PID 管理",
    "PidManager",
    "综合报表",
    "ReportManager",
    "adSources",
    "广告来源多选",
    "metricDefinitions",
    "指标释义",
    "计算公式",
    "查看${label}指标释义",
    "展示全部 PID",
    "MultiSelectFilter label=\"DSP 来源\"",
    "SDK版本关系",
    "MultiSelectFilter label=\"分组\"",
    "adSourceDetailsRef",
    "closeAdSourceDropdown",
    "pointerdown",
    "sortReportRowsByDate",
    "数据明细时间排序",
    "日期升序",
    "日期降序",
    "A/B测试报表",
    "AbReportManager",
    "进行中 A/B 实验",
    "getOngoingAbExperiments",
    "resolveAbExperimentId",
    "默认分组",
    "高价值用户组",
    "新用户组",
    "A/B 测试数据对比表",
    "A/B 测试图表",
    "A/B 明细数据",
    "数据统计生效周期",
    "查看 A、B 两组全部指标",
    "AB测试明细_全指标",
    "对比涨幅",
    "A 对照组",
    "B 测试组",
    "日期范围不可超出实验生效时间",
    "generateAbDailyRows",
    "exportComparison",
    "exportDetail",
    "创建A/B实验",
    "创建A/B测试",
    "A/B测试已保存，状态为待开启",
    "A/B测试已开启",
    "将A组配置复制给B组",
    "全量A组",
    "全量B组",
    "实验创建时间",
    "开启中",
    "待开启",
    "allocateAllTraffic",
    "adx-demo-group-experiments-v1",
    "流量配置日志",
    "全部流量变化记录，按时间倒序排列",
    "日期降序",
    "日期升序",
    "generateAbTrafficLogs",
    "filterAndSortAbTrafficLogs",
    "日维度",
    "分时",
    "数据时间维度",
    "A/B分时数据日期",
    "generateAbHourlyRows",
    "validateAbHourlyDate",
    "输入分组名称检索",
    "展开进行中A/B分组",
    "回流用户组",
    "高活跃用户组",
    "filterAbExperimentsByKeyword",
    "requestSelectedGroupStatusChange",
    "confirmDisableGroup",
    "停用分组",
    "确认停用",
    "停用后，该流量分组策略将立即失效",
    "pendingAllocation",
    "confirmChooseAll",
    "流量全量切换",
    "组配置进行推全",
    "已将分组流量全部配置给${pendingAllocation}组",
  ]) assert.match(clientSurface, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(abReportManager, /流量日志开始日期|流量日志结束日期|流量日志时间排序/);
  assert.doesNotMatch(clientSurface, /分组优先级已自动保存|所有修改均已自动保存/);
});
