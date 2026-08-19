"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { applyBatchOperation, type BatchOperation, eligibleBatchItems, validateBatchPrice } from "./batch-operations";

type Rule = { dimension: string; operator: string; value: string };
type Group = {
  id: number;
  name: string;
  priority: number;
  scene: string;
  platform: string;
  adSlot: string;
  rules: Rule[];
  enabled: boolean;
  ab: boolean;
  traffic: number;
  experiment: "A对照组" | "B测试组";
  isDefault?: boolean;
};

type Dsp = {
  id: number;
  groupId: number;
  name: string;
  enabled: boolean;
  floor: number;
  pids: string[];
  minVersion: string;
  maxVersion: string;
  size: "全尺寸" | "自定义";
  customSize?: string;
  revenue: number;
  ecpm: number;
  requestValue: number;
  requests: number;
  returns: number;
  bidWins: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

const mainGroupNames = [
  "100011-开屏-100011（经期、北京）", "100010-123123", "10009-12313", "10008-测试",
  "10007-指定尺寸-副本-副本", "10006-指定尺寸-副本", "10005-指定尺寸-副本-副本",
  "10004-指定尺寸-副本", "10003-指定尺寸", "10002-XYY-1000", "10001-XYY",
  "10000-XYY-1000-副本", "18-YY1234567890XYY123❤", "17-XYY-复制17", "16-XYY-复制i16",
  "15-XYY-15", "14-XYY-复制", "13-XYY-复制修改21231242141", "12-XYY1", "11-X. YY",
  "10-XYY-复制", "8-XYY", "5-测试hqw2-复制22", "4-测试hqw2-复制", "3-XYY",
  "2-测试hqw2", "1-开屏默认分组-iOS",
];

const initialGroups: Group[] = [
  ...mainGroupNames.map((name, index) => ({
    id: 211 - index,
    name,
    priority: 100011 - index,
    scene: "开屏",
    platform: "IOS",
    adSlot: "1000-美柚-开屏广告",
    rules: index === 0
      ? [{ dimension: "身份", operator: "包含", value: "经期" }, { dimension: "城市", operator: "包含", value: "北京" }]
      : [],
    enabled: index === mainGroupNames.length - 1,
    ab: [0, 4, 6, 22, 23, 24, 25].includes(index),
    traffic: index === 0 ? 50 : 100,
    experiment: "B测试组" as const,
    isDefault: index === mainGroupNames.length - 1,
  })),
  { id: 301, name: "301-插屏默认分组-iOS", priority: 301, scene: "插屏", platform: "IOS", adSlot: "2001-美柚-插屏广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 302, name: "302-信息流-核心用户", priority: 302, scene: "信息流", platform: "IOS", adSlot: "3001-信息流广告", rules: [{ dimension: "身份", operator: "包含", value: "备孕" }], enabled: true, ab: true, traffic: 50, experiment: "B测试组" },
  { id: 303, name: "303-搜索默认分组-iOS", priority: 303, scene: "搜索", platform: "IOS", adSlot: "4001-搜索广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 304, name: "304-icon默认分组-iOS", priority: 304, scene: "icon", platform: "IOS", adSlot: "5001-icon广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 401, name: "401-开屏默认分组-Android", priority: 401, scene: "开屏", platform: "Android", adSlot: "1100-美柚-开屏广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 402, name: "402-Android-北京用户", priority: 402, scene: "开屏", platform: "Android", adSlot: "1100-美柚-开屏广告", rules: [{ dimension: "城市", operator: "包含", value: "北京" }], enabled: false, ab: false, traffic: 100, experiment: "A对照组" },
];

const initialDsps: Dsp[] = [
  { id: 1, groupId: 211, name: "xyysolid通用化公司重命名", enabled: true, floor: 0.3, pids: ["x-1000-ios"], minVersion: "9.01.0", maxVersion: "", size: "全尺寸", revenue: 0, ecpm: 0, requestValue: 0, requests: 0, returns: 0, bidWins: 0, impressions: 0, ctr: 0, cpc: 0 },
  { id: 3, groupId: 211, name: "优量汇", enabled: true, floor: 0.8, pids: ["gdt-splash-ios", "gdt-splash-premium"], minVersion: "9.01.0", maxVersion: "", size: "全尺寸", revenue: 86.2, ecpm: 7.4, requestValue: 2.1, requests: 15320, returns: 12880, bidWins: 8750, impressions: 8120, ctr: 2.1, cpc: 0.31 },
  { id: 4, groupId: 211, name: "穿山甲", enabled: false, floor: 1.2, pids: ["csj-splash-ios"], minVersion: "9.02.0", maxVersion: "", size: "全尺寸", revenue: 48.5, ecpm: 6.8, requestValue: 1.9, requests: 9320, returns: 7650, bidWins: 5320, impressions: 4980, ctr: 1.9, cpc: 0.28 },
  { id: 2, groupId: 210, name: "测试DSP来源", enabled: false, floor: 0.5, pids: ["demo-pid-02"], minVersion: "", maxVersion: "", size: "全尺寸", revenue: 12.6, ecpm: 4.2, requestValue: 1.8, requests: 8260, returns: 6901, bidWins: 5150, impressions: 4810, ctr: 1.7, cpc: 0.25 },
];

const sidebarItems = [
  "品牌智能化", "品牌小工具", "品牌管理", "女人通管理", "女人通消费管理", "女人通数据管理",
  "媒体数据管理", "DSP数据管理", "MARKETING API管理", "第三方DMP管理", "小工具", "移动端管理",
  "柚+ 管理", "全局配置管理", "诊断中心",
];

const emptyRule = (): Rule => ({ dimension: "身份", operator: "包含", value: "经期" });

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={onChange}><span /></button>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" aria-label="关闭" onClick={onClose}>×</button></header>
        {children}
      </section>
    </div>
  );
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{required && <b>*</b>}{label}</span><div>{children}{hint && <small>{hint}</small>}</div></label>;
}

export default function Home() {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [dsps, setDsps] = useState<Dsp[]>(initialDsps);
  const [scene, setScene] = useState("开屏");
  const [platform, setPlatform] = useState("IOS");
  const [selectedId, setSelectedId] = useState(211);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [modal, setModal] = useState<"group" | "dsp" | "ab" | "batch" | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingDspId, setEditingDspId] = useState<number | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [editingFloor, setEditingFloor] = useState<number | null>(null);
  const [selectedDspIds, setSelectedDspIds] = useState<number[]>([]);
  const [batchOperation, setBatchOperation] = useState<BatchOperation>("disable");
  const [batchPrice, setBatchPrice] = useState("");
  const [batchError, setBatchError] = useState("");
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [groupDraft, setGroupDraft] = useState({ name: "", priority: 100012, adSlot: "1000-美柚-开屏广告", rules: [] as Rule[] });
  const [dspDraft, setDspDraft] = useState({ name: "", size: "全尺寸" as "全尺寸" | "自定义", customSize: "", pids: [""], minVersion: "", maxVersion: "", floor: 0.3, enabled: true });

  useEffect(() => {
    try {
      const storedGroups = localStorage.getItem("adx-demo-groups");
      const storedDsps = localStorage.getItem("adx-demo-dsps-batch-v1");
      // Loading the browser-only demo snapshot requires one intentional hydration update.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (storedGroups) setGroups(JSON.parse(storedGroups));
      if (storedDsps) setDsps(JSON.parse(storedDsps));
    } catch { /* keep the seeded demo data */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("adx-demo-groups", JSON.stringify(groups));
    localStorage.setItem("adx-demo-dsps-batch-v1", JSON.stringify(dsps));
  }, [groups, dsps, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleGroups = useMemo(() => groups.filter((group) => group.scene === scene && group.platform === platform).sort((a, b) => b.priority - a.priority), [groups, scene, platform]);
  const selected = visibleGroups.find((group) => group.id === selectedId) ?? visibleGroups[0];

  const resetPidSelection = () => {
    setSelectedDspIds([]);
    setShowDisabled(false);
  };

  const selectGroup = (id: number) => {
    setSelectedId(id);
    setOpenMenu(null);
    resetPidSelection();
  };

  const changeScene = (nextScene: string) => {
    setScene(nextScene);
    const nextGroup = groups.filter((group) => group.scene === nextScene && group.platform === platform).sort((a, b) => b.priority - a.priority)[0];
    if (nextGroup) setSelectedId(nextGroup.id);
    resetPidSelection();
  };

  const changePlatform = (nextPlatform: string) => {
    setPlatform(nextPlatform);
    const nextGroup = groups.filter((group) => group.scene === scene && group.platform === nextPlatform).sort((a, b) => b.priority - a.priority)[0];
    if (nextGroup) setSelectedId(nextGroup.id);
    resetPidSelection();
  };

  const groupDsps = dsps.filter((dsp) => dsp.groupId === selected?.id);
  const enabledDsps = groupDsps.filter((dsp) => dsp.enabled);
  const disabledDsps = groupDsps.filter((dsp) => !dsp.enabled);
  const visibleDsps = showDisabled ? [...enabledDsps, ...disabledDsps] : enabledDsps;
  const selectedDsps = groupDsps.filter((dsp) => selectedDspIds.includes(dsp.id));
  const selectedPidCount = selectedDsps.reduce((sum, dsp) => sum + dsp.pids.length, 0);
  const enabledSelectedCount = selectedDsps.filter((dsp) => dsp.enabled).reduce((sum, dsp) => sum + dsp.pids.length, 0);
  const disabledSelectedCount = selectedDsps.filter((dsp) => !dsp.enabled).reduce((sum, dsp) => sum + dsp.pids.length, 0);
  const allVisibleSelected = visibleDsps.length > 0 && visibleDsps.every((dsp) => selectedDspIds.includes(dsp.id));

  const notify = (message: string) => setToast(message);
  const patchSelected = (patch: Partial<Group>) => selected && setGroups((current) => current.map((group) => group.id === selected.id ? { ...group, ...patch } : group));

  const openGroupModal = (group?: Group) => {
    setOpenMenu(null);
    setEditingGroupId(group?.id ?? null);
    setGroupDraft(group ? { name: group.name, priority: group.priority, adSlot: group.adSlot, rules: group.rules.map((rule) => ({ ...rule })) } : { name: "", priority: Math.max(...visibleGroups.map((item) => item.priority), 1) + 1, adSlot: scene === "开屏" ? "1000-美柚-开屏广告" : `${scene}-默认广告位`, rules: [] });
    setModal("group");
  };

  const saveGroup = (event: FormEvent) => {
    event.preventDefault();
    if (!groupDraft.name.trim()) return notify("请输入分组名称");
    if (editingGroupId) {
      setGroups((current) => current.map((group) => group.id === editingGroupId ? { ...group, ...groupDraft } : group));
      notify("分组已更新");
    } else {
      const group: Group = { id: Date.now(), ...groupDraft, name: groupDraft.name.trim(), scene, platform, enabled: false, ab: false, traffic: 100, experiment: "A对照组" };
      setGroups((current) => [group, ...current]);
      selectGroup(group.id);
      notify("分组已添加");
    }
    setModal(null);
  };

  const copyGroup = (group: Group) => {
    const copy = { ...group, id: Date.now(), name: `${group.name}-副本`, priority: Math.max(...visibleGroups.map((item) => item.priority), 1) + 1, enabled: false, isDefault: false };
    setGroups((current) => [copy, ...current]);
    selectGroup(copy.id);
    setOpenMenu(null);
    notify("已复制为新分组");
  };

  const openDspModal = (dsp?: Dsp) => {
    setEditingDspId(dsp?.id ?? null);
    setDspDraft(dsp ? { name: dsp.name, size: dsp.size, customSize: dsp.customSize ?? "", pids: [...dsp.pids], minVersion: dsp.minVersion, maxVersion: dsp.maxVersion, floor: dsp.floor, enabled: dsp.enabled } : { name: "", size: "全尺寸", customSize: "", pids: [""], minVersion: "", maxVersion: "", floor: 0.3, enabled: true });
    setModal("dsp");
  };

  const saveDsp = (event: FormEvent) => {
    event.preventDefault();
    if (!dspDraft.name || !dspDraft.pids.some((pid) => pid.trim())) return notify("请填写 DSP 来源和 PID");
    if (editingDspId) {
      setDsps((current) => current.map((dsp) => dsp.id === editingDspId ? { ...dsp, ...dspDraft, pids: dspDraft.pids.filter(Boolean) } : dsp));
      notify("DSP 来源已更新");
    } else if (selected) {
      setDsps((current) => [...current, { id: Date.now(), groupId: selected.id, ...dspDraft, pids: dspDraft.pids.filter(Boolean), revenue: 0, ecpm: 0, requestValue: 0, requests: 0, returns: 0, bidWins: 0, impressions: 0, ctr: 0, cpc: 0 }]);
      notify("DSP 来源已添加");
    }
    setModal(null);
  };

  const patchDsp = (id: number, patch: Partial<Dsp>) => setDsps((current) => current.map((dsp) => dsp.id === id ? { ...dsp, ...patch } : dsp));
  const percent = (part: number, whole: number) => whole ? `${(part / whole * 100).toFixed(2).replace(".00", "")}%` : "0%";

  const toggleVisibleDsps = () => {
    const visibleIds = visibleDsps.map((dsp) => dsp.id);
    setSelectedDspIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  };

  const openBatchModal = () => {
    if (!selectedPidCount) return;
    setBatchOperation(enabledSelectedCount ? "disable" : disabledSelectedCount ? "enable" : "price");
    setBatchPrice("");
    setBatchError("");
    setModal("batch");
  };

  const submitBatchOperation = (event: FormEvent) => {
    event.preventDefault();
    const eligible = eligibleBatchItems(selectedDsps, batchOperation);
    if (!eligible.length) {
      setBatchError(batchOperation === "disable" ? "选中的 PID 中没有已启用项" : "选中的 PID 中没有已停用项");
      return;
    }

    let price: number | undefined;
    if (batchOperation === "price") {
      const error = validateBatchPrice(batchPrice);
      if (error) return setBatchError(error);
      price = Number(batchPrice);
    }

    const affectedPidCount = eligible.reduce((sum, dsp) => sum + dsp.pids.length, 0);
    setDsps((current) => applyBatchOperation(current, eligible.map((dsp) => dsp.id), batchOperation, price));
    setSelectedDspIds([]);
    setModal(null);
    notify(batchOperation === "disable"
      ? `已停用 ${affectedPidCount} 个 PID`
      : batchOperation === "enable"
        ? `已启用 ${affectedPidCount} 个 PID`
        : `已将 ${affectedPidCount} 个 PID 的价格设置为 ¥${price}`);
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "collapsed" : ""}`}>
      <header className="topbar">
        <button className="top-menu" aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"} onClick={(event) => { event.stopPropagation(); setSidebarCollapsed((value) => !value); }}>☰</button>
        <strong className="brand">广告投放运营后台</strong>
        <nav><button type="button">广告投放运营后台</button><button type="button">权限申请</button></nav>
      </header>

      <aside className="sidebar">
        <div className="profile"><span>张佳琪</span><button type="button" onClick={() => notify("演示环境不会退出登录")}>退出</button></div>
        {sidebarItems.map((item) => <button type="button" className="side-row" key={item}>{item}<span>‹</span></button>)}
        <button type="button" className="side-row active">ADX流量工具<span>⌄</span></button>
        <button type="button" className="sub-row">›&nbsp; 流量分组管理</button>
        <button type="button" className="side-row">广告交互管理<span>‹</span></button>
      </aside>

      <main className="content">
        <section className="panel">
          <h1>流量分组管理</h1>
          <div className="filters">
            <label>广告场景：<select aria-label="广告场景" value={scene} onChange={(event) => changeScene(event.target.value)}><option>开屏</option><option>插屏</option><option>信息流</option><option>搜索</option><option>icon</option></select></label>
            <label>平台：<select aria-label="平台" value={platform} onChange={(event) => changePlatform(event.target.value)}><option>IOS</option><option>Android</option></select></label>
          </div>
          <button type="button" className="primary" onClick={() => openGroupModal()}>＋ 添加分组</button>

          <div className="groups" aria-label="分组列表">
            {visibleGroups.length ? visibleGroups.map((group) => (
              <div className={`group-item ${group.id === selected?.id ? "selected" : ""}`} key={group.id}>
                <button type="button" className="group-select" onClick={() => selectGroup(group.id)}><span>{group.name}</span>{group.ab && <em>AB</em>}{!group.enabled && <small>已关闭</small>}</button>
                <button type="button" className="group-more" aria-label={`${group.name}更多操作`} onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === group.id ? null : group.id); }}>⋮</button>
                {openMenu === group.id && <div className="group-menu"><button type="button" onClick={() => openGroupModal(group)}>编辑分组</button><button type="button" onClick={() => copyGroup(group)}>复制</button></div>}
              </div>
            )) : <div className="empty">当前场景与平台暂无分组，点击“添加分组”新建。</div>}
          </div>

          {selected && <>
            <div className="group-detail">
              <div><strong>广告位：</strong><span className="pink-tag">{selected.adSlot}</span></div>
              <div><strong>分组规则：</strong>{selected.rules.length ? selected.rules.map((rule, index) => <span className="rule-tag" key={`${rule.dimension}-${index}`}>{rule.dimension}({rule.operator}): {rule.value}</span>) : <span className="muted">默认流量，无附加规则</span>}</div>
              <div className="controls"><strong>分组开关</strong><Toggle checked={selected.enabled} label="分组开关" onChange={() => { patchSelected({ enabled: !selected.enabled }); notify(selected.enabled ? "分组已关闭" : "分组已开启"); }} /><i /> <select aria-label="实验组" value={selected.experiment} onChange={(event) => patchSelected({ experiment: event.target.value as Group["experiment"], ab: true })}><option>A对照组</option><option>B测试组</option></select><strong>流量占比</strong><input aria-label="流量占比" type="number" min="0" max="100" value={selected.traffic} onChange={(event) => patchSelected({ traffic: Math.min(100, Math.max(0, Number(event.target.value))) })} /><span>%</span><button type="button" className="primary push-right" onClick={() => setModal("ab")}>查看A/B测试数据</button></div>
            </div>

            <div className="pid-toolbar">
              <button type="button" className="primary" onClick={() => openDspModal()}>＋ 添加PID</button>
              <div className="pid-toolbar-actions">
                {selectedPidCount > 0 && <span className="selection-summary">已选择 {selectedPidCount} 个 PID</span>}
                <button type="button" className="secondary" disabled={!selectedPidCount} onClick={openBatchModal}>批量操作</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th className="selection-cell"><input type="checkbox" aria-label="选择当前显示的全部PID" checked={allVisibleSelected} onChange={toggleVisibleDsps} /></th>{["操作", "DSP来源", "状态", "底价", "预估收入", "eCPM", "千次请求价格", "请求量", "返回量", "返回率", "竞价成功数", "竞价成功率", "展示量", "竞胜展示率", "点击率", "CPC"].map((heading, index) => <th key={heading}>{heading}{index > 2 && index !== 10 && <span className="help" title={`${heading}指标说明`}>?</span>}</th>)}</tr></thead>
                <tbody>
                  <tr className="summary-row"><td /><td /><td><strong>{enabledDsps.length}个DSP来源已启用</strong></td><td /><td /><td>¥{enabledDsps.reduce((sum, item) => sum + item.revenue, 0).toFixed(0)}</td><td>{enabledDsps.reduce((sum, item) => sum + item.ecpm, 0).toFixed(2)}</td><td>¥{enabledDsps.reduce((sum, item) => sum + item.requestValue, 0).toFixed(0)}</td><td>{enabledDsps.reduce((sum, item) => sum + item.requests, 0)}</td><td>{enabledDsps.reduce((sum, item) => sum + item.returns, 0)}</td><td>{percent(enabledDsps.reduce((sum, item) => sum + item.returns, 0), enabledDsps.reduce((sum, item) => sum + item.requests, 0))}</td><td>—</td><td>—</td><td>{enabledDsps.reduce((sum, item) => sum + item.impressions, 0)}</td><td>—</td><td>0%</td><td>¥0</td></tr>
                  {enabledDsps.map((dsp) => <DspRow key={dsp.id} dsp={dsp} selected={selectedDspIds.includes(dsp.id)} onSelect={() => setSelectedDspIds((current) => current.includes(dsp.id) ? current.filter((id) => id !== dsp.id) : [...current, dsp.id])} editingFloor={editingFloor} setEditingFloor={setEditingFloor} patchDsp={patchDsp} openEdit={() => openDspModal(dsp)} percent={percent} />)}
                  {showDisabled && disabledDsps.map((dsp) => <DspRow key={dsp.id} dsp={dsp} selected={selectedDspIds.includes(dsp.id)} onSelect={() => setSelectedDspIds((current) => current.includes(dsp.id) ? current.filter((id) => id !== dsp.id) : [...current, dsp.id])} editingFloor={editingFloor} setEditingFloor={setEditingFloor} patchDsp={patchDsp} openEdit={() => openDspModal(dsp)} percent={percent} />)}
                </tbody>
              </table>
            </div>
            <button type="button" className="disabled-toggle" onClick={() => setShowDisabled((value) => !value)}><span>{showDisabled ? "⌄" : "›"}</span>{disabledDsps.length} 个DSP来源未启用</button>
          </>}
        </section>
      </main>

      {modal === "group" && <Modal title={editingGroupId ? "编辑分组" : "添加分组"} onClose={() => setModal(null)}>
        <form onSubmit={saveGroup}>
          <div className="modal-body">
            <Field label="分组名称" required><input maxLength={20} placeholder="请输入分组名称" value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} /><small className="counter">{groupDraft.name.length}/20</small></Field>
            <Field label="优先级" hint="数值越大优先级越高"><input type="number" min="2" max="999999" value={groupDraft.priority} onChange={(event) => setGroupDraft({ ...groupDraft, priority: Number(event.target.value) })} /></Field>
            <Field label="广告场景"><input disabled value={scene} /></Field>
            <Field label="平台"><input disabled value={platform} /></Field>
            <Field label="广告位" required><select value={groupDraft.adSlot} onChange={(event) => setGroupDraft({ ...groupDraft, adSlot: event.target.value })}><option>1000-美柚-开屏广告</option><option>1001-美柚-开屏广告-新</option><option>{scene}-默认广告位</option></select></Field>
            <Field label="分组规则"><div className="rule-editor">{groupDraft.rules.map((rule, index) => <div className="rule-row" key={index}><select aria-label={`规则${index + 1}维度`} value={rule.dimension} onChange={(event) => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, dimension: event.target.value } : item) })}><option>身份</option><option>城市</option><option>年龄</option><option>应用版本</option></select><select aria-label={`规则${index + 1}关系`} value={rule.operator} onChange={(event) => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item) })}><option>包含</option><option>不包含</option><option>等于</option></select><input aria-label={`规则${index + 1}值`} value={rule.value} onChange={(event) => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} /><button type="button" aria-label="删除规则" onClick={() => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>)}<button type="button" className="secondary" onClick={() => setGroupDraft({ ...groupDraft, rules: [...groupDraft.rules, emptyRule()] })}>＋ 添加规则</button></div></Field>
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button className="primary" type="submit">提 交</button></div>
        </form>
      </Modal>}

      {modal === "dsp" && <Modal title={editingDspId ? "编辑DSP来源" : "添加DSP来源"} onClose={() => setModal(null)}>
        <form onSubmit={saveDsp}>
          <div className="modal-body">
            <Field label="DSP来源" required><select value={dspDraft.name} onChange={(event) => setDspDraft({ ...dspDraft, name: event.target.value })}><option value="">请输入关键词搜索DSP来源</option><option>xyysolid通用化公司重命名</option><option>优量汇</option><option>穿山甲</option><option>百度联盟</option></select></Field>
            <Field label="广告场景"><input disabled value={scene} /></Field><Field label="平台"><input disabled value={platform} /></Field><Field label="广告位"><input disabled value={selected?.adSlot ?? ""} /></Field>
            <Field label="尺寸"><div className="radios"><label><input type="radio" checked={dspDraft.size === "全尺寸"} onChange={() => setDspDraft({ ...dspDraft, size: "全尺寸" })} />全尺寸</label><label><input type="radio" checked={dspDraft.size === "自定义"} onChange={() => setDspDraft({ ...dspDraft, size: "自定义" })} />自定义</label>{dspDraft.size === "自定义" && <input placeholder="如 1080×1920" value={dspDraft.customSize} onChange={(event) => setDspDraft({ ...dspDraft, customSize: event.target.value })} />}</div></Field>
            <Field label="PID"><div className="pid-list">{dspDraft.pids.map((pid, index) => <div className="pid-row" key={index}><b>PID #{index + 1}</b><input placeholder="请输入PID" value={pid} onChange={(event) => setDspDraft({ ...dspDraft, pids: dspDraft.pids.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />{index > 0 && <button type="button" aria-label="删除PID" onClick={() => setDspDraft({ ...dspDraft, pids: dspDraft.pids.filter((_, itemIndex) => itemIndex !== index) })}>×</button>}</div>)}<div className="version-row"><span>应用版本</span><input placeholder="最小版本，如 9.01.0" value={dspDraft.minVersion} onChange={(event) => setDspDraft({ ...dspDraft, minVersion: event.target.value })} /><input placeholder="最大版本，如 9.01.0" value={dspDraft.maxVersion} onChange={(event) => setDspDraft({ ...dspDraft, maxVersion: event.target.value })} /></div><button type="button" className="secondary" onClick={() => setDspDraft({ ...dspDraft, pids: [...dspDraft.pids, ""] })}>＋ 添加PID</button></div></Field>
            <Field label="底价" required><input type="number" min="0" step="0.1" value={dspDraft.floor} onChange={(event) => setDspDraft({ ...dspDraft, floor: Number(event.target.value) })} /></Field>
            <Field label="状态"><Toggle checked={dspDraft.enabled} label="DSP状态" onChange={() => setDspDraft({ ...dspDraft, enabled: !dspDraft.enabled })} /></Field>
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button className="primary" type="submit">提 交</button></div>
        </form>
      </Modal>}

      {modal === "batch" && <Modal title="批量操作" onClose={() => setModal(null)}>
        <form onSubmit={submitBatchOperation}>
          <div className="modal-body">
            <div className="batch-selection-tip">已选择 <strong>{selectedPidCount}</strong> 个DSP来源<span>数量按选中的 PID 条数统计</span></div>
            <Field label="操作类型" required>
              <div className="batch-operation-list">
                <label aria-label="批量停用" className={`batch-option ${enabledSelectedCount ? "" : "unavailable"}`}>
                  <input type="radio" name="batch-operation" checked={batchOperation === "disable"} disabled={!enabledSelectedCount} onChange={() => { setBatchOperation("disable"); setBatchError(""); }} />
                  <span><strong>停用</strong><small>仅处理已启用的 PID（可操作 {enabledSelectedCount} 个）</small></span>
                </label>
                <label aria-label="批量启用" className={`batch-option ${disabledSelectedCount ? "" : "unavailable"}`}>
                  <input type="radio" name="batch-operation" checked={batchOperation === "enable"} disabled={!disabledSelectedCount} onChange={() => { setBatchOperation("enable"); setBatchError(""); }} />
                  <span><strong>启用</strong><small>仅处理已停用的 PID（可操作 {disabledSelectedCount} 个）</small></span>
                </label>
                <label aria-label="批量设置价格" className="batch-option">
                  <input type="radio" name="batch-operation" checked={batchOperation === "price"} onChange={() => { setBatchOperation("price"); setBatchError(""); }} />
                  <span><strong>设置价格</strong><small>修改全部选中 PID 的价格</small></span>
                </label>
              </div>
            </Field>
            {batchOperation === "price" && <Field label="价格" required>
              <div className="currency-input"><span>¥</span><input type="number" inputMode="decimal" min="0" max="9999" step="0.01" placeholder="请输入价格" value={batchPrice} onChange={(event) => { setBatchPrice(event.target.value); setBatchError(""); }} /></div>
              <small>人民币（¥），支持 0–9999，最多两位小数</small>
            </Field>}
            {batchError && <div className="field-error" role="alert">{batchError}</div>}
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button className="primary" type="submit">确 定</button></div>
        </form>
      </Modal>}

      {modal === "ab" && <Modal title="查看A/B测试数据" onClose={() => setModal(null)} wide>
        <div className="modal-body ab-body"><div className="ab-meta"><span>测试名称：{selected?.name}</span><span>数据统计周期：2026-07-30 16:47:16 ~ 2026-08-19 16:25:18</span><span>实验创建时间：2026-07-30 16:47:16</span></div><div className="ab-tabs"><button className="active">全量A组</button><button>全量B组</button></div><div className="table-wrap"><table><thead><tr>{["组别", "累计入组用户", "千人均收益", "预估收入", "eCPM", "千次请求价值", "请求量", "返回量", "返回率", "展示量", "展示率", "点击数", "点击率", "CPC"].map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody><tr><td>A（对照组）</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0%</td><td>0</td><td>0%</td><td>0</td><td>0%</td><td>0</td></tr><tr><td>B（实验组）</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>37</td><td>10</td><td>27.03%</td><td>0</td><td>0%</td><td>0</td><td>0%</td><td>0</td></tr><tr className="summary-row"><td>对比涨幅</td>{Array.from({ length: 13 }).map((_, index) => <td key={index}>—</td>)}</tr></tbody></table></div></div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button type="button" className="primary" onClick={() => setModal(null)}>确 定</button></div>
      </Modal>}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function DspRow({ dsp, selected, onSelect, editingFloor, setEditingFloor, patchDsp, openEdit, percent }: { dsp: Dsp; selected: boolean; onSelect: () => void; editingFloor: number | null; setEditingFloor: (id: number | null) => void; patchDsp: (id: number, patch: Partial<Dsp>) => void; openEdit: () => void; percent: (part: number, whole: number) => string }) {
  return <tr className={!dsp.enabled ? "disabled-row" : ""}><td className="selection-cell"><input type="checkbox" aria-label={`选择 ${dsp.name} 的PID`} checked={selected} onChange={onSelect} /></td><td><button type="button" className="text-action" onClick={openEdit}>编辑</button></td><td>{dsp.name}<small className="pid-note">{dsp.pids.join(" / ")}</small></td><td><Toggle checked={dsp.enabled} label={`${dsp.name}状态`} onChange={() => patchDsp(dsp.id, { enabled: !dsp.enabled })} /></td><td>{editingFloor === dsp.id ? <span className="floor-edit"><input aria-label="底价" type="number" min="0" step="0.1" value={dsp.floor} onChange={(event) => patchDsp(dsp.id, { floor: Number(event.target.value) })} /><button type="button" aria-label="保存底价" onClick={() => setEditingFloor(null)}>✓</button></span> : <button type="button" className="floor-value" onClick={() => setEditingFloor(dsp.id)}>¥{dsp.floor} <span>✎</span></button>}</td><td>¥{dsp.revenue}</td><td>{dsp.ecpm.toFixed(2)}</td><td>¥{dsp.requestValue}</td><td>{dsp.requests}</td><td>{dsp.returns}</td><td>{percent(dsp.returns, dsp.requests)}</td><td>{dsp.bidWins}</td><td>{percent(dsp.bidWins, dsp.returns)}</td><td>{dsp.impressions}</td><td>{percent(dsp.impressions, dsp.bidWins)}</td><td>{dsp.ctr}%</td><td>¥{dsp.cpc}</td></tr>;
}
