"use client";

import { Fragment, useState } from "react";
import {
  AB_EXPERIMENTS,
  defaultAbDateRange,
  experimentDateBounds,
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
  type AbGroupMetrics,
  type AbMetricKey,
} from "./ab-report";

type MetricType = "money" | "number" | "percent" | "decimal";
type MetricOption = { key: AbMetricKey; label: string; type: MetricType };
type MetricDefinition = { label: string; description: string; formula?: string; freshness: "T+1" | "实时" };

const comparisonMetrics: MetricOption[] = [
  { key: "revenuePerThousandUsers", label: "千人均收益", type: "decimal" },
  { key: "users", label: "DAU", type: "number" },
  { key: "revenue", label: "预估收入", type: "money" },
  { key: "ecpm", label: "eCPM", type: "decimal" },
  { key: "requestValue", label: "千次请求价值", type: "decimal" },
  { key: "requests", label: "请求量", type: "number" },
  { key: "returnRate", label: "返回率", type: "percent" },
  { key: "bidWins", label: "竞价成功数", type: "number" },
  { key: "bidSuccessRate", label: "竞价成功率", type: "percent" },
  { key: "impressions", label: "展示量", type: "number" },
  { key: "winImpressionRate", label: "竞胜展示率", type: "percent" },
  { key: "clicks", label: "点击数", type: "number" },
  { key: "ctr", label: "点击率", type: "percent" },
  { key: "cpc", label: "cpc", type: "money" },
];

const chartMetricKeys: AbMetricKey[] = ["revenuePerThousandUsers", "users", "revenue", "ecpm", "requests", "impressions", "clicks", "ctr", "bidSuccessRate", "winImpressionRate", "cpc"];
const chartMetrics = comparisonMetrics.filter((metric) => chartMetricKeys.includes(metric.key));
const metricDefinitions: MetricDefinition[] = [
  { label: "千人均收益", description: "每千个活跃用户带来的广告收入，用于衡量用户整体变现效率。", formula: "预估收入 ÷ 用户数 × 1000", freshness: "T+1" },
  { label: "DAU", description: "统计周期内产生有效活跃行为的去重用户数，用于衡量实验覆盖的日活跃用户规模。", formula: "统计周期内活跃用户去重计数", freshness: "T+1" },
  { label: "预估收入", description: "当前统计周期内，各广告来源产生的预估广告收入之和。", formula: "各广告来源预估收入之和", freshness: "实时" },
  { label: "eCPM", description: "每一千次有效广告展示带来的预估收入。", formula: "预估收入 ÷ 展示量 × 1000", freshness: "实时" },
  { label: "千次请求价值", description: "每一千次进入 ADX 的广告请求带来的预估收入。", formula: "预估收入 ÷ 请求量 × 1000", freshness: "实时" },
  { label: "请求量", description: "ADX 接收到的广告请求数。一次入口请求即使同时请求多个广告渠道，也只计为一次请求。", freshness: "实时" },
  { label: "返回率", description: "广告请求中成功返回广告结果的比例。", formula: "广告返回数 ÷ 请求量 × 100%", freshness: "实时" },
  { label: "竞价成功数", description: "参与竞价后获得竞价成功结果的次数。", freshness: "实时" },
  { label: "竞价成功率", description: "有广告返回的请求中，最终竞价成功的比例。", formula: "竞价成功数 ÷ 广告返回数 × 100%", freshness: "实时" },
  { label: "展示量", description: "广告素材在用户端完成实际展示的次数。", freshness: "实时" },
  { label: "竞胜展示率", description: "竞价成功后最终完成广告展示的比例。", formula: "展示量 ÷ 竞价成功数 × 100%", freshness: "实时" },
  { label: "点击数", description: "用户点击已展示广告的总次数。", freshness: "实时" },
  { label: "点击率", description: "广告展示后被用户点击的比例。", formula: "点击数 ÷ 展示量 × 100%", freshness: "实时" },
  { label: "cpc", description: "平均每次广告点击对应的预估收入。", formula: "预估收入 ÷ 点击数", freshness: "实时" },
];
const numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMetric(value: number, type: MetricType): string {
  if (type === "number") return numberFormatter.format(Math.round(value));
  if (type === "percent") return `${decimalFormatter.format(value * 100)}%`;
  if (type === "money") return `¥${decimalFormatter.format(value)}`;
  return decimalFormatter.format(value);
}

function formatLift(value: number | null): string {
  if (value === null) return "-";
  if (Math.abs(value) < 0.00005) return "0.00%";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function downloadCsv(filename: string, headers: string[], data: (string | number)[][], onNotify: (message: string) => void) {
  const csv = `\uFEFF${[headers, ...data].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  onNotify("导出成功");
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, "");
}

const ongoingExperiments = getOngoingAbExperiments(AB_EXPERIMENTS);

export default function AbReportManager({ onNotify }: { onNotify: (message: string) => void }) {
  const initialExperiment = ongoingExperiments[0];
  const [selectedId, setSelectedId] = useState(() => resolveAbExperimentId(ongoingExperiments, ""));
  const [experimentQuery, setExperimentQuery] = useState(initialExperiment?.optionLabel ?? "");
  const [experimentPickerOpen, setExperimentPickerOpen] = useState(false);
  const [metric, setMetric] = useState<AbMetricKey>("revenuePerThousandUsers");
  const [timeDimension, setTimeDimension] = useState<"day" | "hour">("day");
  const [dateRange, setDateRange] = useState(() => initialExperiment ? defaultAbDateRange(initialExperiment) : { startDate: "", endDate: "" });
  const [hourlyDate, setHourlyDate] = useState(() => initialExperiment ? defaultAbDateRange(initialExperiment).endDate : "");
  const [dateError, setDateError] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showTrafficLog, setShowTrafficLog] = useState(false);
  const [showAllExperiments, setShowAllExperiments] = useState(false);
  const [definitionLabel, setDefinitionLabel] = useState<string | null>(null);
  const selectedExperiment = AB_EXPERIMENTS.find((experiment) => String(experiment.id) === selectedId) ?? initialExperiment;
  const overviewExperiments = sortAbExperimentsByCreatedAt(showAllExperiments ? AB_EXPERIMENTS : ongoingExperiments);
  const filteredExperiments = filterAbExperimentsByKeyword(ongoingExperiments, experimentQuery);
  const pickerExperiments = experimentQuery === selectedExperiment?.optionLabel ? ongoingExperiments : filteredExperiments;
  const selectedMetric = chartMetrics.find((option) => option.key === metric) ?? chartMetrics[0];
  const activeDefinition = metricDefinitions.find((item) => item.label === definitionLabel) ?? null;
  const bounds = selectedExperiment ? experimentDateBounds(selectedExperiment) : { startDate: "", endDate: "" };
  const fullRows = selectedExperiment ? generateAbDailyRows(selectedExperiment, bounds.startDate, bounds.endDate) : [];
  const detailRows = selectedExperiment && !dateError ? (timeDimension === "day" ? generateAbDailyRows(selectedExperiment, dateRange.startDate, dateRange.endDate) : generateAbHourlyRows(selectedExperiment, hourlyDate)) : [];
  const summaryA = summarizeAbGroup(fullRows, "a");
  const summaryB = summarizeAbGroup(fullRows, "b");
  const trafficLogs = selectedExperiment ? filterAndSortAbTrafficLogs(generateAbTrafficLogs(selectedExperiment), "", "", "desc") : [];

  const changeExperiment = (nextId: string) => {
    const experiment = AB_EXPERIMENTS.find((item) => String(item.id) === nextId);
    setSelectedId(nextId);
    setExperimentQuery(experiment?.optionLabel ?? "");
    setExperimentPickerOpen(false);
    setMetric("revenuePerThousandUsers");
    const nextRange = experiment ? defaultAbDateRange(experiment) : { startDate: "", endDate: "" };
    setDateRange(nextRange);
    setHourlyDate(nextRange.endDate);
    setTimeDimension("day");
    setDateError("");
    setHoveredIndex(null);
    setShowTrafficLog(false);
  };

  const updateDateRange = (patch: Partial<typeof dateRange>) => {
    if (!selectedExperiment) return;
    const next = { ...dateRange, ...patch };
    setDateRange(next);
    setDateError(validateAbDateRange(next.startDate, next.endDate, selectedExperiment));
    setHoveredIndex(null);
  };

  const changeTimeDimension = (dimension: "day" | "hour") => {
    if (!selectedExperiment) return;
    setTimeDimension(dimension);
    setDateError(dimension === "day" ? validateAbDateRange(dateRange.startDate, dateRange.endDate, selectedExperiment) : validateAbHourlyDate(hourlyDate, selectedExperiment));
    setHoveredIndex(null);
  };

  const updateHourlyDate = (date: string) => {
    if (!selectedExperiment) return;
    setHourlyDate(date);
    setDateError(validateAbHourlyDate(date, selectedExperiment));
    setHoveredIndex(null);
  };

  const openExperimentDetail = (experimentId: number) => {
    changeExperiment(String(experimentId));
    requestAnimationFrame(() => document.getElementById("ab-experiment-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const exportComparison = () => {
    if (!selectedExperiment || !summaryA || !summaryB) return;
    const rowFor = (label: string, data: AbGroupMetrics) => [label, ...comparisonMetrics.map((item) => formatMetric(data[item.key], item.type))];
    const liftRow = ["对比涨幅", ...comparisonMetrics.map((item) => formatLift(metricLift(summaryA[item.key], summaryB[item.key])))];
    downloadCsv(`AB测试对比_${safeFilename(selectedExperiment.testName)}.csv`, ["组别", ...comparisonMetrics.map((item) => item.label)], [rowFor("A 对照组", summaryA), rowFor("B 测试组", summaryB), liftRow], onNotify);
  };

  const exportDetail = () => {
    if (!selectedExperiment || !detailRows.length) return onNotify("暂无数据");
    if (timeDimension === "day") {
      const rows = detailRows.flatMap((row) => (["a", "b"] as const).map((group) => [row.date, group === "a" ? "A 对照组" : "B 测试组", ...comparisonMetrics.map((item) => formatMetric(row[group][item.key], item.type))]));
      downloadCsv(`AB测试明细_${dateRange.startDate.replaceAll("-", "")}_${dateRange.endDate.replaceAll("-", "")}.csv`, ["日期", "组别", ...comparisonMetrics.map((item) => item.label)], rows, onNotify);
      return;
    }
    const rows = detailRows.flatMap((row) => (["a", "b"] as const).map((group) => [row.date, group === "a" ? "A 对照组" : "B 测试组", ...comparisonMetrics.map((item) => formatMetric(row[group][item.key], item.type))]));
    downloadCsv(`AB测试明细_${hourlyDate.replaceAll("-", "")}_分时.csv`, ["时间", "组别", ...comparisonMetrics.map((item) => item.label)], rows, onNotify);
  };

  const plot = { width: 980, height: 300, left: 72, right: 22, top: 24, bottom: 44 };
  const innerWidth = plot.width - plot.left - plot.right;
  const innerHeight = plot.height - plot.top - plot.bottom;
  const chartValues = detailRows.flatMap((row) => [row.a[metric], row.b[metric]]);
  const maxValue = Math.max(...chartValues, 1);
  const minValue = Math.min(...chartValues, 0);
  const valueRange = Math.max(maxValue - minValue, maxValue * 0.08, 1);
  const pointsFor = (group: "a" | "b") => detailRows.map((row, index) => ({ x: plot.left + (detailRows.length === 1 ? innerWidth / 2 : index / (detailRows.length - 1) * innerWidth), y: plot.top + (maxValue - row[group][metric]) / valueRange * innerHeight, row }));
  const pointsA = pointsFor("a");
  const pointsB = pointsFor("b");
  const chartTicks = Array.from({ length: 5 }, (_, index) => maxValue - valueRange * index / 4);

  if (!selectedExperiment) return <section className="panel ab-report-panel"><h1>A/B测试报表</h1><div className="ab-report-empty"><strong>暂无进行中的 A/B 测试</strong><span>实验开启后，将自动出现在实验选择器中。</span></div></section>;

  return <section className="panel ab-report-panel">
    <h1>A/B测试报表</h1>
    <div className="ab-report-overview">
      <div className="ab-report-filter"><label><span><b>*</b>进行中 A/B</span><div className="ab-experiment-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setExperimentPickerOpen(false); setExperimentQuery(selectedExperiment.optionLabel); } }}><input type="text" role="combobox" aria-label="进行中 A/B 实验" aria-autocomplete="list" aria-expanded={experimentPickerOpen} aria-controls="ab-experiment-options" placeholder="输入分组名称检索" value={experimentQuery} onFocus={(event) => { setExperimentPickerOpen(true); event.currentTarget.select(); }} onChange={(event) => { setExperimentQuery(event.target.value); setExperimentPickerOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") { setExperimentPickerOpen(false); setExperimentQuery(selectedExperiment.optionLabel); } else if (event.key === "Enter" && pickerExperiments[0]) { event.preventDefault(); changeExperiment(String(pickerExperiments[0].id)); } }} /><button type="button" aria-label="展开进行中A/B分组" onClick={() => setExperimentPickerOpen((open) => !open)}>⌄</button>{experimentPickerOpen && <div id="ab-experiment-options" className="ab-experiment-options" role="listbox">{pickerExperiments.map((experiment) => <button type="button" role="option" aria-selected={String(experiment.id) === selectedId} className={String(experiment.id) === selectedId ? "active" : ""} key={experiment.id} onClick={() => changeExperiment(String(experiment.id))}><strong>{experiment.optionLabel}</strong><small>{experiment.testName}</small></button>)}{!pickerExperiments.length && <div className="ab-experiment-no-result">未找到匹配的进行中分组</div>}</div>}</div></label></div>
      <div className="ab-experiment-info"><div><span>测试名称</span><strong>{selectedExperiment.testName}</strong></div><div><span>生效时间</span><strong>{selectedExperiment.startAt.replace("T", " ")} ~ {selectedExperiment.endAt.replace("T", " ")}</strong></div><div><span>状态</span><em className={selectedExperiment.status}>{selectedExperiment.status === "ongoing" ? "进行中" : "已结束"}</em></div><button type="button" className="secondary ab-traffic-log-entry" onClick={() => setShowTrafficLog(true)}>流量配置日志</button></div>
    </div>

    <section className="ab-report-card ab-experiment-overview-card"><header className="ab-report-section-heading"><div className="ab-section-title"><h2>A/B 测试列表概览</h2><span>按实验创建时间倒序排列，共 {overviewExperiments.length} 个实验</span></div><label className="ab-show-all-toggle"><input type="checkbox" checked={showAllExperiments} onChange={(event) => setShowAllExperiments(event.target.checked)} /><span>展示全部实验</span></label></header><div className="table-wrap ab-experiment-overview-table"><table><thead><tr><th>实验 ID</th><th>实验名称</th><th>实验开启时间</th><th>实验结束时间</th><th>实验状态</th><th>操作</th></tr></thead><tbody>{overviewExperiments.map((experiment) => <tr key={experiment.id} className={experiment.id === selectedExperiment.id ? "selected" : ""}><td>{experiment.id}</td><td><strong>{experiment.testName}</strong><small>{experiment.optionLabel}</small></td><td>{experiment.startAt.replace("T", " ")}</td><td>{experiment.endAt.replace("T", " ")}</td><td><em className={`ab-list-status ${experiment.status}`}>{experiment.status === "ongoing" ? "进行中" : "已结束"}</em></td><td><button type="button" className="link-button" onClick={() => openExperimentDetail(experiment.id)}>查看详细实验数据</button></td></tr>)}{!overviewExperiments.length && <tr><td colSpan={6}><div className="report-empty">暂无 A/B 测试</div></td></tr>}</tbody></table></div></section>

    <section id="ab-experiment-detail" className="ab-report-card"><header className="ab-report-section-heading"><div className="ab-section-title"><h2>A/B 测试数据对比表</h2><span>数据统计生效周期：<strong>{selectedExperiment.startAt.replace("T", " ")} ~ {selectedExperiment.endAt.replace("T", " ")}</strong></span></div><button type="button" className="secondary" onClick={exportComparison}>导出</button></header><div className="table-wrap ab-comparison-table"><table><thead><tr><th>组别</th>{comparisonMetrics.map((item) => <th key={item.key}><span className="report-metric-heading">{item.label}<button type="button" className="metric-help-button" aria-label={`查看${item.label}指标释义`} onClick={() => setDefinitionLabel(item.label)}>?</button></span></th>)}</tr></thead><tbody>{summaryA && <tr><td><strong>A 对照组</strong></td>{comparisonMetrics.map((item) => <td key={item.key}>{formatMetric(summaryA[item.key], item.type)}</td>)}</tr>}{summaryB && <tr><td><strong>B 测试组</strong></td>{comparisonMetrics.map((item) => <td key={item.key}>{formatMetric(summaryB[item.key], item.type)}</td>)}</tr>}{summaryA && summaryB && <tr className="ab-lift-row"><td><strong>对比涨幅</strong></td>{comparisonMetrics.map((item) => { const lift = metricLift(summaryA[item.key], summaryB[item.key]); return <td key={item.key} className={lift === null || Math.abs(lift) < 0.00005 ? "flat" : lift > 0 ? "positive" : "negative"}>{formatLift(lift)}</td>; })}</tr>}</tbody></table></div></section>

    <section className="ab-report-card"><header className="ab-report-section-heading"><h2>A/B 测试图表</h2><div className="ab-chart-controls"><div className="ab-dimension-switch" role="group" aria-label="数据时间维度"><button type="button" className={timeDimension === "day" ? "active" : ""} aria-pressed={timeDimension === "day"} onClick={() => changeTimeDimension("day")}>日维度</button><button type="button" className={timeDimension === "hour" ? "active" : ""} aria-pressed={timeDimension === "hour"} onClick={() => changeTimeDimension("hour")}>分时</button></div><label>数据指标<select value={metric} onChange={(event) => { setMetric(event.target.value as AbMetricKey); setHoveredIndex(null); }}>{chartMetrics.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>{timeDimension === "day" ? <label>日期范围<div><input type="date" aria-label="A/B图表开始日期" min={bounds.startDate} max={bounds.endDate} value={dateRange.startDate} onChange={(event) => updateDateRange({ startDate: event.target.value })} /><span>至</span><input type="date" aria-label="A/B图表结束日期" min={bounds.startDate} max={bounds.endDate} value={dateRange.endDate} onChange={(event) => updateDateRange({ endDate: event.target.value })} /></div></label> : <label>日期<input type="date" aria-label="A/B分时数据日期" min={bounds.startDate} max={bounds.endDate} value={hourlyDate} onChange={(event) => updateHourlyDate(event.target.value)} /></label>}</div></header>{dateError && <div className="ab-date-error">{dateError}</div>}{detailRows.length ? <div className="ab-line-chart" onMouseLeave={() => setHoveredIndex(null)}><svg viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label={`${selectedMetric.label} A/B 双折线图`}>{chartTicks.map((tick, index) => { const y = plot.top + innerHeight * index / 4; return <g key={index}><line x1={plot.left} x2={plot.width - plot.right} y1={y} y2={y} className="chart-grid-line" /><text x={plot.left - 12} y={y + 4} textAnchor="end" className="chart-axis-label">{selectedMetric.type === "percent" ? `${(tick * 100).toFixed(1)}%` : tick >= 10000 ? `${(tick / 10000).toFixed(1)}万` : tick.toFixed(2)}</text></g>; })}<polyline points={pointsA.map((point) => `${point.x},${point.y}`).join(" ")} className="ab-chart-line a" /><polyline points={pointsB.map((point) => `${point.x},${point.y}`).join(" ")} className="ab-chart-line b" />{pointsA.map((point, index) => <g key={point.row.date}><circle cx={point.x} cy={point.y} r={hoveredIndex === index ? 6 : 4} className="ab-chart-point a" tabIndex={0} aria-label={`${point.row.date} A 对照组 ${formatMetric(point.row.a[metric], selectedMetric.type)}`} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} /><circle cx={pointsB[index].x} cy={pointsB[index].y} r={hoveredIndex === index ? 6 : 4} className="ab-chart-point b" tabIndex={0} aria-label={`${point.row.date} B 测试组 ${formatMetric(point.row.b[metric], selectedMetric.type)}`} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} /></g>)}{[0, Math.floor((detailRows.length - 1) / 2), detailRows.length - 1].filter((index, position, values) => values.indexOf(index) === position).map((index) => <text key={index} x={pointsA[index].x} y={plot.height - 14} textAnchor={index === 0 ? "start" : index === detailRows.length - 1 ? "end" : "middle"} className="chart-axis-label">{timeDimension === "day" ? detailRows[index].date.slice(5) : detailRows[index].date.slice(11)}</text>)}</svg>{hoveredIndex !== null && detailRows[hoveredIndex] && <div className="ab-chart-tooltip" style={{ left: `${pointsA[hoveredIndex].x / plot.width * 100}%`, top: `${Math.min(pointsA[hoveredIndex].y, pointsB[hoveredIndex].y) / plot.height * 100}%` }}><strong>{detailRows[hoveredIndex].date}</strong><span><i className="a" />A 对照组：{formatMetric(detailRows[hoveredIndex].a[metric], selectedMetric.type)}</span><span><i className="b" />B 测试组：{formatMetric(detailRows[hoveredIndex].b[metric], selectedMetric.type)}</span></div>}</div> : <div className="report-empty">暂无数据</div>}<div className="ab-chart-legend"><span><i className="a" />A 对照组</span><span><i className="b" />B 测试组</span></div></section>

    <section className="ab-report-card"><header className="ab-report-section-heading"><div className="ab-section-title"><h2>数据明细 - 所有指标</h2><span>{timeDimension === "day" ? "按日期展示 A、B 两组全部指标" : "按小时展示 A、B 两组全部指标"}</span></div><div className="ab-detail-actions">{timeDimension === "day" ? <label>展示时间<div><input type="date" aria-label="明细开始日期" min={bounds.startDate} max={bounds.endDate} value={dateRange.startDate} onChange={(event) => updateDateRange({ startDate: event.target.value })} /><span>至</span><input type="date" aria-label="明细结束日期" min={bounds.startDate} max={bounds.endDate} value={dateRange.endDate} onChange={(event) => updateDateRange({ endDate: event.target.value })} /></div></label> : <label>展示日期<input type="date" aria-label="分时明细日期" min={bounds.startDate} max={bounds.endDate} value={hourlyDate} onChange={(event) => updateHourlyDate(event.target.value)} /></label>}<button type="button" className="secondary" onClick={exportDetail}>导出</button></div></header>{dateError && <div className="ab-date-error">{dateError}</div>}<div className="table-wrap ab-detail-table"><table><thead><tr><th className="ab-time-column">{timeDimension === "day" ? "日期" : "时间"}</th><th className="ab-group-column">组别</th>{comparisonMetrics.map((item) => <th key={item.key}><span className="report-metric-heading">{item.label}<button type="button" className="metric-help-button" aria-label={`查看${item.label}指标释义`} onClick={() => setDefinitionLabel(item.label)}>?</button></span></th>)}</tr></thead><tbody>{timeDimension === "day" && summaryA && summaryB && <><tr className="ab-detail-total"><td className="ab-time-column" rowSpan={2}>总计</td><td className="ab-group-column"><span className="ab-group-badge a">A</span>对照组</td>{comparisonMetrics.map((item) => <td key={item.key}>{formatMetric(summaryA[item.key], item.type)}</td>)}</tr><tr className="ab-detail-total"><td className="ab-group-column"><span className="ab-group-badge b">B</span>测试组</td>{comparisonMetrics.map((item) => <td key={item.key}>{formatMetric(summaryB[item.key], item.type)}</td>)}</tr></>}{detailRows.map((row) => <Fragment key={row.date}><tr><td className="ab-time-column" rowSpan={2}>{row.date}</td><td className="ab-group-column"><span className="ab-group-badge a">A</span>对照组</td>{comparisonMetrics.map((item) => <td key={item.key}>{formatMetric(row.a[item.key], item.type)}</td>)}</tr><tr><td className="ab-group-column"><span className="ab-group-badge b">B</span>测试组</td>{comparisonMetrics.map((item) => <td key={item.key}>{formatMetric(row.b[item.key], item.type)}</td>)}</tr></Fragment>)}{!detailRows.length && <tr><td colSpan={comparisonMetrics.length + 2}><div className="report-empty">暂无数据</div></td></tr>}</tbody></table></div></section>

    {showTrafficLog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowTrafficLog(false)}><section className="modal ab-traffic-log-modal" role="dialog" aria-modal="true" aria-label="流量配置日志"><header><h2>流量配置日志</h2><button type="button" aria-label="关闭流量配置日志" onClick={() => setShowTrafficLog(false)}>×</button></header><div className="traffic-log-body"><div className="traffic-log-summary"><strong>{selectedExperiment.testName}</strong><span>全部流量变化记录，按时间倒序排列</span></div><div className="table-wrap traffic-log-table"><table><thead><tr><th>日期</th><th>流量</th></tr></thead><tbody>{trafficLogs.map((log) => <tr key={log.date}><td>{log.date}</td><td><span className="traffic-ratio a">A组 {log.aTraffic}%</span><span className="traffic-ratio b">B组 {log.bTraffic}%</span></td></tr>)}{!trafficLogs.length && <tr><td colSpan={2}><div className="report-empty">暂无流量变化记录</div></td></tr>}</tbody></table></div></div><div className="modal-actions"><button type="button" className="primary" onClick={() => setShowTrafficLog(false)}>关闭</button></div></section></div>}
    {activeDefinition && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDefinitionLabel(null)}><section className="modal metric-definition-modal" role="dialog" aria-modal="true" aria-labelledby="ab-metric-definition-title"><header><h2 id="ab-metric-definition-title">{activeDefinition.label}</h2><button type="button" aria-label="关闭指标释义" onClick={() => setDefinitionLabel(null)}>×</button></header><div className="metric-definition-body"><div><h3>指标释义</h3><p>{activeDefinition.description}</p></div>{activeDefinition.formula && <div><h3>计算公式</h3><p className="metric-formula">{activeDefinition.formula}</p></div>}<div className="metric-freshness"><span>数据时效</span><b>{activeDefinition.freshness}</b></div></div><footer className="modal-actions"><button type="button" className="primary" onClick={() => setDefinitionLabel(null)}>知道了</button></footer></section></div>}
  </section>;
}
