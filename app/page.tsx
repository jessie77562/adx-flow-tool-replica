"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  buildExclusiveMatchTrace,
  duplicatePriority,
  MatchContext,
  selectExclusiveStrategy,
  TargetingRule,
} from "./strategy-engine";

type AdSlot = {
  id: string;
  code: string;
  name: string;
  scene: string;
  platform: string;
  size: string;
};

type Strategy = {
  id: number;
  name: string;
  priority: number;
  adSlotId: string;
  rules: TargetingRule[];
  enabled: boolean;
  ab: boolean;
  traffic: number;
  experiment: "A对照组" | "B测试组";
  isDefault?: boolean;
};

type Dsp = {
  id: number;
  strategyId: number;
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

const AD_SLOTS: AdSlot[] = [
  { id: "splash-ios-1000", code: "1000", name: "美柚-开屏广告", scene: "开屏", platform: "IOS", size: "1125×2436 / 1242×2688" },
  { id: "splash-ios-1001", code: "1001", name: "美柚-冷启动开屏", scene: "开屏", platform: "IOS", size: "1125×2436" },
  { id: "interstitial-ios-2001", code: "2001", name: "首页半屏插屏", scene: "插屏", platform: "IOS", size: "1080×1620" },
  { id: "feed-ios-3001", code: "3001", name: "首页信息流第3位", scene: "信息流", platform: "IOS", size: "1125×750" },
  { id: "search-ios-4001", code: "4001", name: "搜索结果第2位", scene: "搜索", platform: "IOS", size: "1125×630" },
  { id: "icon-ios-5001", code: "5001", name: "工具页宫格入口", scene: "icon", platform: "IOS", size: "180×180" },
  { id: "splash-android-1100", code: "1100", name: "美柚-开屏广告", scene: "开屏", platform: "Android", size: "1080×1920 / 1440×2560" },
  { id: "interstitial-android-2101", code: "2101", name: "首页半屏插屏", scene: "插屏", platform: "Android", size: "1080×1620" },
  { id: "feed-android-3101", code: "3101", name: "首页信息流第3位", scene: "信息流", platform: "Android", size: "1080×720" },
  { id: "search-android-4101", code: "4101", name: "搜索结果第2位", scene: "搜索", platform: "Android", size: "1080×608" },
  { id: "icon-android-5101", code: "5101", name: "工具页宫格入口", scene: "icon", platform: "Android", size: "180×180" },
];

const initialStrategies: Strategy[] = [
  { id: 211, name: "经期·北京高价值用户", priority: 1000, adSlotId: "splash-ios-1000", rules: [{ dimension: "身份", operator: "包含", value: "经期" }, { dimension: "城市", operator: "等于", value: "北京" }], enabled: true, ab: true, traffic: 50, experiment: "B测试组" },
  { id: 210, name: "备孕用户策略", priority: 900, adSlotId: "splash-ios-1000", rules: [{ dimension: "身份", operator: "包含", value: "备孕" }], enabled: true, ab: false, traffic: 100, experiment: "A对照组" },
  { id: 209, name: "高版本用户策略", priority: 800, adSlotId: "splash-ios-1000", rules: [{ dimension: "应用版本", operator: "大于等于", value: "9.5.0" }], enabled: true, ab: false, traffic: 100, experiment: "A对照组" },
  { id: 207, name: "上海女性测试策略", priority: 700, adSlotId: "splash-ios-1000", rules: [{ dimension: "城市", operator: "等于", value: "上海" }], enabled: false, ab: false, traffic: 100, experiment: "A对照组" },
  { id: 208, name: "默认兜底策略", priority: 0, adSlotId: "splash-ios-1000", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  ...AD_SLOTS.filter((slot) => slot.id !== "splash-ios-1000").map((slot, index) => ({ id: 300 + index, name: `${slot.code}-${slot.name}-默认策略`, priority: 0, adSlotId: slot.id, rules: [] as TargetingRule[], enabled: true, ab: false, traffic: 100, experiment: "A对照组" as const, isDefault: true })),
];

const initialDsps: Dsp[] = [
  { id: 1, strategyId: 211, name: "xyysolid通用化公司重命名", enabled: true, floor: 0.3, pids: ["x-1000-ios"], minVersion: "9.01.0", maxVersion: "", size: "全尺寸", revenue: 0, ecpm: 0, requestValue: 0, requests: 0, returns: 0, bidWins: 0, impressions: 0, ctr: 0, cpc: 0 },
  { id: 2, strategyId: 208, name: "优量汇", enabled: true, floor: 0.5, pids: ["default-1000-ios"], minVersion: "", maxVersion: "", size: "全尺寸", revenue: 12.6, ecpm: 4.2, requestValue: 1.8, requests: 8260, returns: 6901, bidWins: 5150, impressions: 4810, ctr: 1.7, cpc: 0.25 },
];

const sidebarItems = [
  "品牌智能化", "品牌小工具", "品牌管理", "女人通管理", "女人通消费管理", "女人通数据管理",
  "媒体数据管理", "DSP数据管理", "MARKETING API管理", "第三方DMP管理", "小工具", "移动端管理",
  "柚+ 管理", "全局配置管理", "诊断中心",
];

const dimensionValues: Record<TargetingRule["dimension"], string> = { 身份: "经期", 城市: "北京", 年龄: "28", 应用版本: "9.5.0" };
const operatorsFor = (dimension: TargetingRule["dimension"]): TargetingRule["operator"][] => dimension === "年龄" || dimension === "应用版本" ? ["等于", "大于等于", "小于等于", "不包含"] : ["包含", "不包含", "等于"];
const emptyRule = (): TargetingRule => ({ dimension: "身份", operator: "包含", value: "经期" });

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={onChange}><span /></button>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" aria-label="关闭" onClick={onClose}>×</button></header>{children}</section></div>;
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return <div className="field"><span>{required && <b>*</b>}{label}</span><div>{children}{hint && <small>{hint}</small>}</div></div>;
}

export default function Home() {
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies);
  const [dsps, setDsps] = useState<Dsp[]>(initialDsps);
  const [scene, setScene] = useState("开屏");
  const [platform, setPlatform] = useState("IOS");
  const [adSlotId, setAdSlotId] = useState("splash-ios-1000");
  const [selectedId, setSelectedId] = useState(211);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [modal, setModal] = useState<"strategy" | "dsp" | "ab" | null>(null);
  const [editingStrategyId, setEditingStrategyId] = useState<number | null>(null);
  const [editingDspId, setEditingDspId] = useState<number | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [showSimulator, setShowSimulator] = useState(true);
  const [editingFloor, setEditingFloor] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [matchContext, setMatchContext] = useState<MatchContext>({ identity: "经期", city: "北京", age: 28, appVersion: "9.8.0" });
  const [strategyDraft, setStrategyDraft] = useState({ name: "", priority: 1100, rules: [] as TargetingRule[], isDefault: false });
  const [dspDraft, setDspDraft] = useState({ name: "", size: "全尺寸" as "全尺寸" | "自定义", customSize: "", pids: [""], minVersion: "", maxVersion: "", floor: 0.3, enabled: true });

  useEffect(() => {
    try {
      const storedStrategies = localStorage.getItem("adx-slot-strategies-v3");
      const storedDsps = localStorage.getItem("adx-slot-dsps-v3");
      if (storedStrategies) setStrategies(JSON.parse(storedStrategies));
      if (storedDsps) setDsps(JSON.parse(storedDsps));
    } catch { /* use seeded data */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("adx-slot-strategies-v3", JSON.stringify(strategies));
    localStorage.setItem("adx-slot-dsps-v3", JSON.stringify(dsps));
  }, [strategies, dsps, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const slotOptions = useMemo(() => AD_SLOTS.filter((slot) => slot.scene === scene && slot.platform === platform), [scene, platform]);
  const currentSlot = AD_SLOTS.find((slot) => slot.id === adSlotId) ?? slotOptions[0];
  const slotStrategies = useMemo(() => strategies.filter((strategy) => strategy.adSlotId === adSlotId).sort((left, right) => right.priority - left.priority || left.id - right.id), [strategies, adSlotId]);
  const selected = slotStrategies.find((strategy) => strategy.id === selectedId) ?? slotStrategies[0];
  const matchedStrategy = selectExclusiveStrategy(strategies, adSlotId, matchContext);
  const matchTrace = buildExclusiveMatchTrace(strategies, adSlotId, matchContext);

  useEffect(() => {
    const firstSlot = slotOptions[0];
    if (firstSlot && !slotOptions.some((slot) => slot.id === adSlotId)) setAdSlotId(firstSlot.id);
  }, [slotOptions, adSlotId]);

  useEffect(() => {
    if (!slotStrategies.some((strategy) => strategy.id === selectedId) && slotStrategies[0]) setSelectedId(slotStrategies[0].id);
  }, [slotStrategies, selectedId]);

  const strategyDsps = dsps.filter((dsp) => dsp.strategyId === selected?.id);
  const enabledDsps = strategyDsps.filter((dsp) => dsp.enabled);
  const disabledDsps = strategyDsps.filter((dsp) => !dsp.enabled);
  const notify = (message: string) => setToast(message);
  const patchSelected = (patch: Partial<Strategy>) => selected && setStrategies((current) => current.map((strategy) => strategy.id === selected.id ? { ...strategy, ...patch } : strategy));

  const openStrategyModal = (strategy?: Strategy) => {
    setOpenMenu(null);
    setEditingStrategyId(strategy?.id ?? null);
    setStrategyDraft(strategy ? { name: strategy.name, priority: strategy.priority, rules: strategy.rules.map((rule) => ({ ...rule })), isDefault: Boolean(strategy.isDefault) } : { name: "", priority: Math.max(...slotStrategies.map((item) => item.priority), 0) + 100, rules: [], isDefault: false });
    setModal("strategy");
  };

  const saveStrategy = (event: FormEvent) => {
    event.preventDefault();
    if (!strategyDraft.name.trim()) return notify("请输入策略名称");
    const priority = strategyDraft.isDefault ? 0 : strategyDraft.priority;
    if (duplicatePriority(strategies, adSlotId, priority, editingStrategyId)) return notify("同一广告位的策略优先级不能重复");
    if (strategyDraft.isDefault && strategies.some((strategy) => strategy.adSlotId === adSlotId && strategy.isDefault && strategy.id !== editingStrategyId)) return notify("当前广告位已存在兜底策略");

    const patch = { ...strategyDraft, name: strategyDraft.name.trim(), priority, rules: strategyDraft.isDefault ? [] : strategyDraft.rules };
    if (editingStrategyId) {
      setStrategies((current) => current.map((strategy) => strategy.id === editingStrategyId ? { ...strategy, ...patch } : strategy));
      notify("策略已更新，命中顺序已重新计算");
    } else {
      const strategy: Strategy = { id: Date.now(), adSlotId, ...patch, enabled: false, ab: false, traffic: 100, experiment: "A对照组" };
      setStrategies((current) => [...current, strategy]);
      setSelectedId(strategy.id);
      notify("策略已添加，默认处于关闭状态");
    }
    setModal(null);
  };

  const copyStrategy = (strategy: Strategy) => {
    const copy: Strategy = { ...strategy, id: Date.now(), name: `${strategy.name}-副本`, priority: Math.max(...slotStrategies.map((item) => item.priority), 0) + 100, enabled: false, isDefault: false };
    setStrategies((current) => [...current, copy]);
    setSelectedId(copy.id);
    setOpenMenu(null);
    notify("已复制到当前广告位，启用前可先调整规则");
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
      setDsps((current) => [...current, { id: Date.now(), strategyId: selected.id, ...dspDraft, pids: dspDraft.pids.filter(Boolean), revenue: 0, ecpm: 0, requestValue: 0, requests: 0, returns: 0, bidWins: 0, impressions: 0, ctr: 0, cpc: 0 }]);
      notify("DSP 来源已添加");
    }
    setModal(null);
  };

  const patchDsp = (id: number, patch: Partial<Dsp>) => setDsps((current) => current.map((dsp) => dsp.id === id ? { ...dsp, ...patch } : dsp));
  const percent = (part: number, whole: number) => whole ? `${(part / whole * 100).toFixed(2).replace(".00", "")}%` : "0%";

  return <div className={`app-shell ${sidebarCollapsed ? "collapsed" : ""}`} onClick={() => openMenu !== null && setOpenMenu(null)}>
    <header className="topbar"><button className="top-menu" aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"} onClick={(event) => { event.stopPropagation(); setSidebarCollapsed((value) => !value); }}>☰</button><strong className="brand">广告投放运营后台</strong><nav><a href="#">广告投放运营后台</a><a href="#">权限申请</a></nav></header>
    <aside className="sidebar"><div className="profile"><span>张佳琪</span><button type="button" onClick={() => notify("演示环境不会退出登录")}>退出</button></div>{sidebarItems.map((item) => <button type="button" className="side-row" key={item}>{item}<span>‹</span></button>)}<button type="button" className="side-row active">ADX流量工具<span>⌄</span></button><button type="button" className="sub-row">›&nbsp; 广告位策略管理</button><button type="button" className="side-row">广告交互管理<span>‹</span></button></aside>

    <main className="content"><section className="panel">
      <div className="page-heading"><div><h1>广告位策略管理</h1><p>配置粒度已下沉到最小广告位；同一广告位按优先级依次判断，首个命中策略生效后立即停止。</p></div><span className="exclusive-badge">互斥模式已开启</span></div>
      <div className="filters slot-filters">
        <label>广告场景：<select aria-label="广告场景" value={scene} onChange={(event) => setScene(event.target.value)}><option>开屏</option><option>插屏</option><option>信息流</option><option>搜索</option><option>icon</option></select></label>
        <label>平台：<select aria-label="平台" value={platform} onChange={(event) => setPlatform(event.target.value)}><option>IOS</option><option>Android</option></select></label>
        <label className="slot-selector">广告位：<select aria-label="广告位" value={adSlotId} onChange={(event) => setAdSlotId(event.target.value)}>{slotOptions.map((slot) => <option key={slot.id} value={slot.id}>{slot.code}-{slot.name}</option>)}</select></label>
      </div>

      {currentSlot && <div className="slot-overview"><div className="slot-identity"><span>当前最小配置单元</span><strong>{currentSlot.code}-{currentSlot.name}</strong><small>{currentSlot.scene} · {currentSlot.platform} · {currentSlot.size}</small></div><div className="slot-stat"><strong>{slotStrategies.filter((strategy) => strategy.enabled).length}</strong><span>启用策略</span></div><div className="slot-stat"><strong>{slotStrategies.length}</strong><span>全部策略</span></div><div className="slot-stat safe"><strong>1</strong><span>单用户最多命中</span></div></div>}

      <div className="exclusive-notice"><span className="notice-icon">i</span><div><strong>同广告位流量互斥</strong><p>策略按优先级从高到低执行。命中任意一条后，本次广告请求不会继续判断后续策略；未命中才进入下一条，最后由兜底策略承接。</p></div></div>

      <div className="strategy-toolbar"><div><h2>策略命中顺序</h2><span>拖序不开放，优先级数值越大越先判断</span></div><div><button type="button" className="secondary" onClick={() => setShowSimulator((value) => !value)}>{showSimulator ? "收起命中测试" : "命中测试"}</button><button type="button" className="primary" onClick={() => openStrategyModal()}>＋ 添加策略</button></div></div>

      {showSimulator && <section className="simulator" aria-label="互斥命中测试"><div className="simulator-form"><strong>模拟用户</strong><label>身份<select value={matchContext.identity} onChange={(event) => setMatchContext({ ...matchContext, identity: event.target.value })}><option>经期</option><option>备孕</option><option>孕期</option><option>普通用户</option></select></label><label>城市<select value={matchContext.city} onChange={(event) => setMatchContext({ ...matchContext, city: event.target.value })}><option>北京</option><option>上海</option><option>广州</option><option>杭州</option></select></label><label>年龄<input type="number" min="1" value={matchContext.age} onChange={(event) => setMatchContext({ ...matchContext, age: Number(event.target.value) })} /></label><label>版本<input value={matchContext.appVersion} onChange={(event) => setMatchContext({ ...matchContext, appVersion: event.target.value })} /></label></div><div className={`match-result ${matchedStrategy ? "hit" : "miss"}`}><span>{matchedStrategy ? "唯一命中" : "未命中"}</span><strong>{matchedStrategy ? (matchedStrategy as Strategy).name : "无可用策略"}</strong><small>{matchedStrategy ? `在优先级 ${(matchedStrategy as Strategy).priority} 停止，后续策略不再执行` : "请检查是否存在启用的兜底策略"}</small></div><div className="match-trace">{matchTrace.map((item, index) => <span className={item.matched ? "matched" : "passed"} key={item.strategy.id}><b>{index + 1}</b>{(item.strategy as Strategy).name}<em>{item.matched ? "命中 · 停止" : "未命中 · 继续"}</em></span>)}</div></section>}

      <div className="strategy-flow" aria-label="策略互斥顺序">
        {slotStrategies.map((strategy, index) => <div className="flow-wrap" key={strategy.id}>
          <article className={`strategy-card ${strategy.id === selected?.id ? "selected" : ""} ${!strategy.enabled ? "disabled" : ""}`} onClick={() => setSelectedId(strategy.id)}>
            <div className="rank"><span>优先级</span><strong>{strategy.isDefault ? "兜底" : strategy.priority}</strong></div>
            <div className="strategy-main"><div className="strategy-title"><strong>{strategy.name}</strong>{strategy.ab && <em>AB</em>}{strategy.isDefault && <small>默认兜底</small>}{!strategy.enabled && <small className="closed">已关闭</small>}</div><div className="strategy-rules">{strategy.rules.length ? strategy.rules.map((rule, ruleIndex) => <span key={`${rule.dimension}-${ruleIndex}`}>{rule.dimension}({rule.operator}): {rule.value}</span>) : <span>无条件，承接剩余流量</span>}</div></div>
            <div className="stop-rule"><span>{strategy.enabled ? "命中即停止" : "不参与判断"}</span><small>{strategy.enabled ? "最多生效 1 条" : "开启后加入顺序"}</small></div>
            <button type="button" className="group-more" aria-label={`${strategy.name}更多操作`} onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === strategy.id ? null : strategy.id); }}>⋮</button>
            {openMenu === strategy.id && <div className="group-menu" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => openStrategyModal(strategy)}>编辑策略</button><button type="button" onClick={() => copyStrategy(strategy)}>复制</button></div>}
          </article>
          {index < slotStrategies.length - 1 && <div className="flow-arrow"><span>↓</span>未命中，继续判断</div>}
        </div>)}
        {!slotStrategies.length && <div className="empty">当前广告位暂无策略，点击“添加策略”创建。</div>}
      </div>

      {selected && <><div className="strategy-detail"><div className="detail-head"><div><span>当前策略</span><h2>{selected.name}</h2></div><div><strong>所属广告位：</strong><span className="pink-tag">{currentSlot?.code}-{currentSlot?.name}</span></div></div><div><strong>定向规则：</strong>{selected.rules.length ? selected.rules.map((rule, index) => <span className="rule-tag" key={`${rule.dimension}-${index}`}>{rule.dimension}({rule.operator}): {rule.value}</span>) : <span className="muted">兜底策略，无附加规则</span>}</div><div className="controls"><strong>策略开关</strong><Toggle checked={selected.enabled} label="策略开关" onChange={() => { patchSelected({ enabled: !selected.enabled }); notify(selected.enabled ? "策略已关闭，不再参与互斥判断" : "策略已开启，已加入互斥顺序"); }} /><i /><select aria-label="实验组" value={selected.experiment} onChange={(event) => patchSelected({ experiment: event.target.value as Strategy["experiment"], ab: true })}><option>A对照组</option><option>B测试组</option></select><strong>流量占比</strong><input aria-label="流量占比" type="number" min="0" max="100" value={selected.traffic} onChange={(event) => patchSelected({ traffic: Math.min(100, Math.max(0, Number(event.target.value))) })} /><span>%</span><button type="button" className="primary push-right" onClick={() => setModal("ab")}>查看A/B测试数据</button></div></div>
        <button type="button" className="primary" onClick={() => openDspModal()}>＋ 添加PID</button><div className="table-wrap"><table><thead><tr>{["操作", "DSP来源", "状态", "底价", "预估收入", "eCPM", "千次请求价格", "请求量", "返回量", "返回率", "竞价成功数", "竞价成功率", "展示量", "竞胜展示率", "点击率", "CPC"].map((heading, index) => <th key={heading}>{heading}{index > 2 && index !== 10 && <span className="help" title={`${heading}指标说明`}>?</span>}</th>)}</tr></thead><tbody><tr className="summary-row"><td /><td><strong>{enabledDsps.length}个DSP来源已启用</strong></td><td /><td /><td>¥{enabledDsps.reduce((sum, item) => sum + item.revenue, 0).toFixed(0)}</td><td>{enabledDsps.reduce((sum, item) => sum + item.ecpm, 0).toFixed(2)}</td><td>¥{enabledDsps.reduce((sum, item) => sum + item.requestValue, 0).toFixed(0)}</td><td>{enabledDsps.reduce((sum, item) => sum + item.requests, 0)}</td><td>{enabledDsps.reduce((sum, item) => sum + item.returns, 0)}</td><td>{percent(enabledDsps.reduce((sum, item) => sum + item.returns, 0), enabledDsps.reduce((sum, item) => sum + item.requests, 0))}</td><td>—</td><td>—</td><td>{enabledDsps.reduce((sum, item) => sum + item.impressions, 0)}</td><td>—</td><td>0%</td><td>¥0</td></tr>{enabledDsps.map((dsp) => <DspRow key={dsp.id} dsp={dsp} editingFloor={editingFloor} setEditingFloor={setEditingFloor} patchDsp={patchDsp} openEdit={() => openDspModal(dsp)} percent={percent} />)}{showDisabled && disabledDsps.map((dsp) => <DspRow key={dsp.id} dsp={dsp} editingFloor={editingFloor} setEditingFloor={setEditingFloor} patchDsp={patchDsp} openEdit={() => openDspModal(dsp)} percent={percent} />)}</tbody></table></div><button type="button" className="disabled-toggle" onClick={() => setShowDisabled((value) => !value)}><span>{showDisabled ? "⌄" : "›"}</span>{disabledDsps.length} 个DSP来源未启用</button></>}
    </section></main>

    {modal === "strategy" && <Modal title={editingStrategyId ? "编辑策略" : "添加策略"} onClose={() => setModal(null)}><form onSubmit={saveStrategy}><div className="modal-body"><div className="slot-lock"><span>配置广告位</span><strong>{currentSlot?.code}-{currentSlot?.name}</strong><small>策略创建后固定归属此广告位，不与其他广告位共享流量。</small></div><Field label="策略名称" required><input maxLength={24} placeholder="请输入策略名称" value={strategyDraft.name} onChange={(event) => setStrategyDraft({ ...strategyDraft, name: event.target.value })} /><small className="counter">{strategyDraft.name.length}/24</small></Field><Field label="策略类型"><div className="radios"><label><input type="radio" checked={!strategyDraft.isDefault} onChange={() => setStrategyDraft({ ...strategyDraft, isDefault: false, priority: strategyDraft.priority || 100 })} />定向策略</label><label><input type="radio" checked={strategyDraft.isDefault} onChange={() => setStrategyDraft({ ...strategyDraft, isDefault: true, priority: 0, rules: [] })} />默认兜底</label></div></Field><Field label="优先级" hint="同一广告位内必须唯一；数值越大越先判断"><input type="number" min="1" max="999999" disabled={strategyDraft.isDefault} value={strategyDraft.isDefault ? 0 : strategyDraft.priority} onChange={(event) => setStrategyDraft({ ...strategyDraft, priority: Number(event.target.value) })} /></Field><Field label="广告场景"><input disabled value={currentSlot?.scene ?? ""} /></Field><Field label="平台"><input disabled value={currentSlot?.platform ?? ""} /></Field>{!strategyDraft.isDefault && <Field label="定向规则" hint="同一策略内的多条规则需全部满足（AND）"><div className="rule-editor">{strategyDraft.rules.map((rule, index) => <div className="rule-row" key={index}><select aria-label={`规则${index + 1}维度`} value={rule.dimension} onChange={(event) => { const dimension = event.target.value as TargetingRule["dimension"]; setStrategyDraft({ ...strategyDraft, rules: strategyDraft.rules.map((item, itemIndex) => itemIndex === index ? { dimension, operator: operatorsFor(dimension)[0], value: dimensionValues[dimension] } : item) }); }}><option>身份</option><option>城市</option><option>年龄</option><option>应用版本</option></select><select aria-label={`规则${index + 1}关系`} value={rule.operator} onChange={(event) => setStrategyDraft({ ...strategyDraft, rules: strategyDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as TargetingRule["operator"] } : item) })}>{operatorsFor(rule.dimension).map((operator) => <option key={operator}>{operator}</option>)}</select><input aria-label={`规则${index + 1}值`} value={rule.value} onChange={(event) => setStrategyDraft({ ...strategyDraft, rules: strategyDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} /><button type="button" aria-label="删除规则" onClick={() => setStrategyDraft({ ...strategyDraft, rules: strategyDraft.rules.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>)}<button type="button" className="secondary" onClick={() => setStrategyDraft({ ...strategyDraft, rules: [...strategyDraft.rules, emptyRule()] })}>＋ 添加规则</button></div></Field>}</div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button className="primary" type="submit">提 交</button></div></form></Modal>}

    {modal === "dsp" && <Modal title={editingDspId ? "编辑DSP来源" : "添加DSP来源"} onClose={() => setModal(null)}><form onSubmit={saveDsp}><div className="modal-body"><Field label="DSP来源" required><select value={dspDraft.name} onChange={(event) => setDspDraft({ ...dspDraft, name: event.target.value })}><option value="">请输入关键词搜索DSP来源</option><option>xyysolid通用化公司重命名</option><option>优量汇</option><option>穿山甲</option><option>百度联盟</option></select></Field><Field label="广告位"><input disabled value={`${currentSlot?.code}-${currentSlot?.name}`} /></Field><Field label="所属策略"><input disabled value={selected?.name ?? ""} /></Field><Field label="尺寸"><div className="radios"><label><input type="radio" checked={dspDraft.size === "全尺寸"} onChange={() => setDspDraft({ ...dspDraft, size: "全尺寸" })} />全尺寸</label><label><input type="radio" checked={dspDraft.size === "自定义"} onChange={() => setDspDraft({ ...dspDraft, size: "自定义" })} />自定义</label>{dspDraft.size === "自定义" && <input placeholder="如 1080×1920" value={dspDraft.customSize} onChange={(event) => setDspDraft({ ...dspDraft, customSize: event.target.value })} />}</div></Field><Field label="PID"><div className="pid-list">{dspDraft.pids.map((pid, index) => <div className="pid-row" key={index}><b>PID #{index + 1}</b><input placeholder="请输入PID" value={pid} onChange={(event) => setDspDraft({ ...dspDraft, pids: dspDraft.pids.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />{index > 0 && <button type="button" aria-label="删除PID" onClick={() => setDspDraft({ ...dspDraft, pids: dspDraft.pids.filter((_, itemIndex) => itemIndex !== index) })}>×</button>}</div>)}<div className="version-row"><span>应用版本</span><input placeholder="最小版本，如 9.01.0" value={dspDraft.minVersion} onChange={(event) => setDspDraft({ ...dspDraft, minVersion: event.target.value })} /><input placeholder="最大版本，如 9.01.0" value={dspDraft.maxVersion} onChange={(event) => setDspDraft({ ...dspDraft, maxVersion: event.target.value })} /></div><button type="button" className="secondary" onClick={() => setDspDraft({ ...dspDraft, pids: [...dspDraft.pids, ""] })}>＋ 添加PID</button></div></Field><Field label="底价" required><input type="number" min="0" step="0.1" value={dspDraft.floor} onChange={(event) => setDspDraft({ ...dspDraft, floor: Number(event.target.value) })} /></Field><Field label="状态"><Toggle checked={dspDraft.enabled} label="DSP状态" onChange={() => setDspDraft({ ...dspDraft, enabled: !dspDraft.enabled })} /></Field></div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button className="primary" type="submit">提 交</button></div></form></Modal>}

    {modal === "ab" && <Modal title="查看A/B测试数据" onClose={() => setModal(null)} wide><div className="modal-body ab-body"><div className="ab-meta"><span>测试名称：{selected?.name}</span><span>广告位：{currentSlot?.code}-{currentSlot?.name}</span><span>数据统计周期：2026-07-30 16:47:16 ~ 2026-08-19 16:25:18</span></div><div className="ab-tabs"><button className="active">全量A组</button><button>全量B组</button></div><div className="table-wrap"><table><thead><tr>{["组别", "累计入组用户", "千人均收益", "预估收入", "eCPM", "千次请求价值", "请求量", "返回量", "返回率", "展示量", "展示率", "点击数", "点击率", "CPC"].map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody><tr><td>A（对照组）</td>{Array.from({ length: 13 }).map((_, index) => <td key={index}>0</td>)}</tr><tr><td>B（实验组）</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>37</td><td>10</td><td>27.03%</td><td>0</td><td>0%</td><td>0</td><td>0%</td><td>0</td></tr><tr className="summary-row"><td>对比涨幅</td>{Array.from({ length: 13 }).map((_, index) => <td key={index}>—</td>)}</tr></tbody></table></div></div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button type="button" className="primary" onClick={() => setModal(null)}>确 定</button></div></Modal>}
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </div>;
}

function DspRow({ dsp, editingFloor, setEditingFloor, patchDsp, openEdit, percent }: { dsp: Dsp; editingFloor: number | null; setEditingFloor: (id: number | null) => void; patchDsp: (id: number, patch: Partial<Dsp>) => void; openEdit: () => void; percent: (part: number, whole: number) => string }) {
  return <tr className={!dsp.enabled ? "disabled-row" : ""}><td><button type="button" className="text-action" onClick={openEdit}>编辑</button></td><td>{dsp.name}<small className="pid-note">{dsp.pids.join(" / ")}</small></td><td><Toggle checked={dsp.enabled} label={`${dsp.name}状态`} onChange={() => patchDsp(dsp.id, { enabled: !dsp.enabled })} /></td><td>{editingFloor === dsp.id ? <span className="floor-edit"><input autoFocus aria-label="底价" type="number" min="0" step="0.1" value={dsp.floor} onChange={(event) => patchDsp(dsp.id, { floor: Number(event.target.value) })} /><button type="button" aria-label="保存底价" onClick={() => setEditingFloor(null)}>✓</button></span> : <button type="button" className="floor-value" onClick={() => setEditingFloor(dsp.id)}>¥{dsp.floor} <span>✎</span></button>}</td><td>¥{dsp.revenue}</td><td>{dsp.ecpm.toFixed(2)}</td><td>¥{dsp.requestValue}</td><td>{dsp.requests}</td><td>{dsp.returns}</td><td>{percent(dsp.returns, dsp.requests)}</td><td>{dsp.bidWins}</td><td>{percent(dsp.bidWins, dsp.returns)}</td><td>{dsp.impressions}</td><td>{percent(dsp.impressions, dsp.bidWins)}</td><td>{dsp.ctr}%</td><td>¥{dsp.cpc}</td></tr>;
}
