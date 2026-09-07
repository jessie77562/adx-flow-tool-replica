"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  filterPidRecords,
  PID_AD_SLOTS,
  PID_DSP_SOURCES,
  PID_SCENES,
  type PidDraft,
  type PidDraftErrors,
  type PidFilters,
  type PidRecord,
  validatePidDraft,
} from "./pid-management";

type GroupReference = {
  id: number;
  name: string;
  scene: string;
  platform: string;
};

type PidManagerProps = {
  groups: GroupReference[];
  onOpenGroup: (groupId: number) => void;
  onNotify: (message: string) => void;
};

const emptyFilters = (): PidFilters => ({ scene: "", platform: "", adSlot: "", dspSources: [], sdkVersionOperator: "gte", sdkVersion: "", groupIds: [], showAll: false });
const emptyDraft = (): PidDraft => ({ dspSource: "", scene: "", platform: "", adSlot: "", pid: "", minSdkVersion: "", maxSdkVersion: "", enabled: true });

const initialPidRecords: PidRecord[] = [
  { id: 1, pid: "x-1000-ios", dspSource: "腾讯广告", enabled: true, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", groupIds: [211], minSdkVersion: "9.01.0", maxSdkVersion: "" },
  { id: 2, pid: "gdt-splash-ios", dspSource: "腾讯广告", enabled: true, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", groupIds: [211, 210], minSdkVersion: "9.01.0", maxSdkVersion: "" },
  { id: 3, pid: "gdt-splash-premium", dspSource: "腾讯广告", enabled: true, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", groupIds: [211], minSdkVersion: "9.01.0", maxSdkVersion: "10.00.0" },
  { id: 4, pid: "csj-splash-ios", dspSource: "穿山甲", enabled: false, platform: "IOS", scene: "开屏", adSlot: "1000-美柚-开屏广告", groupIds: [211], minSdkVersion: "9.02.0", maxSdkVersion: "" },
  { id: 5, pid: "ks-splash-android", dspSource: "快手", enabled: true, platform: "Android", scene: "开屏", adSlot: "1100-美柚-开屏广告", groupIds: [401], minSdkVersion: "9.03.0", maxSdkVersion: "" },
  { id: 6, pid: "mtg-interstitial-ios", dspSource: "Mintegral", enabled: true, platform: "IOS", scene: "插屏", adSlot: "2001-美柚-插屏广告", groupIds: [301], minSdkVersion: "9.01.0", maxSdkVersion: "" },
  { id: 7, pid: "unity-interstitial-android", dspSource: "Unity Ads", enabled: false, platform: "Android", scene: "插屏", adSlot: "2101-美柚-插屏广告", groupIds: [403], minSdkVersion: "9.01.0", maxSdkVersion: "" },
  { id: 8, pid: "applovin-feed-ios", dspSource: "AppLovin", enabled: true, platform: "IOS", scene: "社区-信息流", adSlot: "3001-社区信息流广告", groupIds: [302, 305], minSdkVersion: "9.04.0", maxSdkVersion: "" },
  { id: 9, pid: "admob-feed-android", dspSource: "AdMob", enabled: true, platform: "Android", scene: "社区-信息流", adSlot: "3101-社区信息流广告", groupIds: [404], minSdkVersion: "9.04.0", maxSdkVersion: "" },
  { id: 10, pid: "csj-detail-ios", dspSource: "巨量引擎", enabled: true, platform: "IOS", scene: "社区-详情页", adSlot: "3002-社区详情页广告", groupIds: [306], minSdkVersion: "9.05.0", maxSdkVersion: "" },
  { id: 11, pid: "gdt-community-other", dspSource: "腾讯广告", enabled: false, platform: "IOS", scene: "社区-其他广告位", adSlot: "3003-社区其他广告位", groupIds: [], minSdkVersion: "9.05.0", maxSdkVersion: "" },
  { id: 12, pid: "ks-search-ios", dspSource: "快手", enabled: true, platform: "IOS", scene: "搜索", adSlot: "4001-美柚-搜索广告", groupIds: [303], minSdkVersion: "9.06.0", maxSdkVersion: "" },
  { id: 13, pid: "admob-search-android", dspSource: "AdMob", enabled: true, platform: "Android", scene: "搜索", adSlot: "4101-美柚-搜索广告", groupIds: [405], minSdkVersion: "9.06.0", maxSdkVersion: "" },
  { id: 14, pid: "applovin-icon-ios", dspSource: "AppLovin", enabled: true, platform: "IOS", scene: "icon", adSlot: "5001-icon广告", groupIds: [], minSdkVersion: "9.07.0", maxSdkVersion: "" },
];

function PidModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal pid-modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" aria-label="关闭" onClick={onClose}>×</button></header>{children}</section></div>;
}

function PidFormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="pid-form-field"><span><b>*</b>{label}</span><div>{children}{error && <small className="pid-field-error">{error}</small>}</div></label>;
}

function MultiSelectFilter({ label, values, options, onToggle, onClear }: { label: string; values: string[]; options: { value: string; label: string }[]; onToggle: (value: string) => void; onClear: () => void }) {
  const selectedLabels = values.map((value) => options.find((option) => option.value === value)?.label).filter(Boolean) as string[];
  const summary = !selectedLabels.length ? "全部" : selectedLabels.length <= 2 ? selectedLabels.join("、") : `已选 ${selectedLabels.length} 项`;
  return <div className="pid-filter-field"><span>{label}</span><details className="filter-multi-select"><summary title={summary}>{summary}</summary><div className="filter-multi-options" role="group" aria-label={`${label}多选`}><button type="button" className={!values.length ? "active" : ""} onClick={onClear}>全部</button>{options.map((option) => <label key={option.value}><input type="checkbox" checked={values.includes(option.value)} onChange={() => onToggle(option.value)} /><span>{option.label}</span></label>)}</div></details></div>;
}

export default function PidManager({ groups, onOpenGroup, onNotify }: PidManagerProps) {
  const [records, setRecords] = useState<PidRecord[]>(initialPidRecords);
  const [filters, setFilters] = useState<PidFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<PidFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PidDraft>(emptyDraft);
  const [errors, setErrors] = useState<PidDraftErrors>({});
  const [showForm, setShowForm] = useState(false);
  const [pendingDisableId, setPendingDisableId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- Restore browser-local demo records once after hydration. */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("adx-demo-pid-manager-v1");
      if (stored) setRecords(JSON.parse(stored));
    } catch { /* keep seeded records */ }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) localStorage.setItem("adx-demo-pid-manager-v1", JSON.stringify(records));
  }, [hydrated, records]);

  const filteredRecords = useMemo(() => filterPidRecords(records, appliedFilters), [records, appliedFilters]);
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allFilterSlots = [...new Set(PID_AD_SLOTS.map((slot) => slot.value))];
  const formSlots = PID_AD_SLOTS.filter((slot) => (!draft.scene || slot.scene === draft.scene) && (!draft.platform || slot.platform === draft.platform));
  const pendingDisable = records.find((record) => record.id === pendingDisableId);
  const groupFilterOptions = groups.map((group) => ({ value: String(group.id), label: group.name }));

  const toggleArrayFilter = (key: "dspSources" | "groupIds", value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  };

  const query = (event?: FormEvent) => {
    event?.preventDefault();
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const reset = () => {
    const cleared = emptyFilters();
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (record: PidRecord) => {
    setEditingId(record.id);
    setDraft({ dspSource: record.dspSource, scene: record.scene, platform: record.platform, adSlot: record.adSlot, pid: record.pid, minSdkVersion: record.minSdkVersion, maxSdkVersion: record.maxSdkVersion, enabled: record.enabled });
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validatePidDraft(draft, records, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    if (editingId === null) {
      setRecords((current) => [{ id: Date.now(), ...draft, platform: draft.platform as PidRecord["platform"], pid: draft.pid.trim(), minSdkVersion: draft.minSdkVersion.trim(), maxSdkVersion: draft.maxSdkVersion.trim(), groupIds: [] }, ...current]);
      onNotify("新增成功");
    } else {
      setRecords((current) => current.map((record) => record.id === editingId ? { ...record, ...draft, platform: draft.platform as PidRecord["platform"], pid: draft.pid.trim(), minSdkVersion: draft.minSdkVersion.trim(), maxSdkVersion: draft.maxSdkVersion.trim() } : record));
      onNotify("保存成功");
    }
    setAppliedFilters({ ...filters });
    setPage(1);
    closeForm();
  };

  const enableRecord = (record: PidRecord) => {
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, enabled: true } : item));
    onNotify("启用成功");
  };

  const confirmDisable = () => {
    if (pendingDisableId === null) return;
    setRecords((current) => current.map((item) => item.id === pendingDisableId ? { ...item, enabled: false } : item));
    setPendingDisableId(null);
    onNotify("停用成功");
  };

  return <section className="panel pid-manager-panel">
    <h1>PID 管理</h1>
    <form className="pid-filters" onSubmit={query}>
      <label>广告场景<select aria-label="PID广告场景筛选" value={filters.scene} onChange={(event) => setFilters({ ...filters, scene: event.target.value })}><option value="">全部场景</option>{PID_SCENES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>平台<select aria-label="PID平台筛选" value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}><option value="">全部平台</option><option value="Android">安卓</option><option value="IOS">iOS</option></select></label>
      <label>广告位<select aria-label="PID广告位筛选" value={filters.adSlot} onChange={(event) => setFilters({ ...filters, adSlot: event.target.value })}><option value="">全部广告位</option>{allFilterSlots.map((item) => <option key={item}>{item}</option>)}</select></label>
      <MultiSelectFilter label="DSP 来源" values={filters.dspSources} options={PID_DSP_SOURCES.map((source) => ({ value: source, label: source }))} onToggle={(value) => toggleArrayFilter("dspSources", value)} onClear={() => setFilters((current) => ({ ...current, dspSources: [] }))} />
      <div className="pid-filter-field"><span>SDK 版本</span><div className="pid-version-filter"><select aria-label="SDK版本关系" value={filters.sdkVersionOperator} onChange={(event) => setFilters({ ...filters, sdkVersionOperator: event.target.value as PidFilters["sdkVersionOperator"] })}><option value="gte">大于等于</option><option value="lte">小于等于</option><option value="gt">大于</option><option value="lt">小于</option><option value="contains">包含</option></select><input aria-label="SDK版本筛选值" value={filters.sdkVersion} placeholder="如 9.01.0" onChange={(event) => setFilters({ ...filters, sdkVersion: event.target.value })} /></div></div>
      <MultiSelectFilter label="分组" values={filters.groupIds} options={groupFilterOptions} onToggle={(value) => toggleArrayFilter("groupIds", value)} onClear={() => setFilters((current) => ({ ...current, groupIds: [] }))} />
      <div className="pid-filter-actions"><button type="submit" className="primary">查询</button><button type="button" className="secondary" onClick={reset}>重置</button></div>
    </form>

    <div className="pid-list-heading"><div><strong>PID 列表</strong><span>共 {filteredRecords.length} 条</span></div><div className="pid-list-heading-actions"><label className="pid-show-all-toggle"><input type="checkbox" checked={filters.showAll} onChange={(event) => { const showAll = event.target.checked; setFilters((current) => ({ ...current, showAll })); setAppliedFilters((current) => ({ ...current, showAll })); setPage(1); }} /><span>展示全部 PID</span></label><button type="button" className="primary" onClick={openCreate}>＋ 新增 PID</button></div></div>
    <div className="table-wrap pid-management-table"><table><thead><tr><th>PID</th><th>DSP 来源</th><th>状态</th><th>平台</th><th>广告场景</th><th>广告位</th><th>SDK 版本配置</th><th>绑定分组信息</th><th>操作</th></tr></thead><tbody>
      {visibleRecords.map((record) => <tr key={record.id}><td><strong>{record.pid}</strong></td><td>{record.dspSource}</td><td><span className={`pid-status ${record.enabled ? "enabled" : "disabled"}`}>{record.enabled ? "开启" : "停用"}</span></td><td>{record.platform === "IOS" ? "iOS" : "安卓"}</td><td>{record.scene}</td><td>{record.adSlot}</td><td>{record.minSdkVersion}{record.maxSdkVersion ? ` ～ ${record.maxSdkVersion}` : " 以上"}</td><td>{record.groupIds.length ? <div className="bound-groups">{record.groupIds.map((groupId) => { const group = groups.find((item) => item.id === groupId); return group ? <button type="button" className={!record.enabled ? "invalid" : ""} key={groupId} onClick={() => onOpenGroup(groupId)}>{group.name}{!record.enabled ? "（失效）" : ""}</button> : null; })}</div> : "-"}</td><td><div className="pid-row-actions"><button type="button" onClick={() => openEdit(record)}>编辑</button>{record.enabled ? <button type="button" className="danger" onClick={() => setPendingDisableId(record.id)}>停用</button> : <button type="button" onClick={() => enableRecord(record)}>启用</button>}</div></td></tr>)}
      {!visibleRecords.length && <tr><td colSpan={9}><div className="empty">暂无符合筛选条件的 PID</div></td></tr>}
    </tbody></table></div>

    <div className="pid-pagination"><span>共 {filteredRecords.length} 条</span><label>每页<select aria-label="每页条数" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option>10</option><option>20</option><option>50</option></select>条</label><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><span>第 {safePage} / {totalPages} 页</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button></div>

    {showForm && <PidModal title={editingId === null ? "新增 PID" : "编辑 PID"} onClose={closeForm}><form onSubmit={save}><div className="pid-form-body">
      <PidFormField label="DSP 来源" error={errors.dspSource}><select value={draft.dspSource} onChange={(event) => setDraft({ ...draft, dspSource: event.target.value })}><option value="">请选择 DSP 来源</option>{PID_DSP_SOURCES.map((item) => <option key={item}>{item}</option>)}</select></PidFormField>
      <PidFormField label="广告场景" error={errors.scene}><select value={draft.scene} onChange={(event) => setDraft({ ...draft, scene: event.target.value, adSlot: "" })}><option value="">请选择广告场景</option>{PID_SCENES.map((item) => <option key={item}>{item}</option>)}</select></PidFormField>
      <PidFormField label="平台" error={errors.platform}><select value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value as PidDraft["platform"], adSlot: "" })}><option value="">请选择平台</option><option value="Android">安卓</option><option value="IOS">iOS</option></select></PidFormField>
      <PidFormField label="广告位" error={errors.adSlot}><select value={draft.adSlot} onChange={(event) => setDraft({ ...draft, adSlot: event.target.value })}><option value="">请选择广告位</option>{formSlots.map((slot) => <option key={`${slot.platform}-${slot.value}`} value={slot.value}>{slot.value}</option>)}</select></PidFormField>
      <PidFormField label="PID" error={errors.pid}><input value={draft.pid} placeholder="请输入 PID" maxLength={64} onChange={(event) => setDraft({ ...draft, pid: event.target.value })} /></PidFormField>
      <PidFormField label="最低 SDK 版本" error={errors.minSdkVersion}><input value={draft.minSdkVersion} placeholder="如 9.01.0" onChange={(event) => setDraft({ ...draft, minSdkVersion: event.target.value })} /></PidFormField>
      <PidFormField label="最高 SDK 版本" error={errors.maxSdkVersion}><input value={draft.maxSdkVersion} placeholder="选填，须大于最低版本" onChange={(event) => setDraft({ ...draft, maxSdkVersion: event.target.value })} /></PidFormField>
      <div className="pid-form-field"><span>状态</span><div className="pid-status-control"><button type="button" role="switch" aria-checked={draft.enabled} aria-label="PID状态" className={`toggle ${draft.enabled ? "on" : ""}`} onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}><span /></button><span>{draft.enabled ? "开启" : "停用"}</span></div></div>
    </div><div className="modal-actions"><button type="button" className="secondary" onClick={closeForm}>取消</button><button type="submit" className="primary">提交</button></div></form></PidModal>}

    {pendingDisable && <PidModal title="停用 PID" onClose={() => setPendingDisableId(null)}><div className="delete-confirm-body"><span className="delete-warning" aria-hidden="true">!</span><div><h3>确认停用 PID“{pendingDisable.pid}”吗？</h3><p>停用后不可再被新的分组绑定；已有绑定将继续展示并标记为失效。</p></div></div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setPendingDisableId(null)}>取消</button><button type="button" className="danger-primary" onClick={confirmDisable}>确认停用</button></div></PidModal>}
  </section>;
}
