"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultReportDateRange,
  generateDailyReport,
  getMetricValue,
  sortReportRowsByDate,
  summarizeReport,
  validateReportDateRange,
  type ReportFilters,
  type ReportMetricKey,
  type ReportRow,
  type ReportSortOrder,
} from "./report-data";
import { PID_DSP_SOURCES, PID_SCENES } from "./pid-management";

type ReportGroup = { id: number; name: string; scene: string; platform: string; isDefault?: boolean };
type ReportManagerProps = { groups: ReportGroup[]; onNotify: (message: string) => void };
type MetricDefinition = { label: string; description: string; formula?: string; freshness: "T+1" | "实时" };

const metricOptions: { key: ReportMetricKey; label: string; type: "money" | "number" | "percent" | "decimal" }[] = [
  { key: "revenuePerThousandUsers", label: "千人均收益", type: "decimal" },
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
  { label: "预估收入", description: "当前统计日期内，各广告来源产生的预估广告收入之和。", formula: "各广告来源预估收入之和", freshness: "实时" },
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
  { label: "效果广告请求人数", description: "统计日期内发起过效果广告请求的去重用户数，即请求 UV。", freshness: "实时" },
  { label: "效果广告千人均收益", description: "每千个发起效果广告请求的用户带来的预估收入。", formula: "预估收入 ÷ 效果广告请求人数 × 1000", freshness: "实时" },
];

const reportTableColumns = [{ label: "日期", freshness: "" }, ...metricDefinitions.map(({ label, freshness }) => ({ label, freshness }))];

function createDefaultFilters(): ReportFilters {
  return { ...defaultReportDateRange(), scene: "", platform: "", group: "", app: "美柚", abGroup: "", adSources: [], versionOperator: "", appVersion: "" };
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

function tableCells(row: ReportRow) {
  return <><td>{row.date}</td><td>{decimalFormatter.format(row.revenuePerThousandUsers)}</td><td>{decimalFormatter.format(row.revenue)}</td><td>{decimalFormatter.format(row.ecpm)}</td><td>{decimalFormatter.format(row.requestValue)}</td><td>{numberFormatter.format(row.requests)}</td><td>{decimalFormatter.format(row.returnRate * 100)}%</td><td>{numberFormatter.format(row.bidWins)}</td><td>{decimalFormatter.format(row.bidSuccessRate * 100)}%</td><td>{numberFormatter.format(row.impressions)}</td><td>{decimalFormatter.format(row.winImpressionRate * 100)}%</td><td>{numberFormatter.format(row.clicks)}</td><td>{decimalFormatter.format(row.ctr * 100)}%</td><td>{decimalFormatter.format(row.cpc)}</td><td>{numberFormatter.format(row.effectRequestUsers)}</td><td>{decimalFormatter.format(row.effectRevenuePerThousandUsers)}</td></>;
}

export default function ReportManager({ groups, onNotify }: ReportManagerProps) {
  const [filters, setFilters] = useState<ReportFilters>(createDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(createDefaultFilters);
  const [metric, setMetric] = useState<ReportMetricKey>("revenuePerThousandUsers");
  const [dateError, setDateError] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [definitionLabel, setDefinitionLabel] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<ReportSortOrder>("asc");
  const adSourceDetailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const details = adSourceDetailsRef.current;
      if (details?.open && event.target && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  const rows = useMemo(() => generateDailyReport(appliedFilters), [appliedFilters]);
  const sortedRows = useMemo(() => sortReportRowsByDate(rows, sortOrder), [rows, sortOrder]);
  const total = useMemo(() => summarizeReport(rows), [rows]);
  const selectedMetric = metricOptions.find((item) => item.key === metric) ?? metricOptions[0];
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
  const adSourceSummary = filters.adSources.length === 0
    ? "全部"
    : filters.adSources.length <= 2
      ? filters.adSources.join("、")
      : `已选 ${filters.adSources.length} 项`;

  const toggleAdSource = (source: string) => {
    setFilters((current) => ({
      ...current,
      adSources: current.adSources.includes(source)
        ? current.adSources.filter((item) => item !== source)
        : [...current.adSources, source],
    }));
  };

  const closeAdSourceDropdown = () => {
    if (adSourceDetailsRef.current) adSourceDetailsRef.current.open = false;
  };

  const submitQuery = (event: FormEvent) => {
    event.preventDefault();
    closeAdSourceDropdown();
    const error = validateReportDateRange(filters.startDate, filters.endDate);
    setDateError(error);
    if (error) return;
    setAppliedFilters({ ...filters });
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
    closeAdSourceDropdown();
  };

  const exportReport = () => {
    if (!rows.length) return onNotify("暂无数据");
    const headers = ["日期", "千人均收益", "预估收入", "eCPM", "千次请求价值", "请求量", "返回率", "竞价成功数", "竞价成功率", "展示量", "竞胜展示率", "点击数", "点击率", "cpc", "效果广告请求人数", "效果广告千人均收益"];
    const csvRows = [total, ...sortedRows].filter((row): row is ReportRow => Boolean(row)).map((row) => [row.date, row.revenuePerThousandUsers.toFixed(2), row.revenue.toFixed(2), row.ecpm.toFixed(2), row.requestValue.toFixed(2), Math.round(row.requests), `${(row.returnRate * 100).toFixed(2)}%`, Math.round(row.bidWins), `${(row.bidSuccessRate * 100).toFixed(2)}%`, Math.round(row.impressions), `${(row.winImpressionRate * 100).toFixed(2)}%`, Math.round(row.clicks), `${(row.ctr * 100).toFixed(2)}%`, row.cpc.toFixed(2), Math.round(row.effectRequestUsers), row.effectRevenuePerThousandUsers.toFixed(2)]);
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
    <form className="report-filters" onSubmit={submitQuery}>
      <div className="report-date-field"><span><b>*</b>日期</span><div className="date-range-inputs"><input type="date" aria-label="开始日期" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /><span>至</span><input type="date" aria-label="结束日期" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></div>{dateError && <small className="report-filter-error">{dateError}</small>}</div>
      <label>广告场景<select value={filters.scene} onChange={(event) => setFilters({ ...filters, scene: event.target.value, group: "" })}><option value="">全部</option>{PID_SCENES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>平台<select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value, group: "" })}><option value="">全部</option><option value="Android">安卓</option><option value="IOS">iOS</option></select></label>
      <label>分组<select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}><option value="">全部分组</option><option value="default">默认分组</option><option value="custom">自定义分组</option>{groups.filter((group) => (!filters.scene || group.scene === filters.scene) && (!filters.platform || group.platform === filters.platform)).map((group) => <option value={String(group.id)} key={group.id}>{group.name}</option>)}</select></label>
      <label>应用<select value={filters.app} onChange={(event) => setFilters({ ...filters, app: event.target.value })}><option value="">全部</option><option>美柚</option></select></label>
      <label>A/B测试分组<select value={filters.abGroup} onChange={(event) => setFilters({ ...filters, abGroup: event.target.value })}><option value="">全部</option><option value="none">无AB分组</option><option value="A">对照组A</option><option value="B">测试组B</option></select></label>
      <div className="report-multi-field">
        <span>广告来源</span>
        <details ref={adSourceDetailsRef} className="report-multi-select">
          <summary title={adSourceSummary}>{adSourceSummary}</summary>
          <div className="report-multi-options" role="group" aria-label="广告来源多选">
            <button type="button" className={filters.adSources.length === 0 ? "active" : ""} onClick={() => setFilters((current) => ({ ...current, adSources: [] }))}>全部</button>
            {adSourceOptions.map((source) => <label key={source}><input type="checkbox" checked={filters.adSources.includes(source)} onChange={() => toggleAdSource(source)} /><span>{source}</span></label>)}
          </div>
        </details>
      </div>
      <div className="version-filter"><span>APP版本</span><div><select aria-label="版本关系" value={filters.versionOperator} onChange={(event) => setFilters({ ...filters, versionOperator: event.target.value })}><option value="">全部</option><option value="gte">大于等于</option><option value="lte">小于等于</option><option value="gt">大于</option><option value="lt">小于</option><option value="eq">等于</option><option value="contains">包含</option></select><input aria-label="APP版本" value={filters.appVersion} placeholder="如 9.01.0" onChange={(event) => setFilters({ ...filters, appVersion: event.target.value })} /></div></div>
      <div className="report-filter-actions"><button type="submit" className="primary">查询</button><button type="button" className="secondary" onClick={reset}>重置</button></div>
    </form>

    <div className="report-chart-card">
      <div className="report-section-heading"><div><h2>数据图表</h2><span>{appliedFilters.startDate} 至 {appliedFilters.endDate} · 按天</span></div><div className="report-metric-selector"><span>数据指标<button type="button" className="metric-help-button" aria-label={`查看${selectedMetric.label}指标释义`} onClick={() => setDefinitionLabel(selectedMetric.label)}>?</button></span><select aria-label="数据指标" value={metric} onChange={(event) => { setMetric(event.target.value as ReportMetricKey); setHoveredIndex(null); }}>{metricOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></div></div>
      {rows.length ? <div className="line-chart" onMouseLeave={() => setHoveredIndex(null)}>
        <svg viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label={`${selectedMetric.label}按天趋势折线图`}>
          {chartTicks.map((tick, index) => { const y = plot.top + innerHeight * index / 4; return <g key={index}><line x1={plot.left} x2={plot.width - plot.right} y1={y} y2={y} className="chart-grid-line" /><text x={plot.left - 12} y={y + 4} textAnchor="end" className="chart-axis-label">{formatChartValue(tick, selectedMetric.type)}</text></g>; })}
          <polyline points={linePoints} className="chart-line" />
          {points.map((point, index) => <circle key={point.row.date} cx={point.x} cy={point.y} r={hoveredIndex === index ? 6 : 4} className="chart-point" tabIndex={0} onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)}><title>{point.row.date}：{formatMetric(getMetricValue(point.row, metric), selectedMetric.type)}</title></circle>)}
          {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((index, position, valuesList) => valuesList.indexOf(index) === position).map((index) => <text key={index} x={points[index].x} y={plot.height - 14} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"} className="chart-axis-label">{rows[index].date.slice(5)}</text>)}
        </svg>
        {hoveredIndex !== null && points[hoveredIndex] && <div className="chart-tooltip" style={{ left: `${points[hoveredIndex].x / plot.width * 100}%`, top: `${points[hoveredIndex].y / plot.height * 100}%` }}><strong>{points[hoveredIndex].row.date}</strong><span>{selectedMetric.label}：{formatMetric(getMetricValue(points[hoveredIndex].row, metric), selectedMetric.type)}</span></div>}
      </div> : <div className="report-empty">暂无数据</div>}
      <div className="chart-footer"><span>数据按 T+1 或准实时口径展示</span><button type="button" className="secondary" onClick={exportReport}>导出</button></div>
    </div>

    <div className="report-detail-heading"><div><h2>数据明细</h2><span>共 {rows.length} 天</span></div><label className="report-sort-control">时间排序<select aria-label="数据明细时间排序" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as ReportSortOrder)}><option value="asc">日期升序</option><option value="desc">日期降序</option></select></label></div>
    <div className="table-wrap report-table"><table><thead><tr>{reportTableColumns.map(({ label, freshness }) => <th key={label}><span className="report-metric-heading">{label}{freshness && <button type="button" className="metric-help-button" aria-label={`查看${label}指标释义`} onClick={() => setDefinitionLabel(label)}>?</button>}</span>{freshness && <small>{freshness}</small>}</th>)}</tr></thead><tbody>{total && <tr className="report-total-row">{tableCells(total)}</tr>}{sortedRows.map((row) => <tr key={row.date}>{tableCells(row)}</tr>)}{!rows.length && <tr><td colSpan={16}><div className="report-empty">暂无数据</div></td></tr>}</tbody></table></div>

    {activeDefinition && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDefinitionLabel(null)}><section className="modal metric-definition-modal" role="dialog" aria-modal="true" aria-labelledby="metric-definition-title"><header><h2 id="metric-definition-title">{activeDefinition.label}</h2><button type="button" aria-label="关闭指标释义" onClick={() => setDefinitionLabel(null)}>×</button></header><div className="metric-definition-body"><div><h3>指标释义</h3><p>{activeDefinition.description}</p></div>{activeDefinition.formula && <div><h3>计算公式</h3><p className="metric-formula">{activeDefinition.formula}</p></div>}<div className="metric-freshness"><span>数据时效</span><b>{activeDefinition.freshness}</b></div></div><footer className="modal-actions"><button type="button" className="primary" onClick={() => setDefinitionLabel(null)}>知道了</button></footer></section></div>}
  </section>;
}
