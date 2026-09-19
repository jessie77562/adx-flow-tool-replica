"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultReportDateRange,
  generateDailyReport,
  getMetricValue,
  sortReportRowsByDate,
  summarizeReport,
  supportsRevenuePerThousandUsers,
  validateReportDateRange,
  type ReportFilters,
  type ReportMetricKey,
  type ReportRow,
  type ReportSortOrder,
} from "./report-data";
import { PID_DSP_SOURCES } from "./pid-management";

type ReportGroup = { id: number; name: string; scene: string; platform: string; adSlot: string; isDefault?: boolean };
type ReportManagerProps = { groups: ReportGroup[]; onNotify: (message: string) => void };
type MetricDefinition = { label: string; description: string; formula?: string; freshness: "T+1" };

const metricOptions: { key: ReportMetricKey; label: string; type: "money" | "number" | "percent" | "decimal" }[] = [
  { key: "revenuePerThousandUsers", label: "千人均收益", type: "decimal" },
  { key: "users", label: "DAU", type: "number" },
  { key: "revenue", label: "预估收入", type: "money" },
  { key: "ecpm", label: "eCPM", type: "decimal" },
  { key: "requests", label: "请求量", type: "number" },
  { key: "impressions", label: "展示量", type: "number" },
  { key: "clicks", label: "点击数", type: "number" },
  { key: "ctr", label: "点击率", type: "percent" },
  { key: "bidSuccessRate", label: "竞价成功率", type: "percent" },
  { key: "winImpressionRate", label: "竞胜展示率", type: "percent" },
  { key: "cpc", label: "cpc", type: "money" },
];

const adSourceOptions = Array.from(new Set([...PID_DSP_SOURCES, "百度联盟"]));

const metricDefinitions: MetricDefinition[] = [
  { label: "千人均收益", description: "每千个活跃用户带来的广告收入，用于衡量用户整体变现效率。", formula: "预估收入 ÷ 用户数 × 1000", freshness: "T+1" },
  { label: "DAU", description: "统计日期内使用应用的去重活跃用户数。", formula: "当日活跃用户去重数", freshness: "T+1" },
  { label: "预估收入", description: "当前统计日期内，各广告来源产生的预估广告收入之和。", formula: "各广告来源预估收入之和", freshness: "T+1" },
  { label: "eCPM", description: "每一千次有效广告展示带来的预估收入。", formula: "预估收入 ÷ 展示量 × 1000", freshness: "T+1" },
  { label: "千次请求价值", description: "每一千次进入 ADX 的广告请求带来的预估收入。", formula: "预估收入 ÷ 请求量 × 1000", freshness: "T+1" },
  { label: "请求量", description: "ADX 接收到的广告请求数。一次入口请求即使同时请求多个广告渠道，也只计为一次请求。", freshness: "T+1" },
  { label: "返回率", description: "广告请求中成功返回广告结果的比例。", formula: "广告返回数 ÷ 请求量 × 100%", freshness: "T+1" },
  { label: "竞价成功数", description: "参与竞价后获得竞价成功结果的次数。", freshness: "T+1" },
  { label: "竞价成功率", description: "有广告返回的请求中，最终竞价成功的比例。", formula: "竞价成功数 ÷ 广告返回数 × 100%", freshness: "T+1" },
  { label: "展示量", description: "广告素材在用户端完成实际展示的次数。", freshness: "T+1" },
  { label: "竞胜展示率", description: "竞价成功后最终完成广告展示的比例。", formula: "展示量 ÷ 竞价成功数 × 100%", freshness: "T+1" },
  { label: "点击数", description: "用户点击已展示广告的总次数。", freshness: "T+1" },
  { label: "点击率", description: "广告展示后被用户点击的比例。", formula: "点击数 ÷ 展示量 × 100%", freshness: "T+1" },
  { label: "cpc", description: "平均每次广告点击对应的预估收入。", formula: "预估收入 ÷ 点击数", freshness: "T+1" },
  { label: "效果广告请求人数", description: "统计日期内发起过效果广告请求的去重用户数，即请求 UV。", freshness: "T+1" },
  { label: "效果广告千人均收益", description: "每千个发起效果广告请求的用户带来的预估收入。", formula: "预估收入 ÷ 效果广告请求人数 × 1000", freshness: "T+1" },
];

function createDefaultFilters(): ReportFilters {
  return { ...defaultReportDateRange(), adSlots: [], platforms: [], groupIds: [], app: "美柚", abGroup: "", adSources: [] };
}

const numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMetric(value: number, type: "money" | "number" | "percent" | "decimal"): string {
  if (type === "money") return `¥${decimalFormatter.format(value)}`;
  if (type === "number") return numberFormatter.format(Math.round(value));
  if (type === "percent") return `${decimalFormatter.format(value * 100)}%`;
  return decimalFormatter.format(value);
}

function formatChartValue(value: number, type: "money" | "number" | "percent" | "decimal"): string {
  if (type === "percent") return `${(value * 100).toFixed(2)}%`;
  if (type === "money") return `¥${value >= 10_000 ? `${(value / 10_000).toFixed(1)}万` : value.toFixed(2)}`;
  if (type === "number") return value >= 10_000 ? `${(value / 10_000).toFixed(1)}万` : numberFormatter.format(value);
  return value.toFixed(2);
}

function tableCells(row: ReportRow, showAudienceMetrics: boolean) {
  return <><td>{row.date}</td>{showAudienceMetrics && <><td>{decimalFormatter.format(row.revenuePerThousandUsers)}</td><td>{numberFormatter.format(row.users)}</td></>}<td>{decimalFormatter.format(row.revenue)}</td><td>{decimalFormatter.format(row.ecpm)}</td><td>{decimalFormatter.format(row.requestValue)}</td><td>{numberFormatter.format(row.requests)}</td><td>{decimalFormatter.format(row.returnRate * 100)}%</td><td>{numberFormatter.format(row.bidWins)}</td><td>{decimalFormatter.format(row.bidSuccessRate * 100)}%</td><td>{numberFormatter.format(row.impressions)}</td><td>{decimalFormatter.format(row.winImpressionRate * 100)}%</td><td>{numberFormatter.format(row.clicks)}</td><td>{decimalFormatter.format(row.ctr * 100)}%</td><td>{decimalFormatter.format(row.cpc)}</td><td>{numberFormatter.format(row.effectRequestUsers)}</td><td>{decimalFormatter.format(row.effectRevenuePerThousandUsers)}</td></>;
}

type MultiFilterKey = "adSlots" | "platforms" | "groupIds" | "adSources";
type MultiSelectOption = { value: string; label: string };

function selectionSummary(values: string[], options: MultiSelectOption[]): string {
  if (!values.length) return "全部";
  const labels = values.map((value) => options.find((option) => option.value === value)?.label ?? value);
  return labels.length <= 2 ? labels.join("、") : `已选 ${labels.length} 项`;
}

function MultiSelectField({ label, values, options, onToggle, onClear }: { label: string; values: string[]; options: MultiSelectOption[]; onToggle: (value: string) => void; onClear: () => void }) {
  const summary = selectionSummary(values, options);
  return <div className="report-multi-field">
    <span>{label}</span>
    <details className="report-multi-select">
      <summary title={summary}>{summary}</summary>
      <div className="report-multi-options" role="group" aria-label={`${label}多选`}>
        <button type="button" className={values.length === 0 ? "active" : ""} onClick={onClear}>全部</button>
        {options.map((option) => <label key={option.value}><input type="checkbox" checked={values.includes(option.value)} onChange={() => onToggle(option.value)} /><span>{option.label}</span></label>)}
      </div>
    </details>
  </div>;
}

export default function ReportManager({ groups, onNotify }: ReportManagerProps) {
  const [filters, setFilters] = useState<ReportFilters>(createDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(createDefaultFilters);
  const [metric, setMetric] = useState<ReportMetricKey>("revenuePerThousandUsers");
  const [dateError, setDateError] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [definitionLabel, setDefinitionLabel] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<ReportSortOrder>("asc");
  const reportFiltersRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      reportFiltersRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        if (event.target && !details.contains(event.target as Node)) details.open = false;
      });
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  const rows = useMemo(() => generateDailyReport(appliedFilters), [appliedFilters]);
  const sortedRows = useMemo(() => sortReportRowsByDate(rows, sortOrder), [rows, sortOrder]);
  const total = useMemo(() => summarizeReport(rows), [rows]);
  const showAudienceMetrics = supportsRevenuePerThousandUsers(appliedFilters);
  const visibleMetricOptions = metricOptions.filter((item) => showAudienceMetrics || (item.key !== "revenuePerThousandUsers" && item.key !== "users"));
  const visibleMetricDefinitions = metricDefinitions.filter((item) => showAudienceMetrics || (item.label !== "千人均收益" && item.label !== "DAU"));
  const reportTableColumns = [{ label: "日期", freshness: "" }, ...visibleMetricDefinitions.map(({ label, freshness }) => ({ label, freshness }))];
  const selectedMetric = visibleMetricOptions.find((item) => item.key === metric) ?? visibleMetricOptions[0];
  const activeDefinition = metricDefinitions.find((item) => item.label === definitionLabel) ?? null;
  const values = rows.map((row) => getMetricValue(row, metric));
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const valueRange = Math.max(maxValue - minValue, maxValue * 0.08, 1);
  const plot = { left: 72, right: 22, top: 24, bottom: 44, width: 980, height: 300 };
  const innerWidth = plot.width - plot.left - plot.right;
  const innerHeight = plot.height - plot.top - plot.bottom;
  const points = rows.map((row, index) => ({
    x: plot.left + (rows.length === 1 ? innerWidth / 2 : index / (rows.length - 1) * innerWidth),
    y: plot.top + (maxValue - getMetricValue(row, metric)) / valueRange * innerHeight,
    row,
  }));
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const chartTicks = Array.from({ length: 5 }, (_, index) => maxValue - valueRange * index / 4);
  const adSlotOptions = useMemo(() => Array.from(new Set(groups.map((group) => group.adSlot))).map((value) => ({ value, label: value })), [groups]);
  const platformOptions: MultiSelectOption[] = [{ value: "Android", label: "安卓" }, { value: "IOS", label: "iOS" }];
  const groupOptions = useMemo(() => {
    const options: MultiSelectOption[] = [{ value: "default", label: "默认分组" }, { value: "custom", label: "自定义分组" }];
    groups.forEach((group) => options.push({ value: String(group.id), label: group.name }));
    return options;
  }, [groups]);
  const sourceOptions = adSourceOptions.map((value) => ({ value, label: value }));

  const toggleMultiFilter = (field: MultiFilterKey, value: string) => {
    setFilters((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  };

  const closeFilterDropdowns = () => {
    reportFiltersRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => { details.open = false; });
  };

  const submitQuery = (event: FormEvent) => {
    event.preventDefault();
    closeFilterDropdowns();
    const error = validateReportDateRange(filters.startDate, filters.endDate);
    setDateError(error);
    if (error) return;
    setAppliedFilters({ ...filters });
    if (!supportsRevenuePerThousandUsers(filters) && (metric === "revenuePerThousandUsers" || metric === "users")) setMetric("revenue");
    setHoveredIndex(null);
  };

  const reset = () => {
    const defaults = createDefaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setDateError("");
    setMetric("revenuePerThousandUsers");
    setHoveredIndex(null);
    setDefinitionLabel(null);
    setSortOrder("asc");
    closeFilterDropdowns();
  };

  const exportReport = () => {
    if (!rows.length) return onNotify("暂无数据");
    const headers = ["日期", ...(showAudienceMetrics ? ["千人均收益", "DAU"] : []), "预估收入", "eCPM", "千次请求价值", "请求量", "返回率", "竞价成功数", "竞价成功率", "展示量", "竞胜展示率", "点击数", "点击率", "cpc", "效果广告请求人数", "效果广告千人均收益"];
    const csvRows = [total, ...sortedRows].filter((row): row is ReportRow => Boolean(row)).map((row) => [row.date, ...(showAudienceMetrics ? [row.revenuePerThousandUsers.toFixed(2), Math.round(row.users)] : []), row.revenue.toFixed(2), row.ecpm.toFixed(2), row.requestValue.toFixed(2), Math.round(row.requests), `${(row.returnRate * 100).toFixed(2)}%`, Math.round(row.bidWins), `${(row.bidSuccessRate * 100).toFixed(2)}%`, Math.round(row.impressions), `${(row.winImpressionRate * 100).toFixed(2)}%`, Math.round(row.clicks), `${(row.ctr * 100).toFixed(2)}%`, row.cpc.toFixed(2), Math.round(row.effectRequestUsers), row.effectRevenuePerThousandUsers.toFixed(2)]);
    const csv = `\uFEFF${[headers, ...csvRows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `综合报表_${appliedFilters.startDate.replaceAll("-", "")}_${appliedFilters.endDate.replaceAll("-", "")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotify("导出成功");
  };

  return <section className="panel report-panel">
    <h1>综合报表</h1>
    <form ref={reportFiltersRef} className="report-filters" onSubmit={submitQuery}>
      <div className="report-date-field"><span><b>*</b>日期</span><div className="date-range-inputs"><input type="date" aria-label="开始日期" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /><span>至</span><input type="date" aria-label="结束日期" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></div>{dateError && <small className="report-filter-error">{dateError}</small>}</div>
      <MultiSelectField label="分组" values={filters.groupIds} options={groupOptions} onToggle={(value) => toggleMultiFilter("groupIds", value)} onClear={() => setFilters((current) => ({ ...current, groupIds: [] }))} />
      <MultiSelectField label="广告位" values={filters.adSlots} options={adSlotOptions} onToggle={(value) => toggleMultiFilter("adSlots", value)} onClear={() => setFilters((current) => ({ ...current, adSlots: [] }))} />
      <MultiSelectField label="平台" values={filters.platforms} options={platformOptions} onToggle={(value) => toggleMultiFilter("platforms", value)} onClear={() => setFilters((current) => ({ ...current, platforms: [] }))} />
      <label>应用<select value={filters.app} onChange={(event) => setFilters({ ...filters, app: event.target.value })}><option value="">全部</option><option>美柚</option></select></label>
      <MultiSelectField label="广告来源" values={filters.adSources} options={sourceOptions} onToggle={(value) => toggleMultiFilter("adSources", value)} onClear={() => setFilters((current) => ({ ...current, adSources: [] }))} />
      <div className="report-filter-actions"><button type="submit" className="primary">查询</button><button type="button" className="secondary" onClick={reset}>重置</button></div>
      <p className="report-filter-note">指标展示说明：筛选广告来源时，不展示 DAU、千人均收益；未筛选广告来源时，广告位、分组、平台中至少选择一个单项即可展示 DAU、千人均收益，支持单平台、单分组、单广告位及三者的任意组合。</p>
    </form>

    <div className="report-chart-card">
      <div className="report-section-heading"><div><h2>数据图表</h2><span>{appliedFilters.startDate} 至 {appliedFilters.endDate} · 按天</span></div><div className="report-metric-control"><div className="report-metric-selector"><span>数据指标<button type="button" className="metric-help-button" aria-label={`查看${selectedMetric.label}指标释义`} onClick={() => setDefinitionLabel(selectedMetric.label)}>?</button></span><select aria-label="数据指标" value={metric} onChange={(event) => { setMetric(event.target.value as ReportMetricKey); setHoveredIndex(null); }}>{visibleMetricOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></div>{!showAudienceMetrics && <small className="report-metric-hint">请筛选单个广告位、分组或平台；筛选广告来源或多选时，不展示 DAU、千人均收益</small>}</div></div>
      {rows.length ? <div className="line-chart" onMouseLeave={() => setHoveredIndex(null)}>
        <svg viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label={`${selectedMetric.label}按天趋势折线图`}>
          {chartTicks.map((tick, index) => { const y = plot.top + innerHeight * index / 4; return <g key={index}><line x1={plot.left} x2={plot.width - plot.right} y1={y} y2={y} className="chart-grid-line" /><text x={plot.left - 12} y={y + 4} textAnchor="end" className="chart-axis-label">{formatChartValue(tick, selectedMetric.type)}</text></g>; })}
          <polyline points={linePoints} className="chart-line" />
          {points.map((point, index) => <circle key={point.row.date} cx={point.x} cy={point.y} r={hoveredIndex === index ? 6 : 4} className="chart-point" tabIndex={0} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)}><title>{point.row.date}：{formatMetric(getMetricValue(point.row, metric), selectedMetric.type)}</title></circle>)}
          {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((index, position, valuesList) => valuesList.indexOf(index) === position).map((index) => <text key={index} x={points[index].x} y={plot.height - 14} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"} className="chart-axis-label">{rows[index].date.slice(5)}</text>)}
        </svg>
        {hoveredIndex !== null && points[hoveredIndex] && <div className="chart-tooltip" style={{ left: `${points[hoveredIndex].x / plot.width * 100}%`, top: `${points[hoveredIndex].y / plot.height * 100}%` }}><strong>{points[hoveredIndex].row.date}</strong><span>{selectedMetric.label}：{formatMetric(getMetricValue(points[hoveredIndex].row, metric), selectedMetric.type)}</span></div>}
      </div> : <div className="report-empty">暂无数据</div>}
      <div className="chart-footer"><span>数据按 T+1 口径展示</span><button type="button" className="secondary" onClick={exportReport}>导出</button></div>
    </div>

    <div className="report-detail-heading"><div><h2>数据明细</h2><span>共 {rows.length} 天</span></div><label className="report-sort-control">时间排序<select aria-label="数据明细时间排序" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as ReportSortOrder)}><option value="asc">日期升序</option><option value="desc">日期降序</option></select></label></div>
    <div className="table-wrap report-table"><table><thead><tr>{reportTableColumns.map(({ label, freshness }) => <th key={label}><span className="report-metric-heading">{label}{freshness && <button type="button" className="metric-help-button" aria-label={`查看${label}指标释义`} onClick={() => setDefinitionLabel(label)}>?</button>}</span>{freshness && <small>{freshness}</small>}</th>)}</tr></thead><tbody>{total && <tr className="report-total-row">{tableCells(total, showAudienceMetrics)}</tr>}{sortedRows.map((row) => <tr key={row.date}>{tableCells(row, showAudienceMetrics)}</tr>)}{!rows.length && <tr><td colSpan={reportTableColumns.length}><div className="report-empty">暂无数据</div></td></tr>}</tbody></table></div>

    {activeDefinition && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDefinitionLabel(null)}><section className="modal metric-definition-modal" role="dialog" aria-modal="true" aria-labelledby="metric-definition-title"><header><h2 id="metric-definition-title">{activeDefinition.label}</h2><button type="button" aria-label="关闭指标释义" onClick={() => setDefinitionLabel(null)}>×</button></header><div className="metric-definition-body"><div><h3>指标释义</h3><p>{activeDefinition.description}</p></div>{activeDefinition.formula && <div><h3>计算公式</h3><p className="metric-formula">{activeDefinition.formula}</p></div>}<div className="metric-freshness"><span>数据时效</span><b>{activeDefinition.freshness}</b></div></div><footer className="modal-actions"><button type="button" className="primary" onClick={() => setDefinitionLabel(null)}>知道了</button></footer></section></div>}
  </section>;
}
