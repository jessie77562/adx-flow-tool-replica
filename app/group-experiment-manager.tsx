"use client";

import { useState } from "react";
import { BATCH_PRICE_MAX, validateBatchPrice } from "./batch-operations";
import {
  allocateAllTraffic,
  formatExperimentTime,
  startExperiment,
  validateExperiment,
  type ExperimentDspConfig,
  type GroupExperiment,
} from "./experiment-management";

type GroupSummary = { id: number; name: string; scene: string; platform: string; adSlot: string };
type DspSummary = { id: number; name: string; enabled: boolean; floor: number; pids: string[] };

function cloneConfigs(configs: ExperimentDspConfig[]): ExperimentDspConfig[] {
  return configs.map((item) => ({ ...item, pids: [...item.pids] }));
}

function seedConfigs(dsps: DspSummary[]): ExperimentDspConfig[] {
  return dsps.map((dsp) => ({ id: dsp.id, name: dsp.name, enabled: dsp.enabled, floor: dsp.floor, pids: [...dsp.pids] }));
}

function ExperimentConfigTable({ title, configs, onChange, allowBatchFloor = false, onNotify }: { title: string; configs: ExperimentDspConfig[]; onChange: (configs: ExperimentDspConfig[]) => void; allowBatchFloor?: boolean; onNotify: (message: string) => void }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchPrice, setBatchPrice] = useState("");
  const [batchError, setBatchError] = useState("");
  const addDsp = () => onChange([...configs, { id: Date.now(), name: "新DSP来源", enabled: true, floor: 0.3, pids: ["待配置PID"] }]);
  const allSelected = configs.length > 0 && configs.every((item) => selectedIds.includes(item.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : configs.map((item) => item.id));
  const toggleOne = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const closeBatch = () => { setBatchOpen(false); setBatchPrice(""); setBatchError(""); };
  const confirmBatchFloor = () => {
    const validation = validateBatchPrice(batchPrice);
    if (validation) return setBatchError(validation);
    const selected = new Set(selectedIds);
    const price = Number(batchPrice);
    onChange(configs.map((config) => selected.has(config.id) ? { ...config, floor: price } : config));
    onNotify(`已批量修改 ${selectedIds.length} 个DSP来源的底价`);
    setSelectedIds([]);
    closeBatch();
  };

  return <div className="experiment-config-panel">
    <div className="experiment-config-toolbar"><span>{title}</span><div>{allowBatchFloor && <button type="button" className="secondary" disabled={!selectedIds.length} onClick={() => setBatchOpen(true)}>批量修改底价{selectedIds.length ? `（${selectedIds.length}）` : ""}</button>}<button type="button" className="primary" onClick={addDsp}>＋ 添加PID</button></div></div>
    <div className="table-wrap experiment-config-table"><table><thead><tr>{allowBatchFloor && <th className="selection-cell"><input type="checkbox" aria-label="选择实验组全部DSP来源" checked={allSelected} onChange={toggleAll} /></th>}<th>操作</th><th>DSP来源</th><th>PID</th><th>状态</th><th>底价</th></tr></thead><tbody>{configs.map((item) => <tr key={item.id}>{allowBatchFloor && <td className="selection-cell"><input type="checkbox" aria-label={`选择实验组DSP来源 ${item.name}`} checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} /></td>}<td><button type="button" className="text-action" onClick={() => { onChange(configs.filter((config) => config.id !== item.id)); setSelectedIds((current) => current.filter((id) => id !== item.id)); }}>删除</button></td><td>{item.name}</td><td>{item.pids.join(" / ")}</td><td><button type="button" role="switch" aria-checked={item.enabled} className={`toggle ${item.enabled ? "on" : ""}`} aria-label={`${item.name}状态`} onClick={() => onChange(configs.map((config) => config.id === item.id ? { ...config, enabled: !config.enabled } : config))}><span /></button></td><td><span className="experiment-floor">¥<input aria-label={`${item.name}底价`} type="number" min="0" step="0.1" value={item.floor} onChange={(event) => onChange(configs.map((config) => config.id === item.id ? { ...config, floor: Math.max(0, Number(event.target.value)) } : config))} /></span></td></tr>)}{!configs.length && <tr><td colSpan={allowBatchFloor ? 6 : 5}><div className="report-empty">暂无DSP来源，点击“添加PID”配置</div></td></tr>}</tbody></table></div>
    {batchOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeBatch()}><section className="modal" role="dialog" aria-modal="true" aria-label="批量修改实验组底价"><header><h2>批量修改底价</h2><button type="button" aria-label="关闭批量修改底价" onClick={closeBatch}>×</button></header><div className="experiment-batch-floor"><p>已选择 <strong>{selectedIds.length}</strong> 个DSP来源</p><label><span><b>*</b>底价</span><div className="price-input"><span>¥</span><input type="number" min="0" max={BATCH_PRICE_MAX} step="0.01" placeholder="请输入底价" value={batchPrice} onChange={(event) => { setBatchPrice(event.target.value); setBatchError(""); }} /></div></label>{batchError && <div className="experiment-error" role="alert">{batchError}</div>}<small>请输入大于 0 且不超过 ¥{BATCH_PRICE_MAX} 的数值。</small></div><div className="modal-actions"><button type="button" className="secondary" onClick={closeBatch}>取消</button><button type="button" className="primary" onClick={confirmBatchFloor}>确认修改</button></div></section></div>}
  </div>;
}

export default function GroupExperimentManager({ group, dsps, experiment, onBack, onChange, onNotify }: { group: GroupSummary; dsps: DspSummary[]; experiment?: GroupExperiment; onBack: () => void; onChange: (experiment: GroupExperiment) => void; onNotify: (message: string) => void }) {
  const isCreate = !experiment;
  const initialA = experiment?.aConfig.length ? cloneConfigs(experiment.aConfig) : seedConfigs(dsps);
  const initialB = experiment?.bConfig.length ? cloneConfigs(experiment.bConfig) : seedConfigs(dsps);
  const [testName, setTestName] = useState(experiment?.testName ?? "");
  const [aTraffic, setATraffic] = useState(experiment?.aTraffic ?? 50);
  const [bTraffic, setBTraffic] = useState(experiment?.bTraffic ?? 50);
  const [copyAtoB, setCopyAtoB] = useState(experiment?.copyAtoB ?? true);
  const [activeConfig, setActiveConfig] = useState<"A" | "B">("B");
  const [aConfig, setAConfig] = useState(initialA);
  const [bConfig, setBConfig] = useState(initialB);
  const [error, setError] = useState("");
  const [pendingAllocation, setPendingAllocation] = useState<"A" | "B" | null>(null);

  const buildRecord = (status = experiment?.status ?? "draft"): GroupExperiment => {
    const now = formatExperimentTime();
    return {
      groupId: group.id,
      testName: testName.trim(),
      status,
      aTraffic,
      bTraffic,
      allocation: aTraffic === 100 ? "allA" : bTraffic === 100 ? "allB" : "split",
      copyAtoB,
      createdAt: experiment?.createdAt ?? null,
      updatedAt: now,
      aConfig: cloneConfigs(aConfig),
      bConfig: copyAtoB ? cloneConfigs(aConfig) : cloneConfigs(bConfig),
    };
  };

  const submit = (action: "save" | "start") => {
    const validation = validateExperiment(testName, aTraffic, bTraffic);
    if (validation) return setError(validation);
    const next = action === "start" ? startExperiment(buildRecord("draft")) : buildRecord("draft");
    onChange(next);
    onNotify(action === "start" ? "A/B测试已开启" : "A/B测试已保存，状态为待开启");
    onBack();
  };

  const updateTraffic = (groupName: "A" | "B", value: number) => {
    const safeValue = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
    if (groupName === "A") { setATraffic(safeValue); setBTraffic(100 - safeValue); }
    else { setBTraffic(safeValue); setATraffic(100 - safeValue); }
    setError("");
  };

  const saveName = () => {
    const validation = validateExperiment(testName, aTraffic, bTraffic);
    if (validation) return setError(validation);
    onChange({ ...buildRecord(), testName: testName.trim() });
    onNotify("测试名称已保存");
  };

  const confirmChooseAll = () => {
    if (!experiment || !pendingAllocation) return;
    const next = allocateAllTraffic({ ...buildRecord(experiment.status), createdAt: experiment.createdAt }, pendingAllocation);
    setATraffic(next.aTraffic);
    setBTraffic(next.bTraffic);
    onChange(next);
    onNotify(`已将分组流量全部配置给${pendingAllocation}组`);
    setPendingAllocation(null);
  };

  return <section className="panel experiment-page">
    <div className="experiment-page-heading"><div><button type="button" className="back-link" onClick={onBack}>‹ 返回流量分组管理</button><h1>{isCreate ? "创建A/B测试" : "查看A/B测试数据"}</h1></div>{experiment && <span className={`experiment-status ${experiment.status}`}>{experiment.status === "running" ? "开启中" : "待开启"}</span>}</div>

    <section className="experiment-section"><h2>基础信息</h2><div className="experiment-form-grid">
      <label><span>分组名称</span><input disabled value={group.name} /></label>
      <label><span><b>*</b>测试名称</span><div className="named-input"><input maxLength={30} placeholder="请输入测试名称" value={testName} onChange={(event) => { setTestName(event.target.value); setError(""); }} /><small>{testName.length}/30</small></div></label>
      <div className="experiment-ratio-field"><span><b>*</b>流量比例</span><div><strong className="group-dot a">A</strong><label>对照组<input type="number" min="0" max="100" value={aTraffic} onChange={(event) => updateTraffic("A", Number(event.target.value))} />%</label><i>:</i><strong className="group-dot b">B</strong><label>实验组<input type="number" min="0" max="100" value={bTraffic} onChange={(event) => updateTraffic("B", Number(event.target.value))} />%</label></div></div>
      <label className="experiment-copy"><span /><span><input type="checkbox" checked={copyAtoB} onChange={(event) => setCopyAtoB(event.target.checked)} />将A组配置复制给B组</span></label>
      {error && <div className="experiment-error" role="alert">{error}</div>}
      {!isCreate && <><div className="experiment-info-row"><span>实验创建时间</span><strong>{experiment.createdAt ?? "尚未开启"}</strong></div><div className="experiment-info-row"><span>数据统计周期</span><strong>{experiment.createdAt ? `${experiment.createdAt} ~ 至今` : "开启测试后开始统计"}</strong></div></>}
    </div></section>

    {isCreate ? <section className="experiment-section"><h2>实验配置</h2><div className="experiment-tabs"><button type="button" className={activeConfig === "A" ? "active" : ""} onClick={() => setActiveConfig("A")}>对照组(A)</button><button type="button" className={activeConfig === "B" ? "active" : ""} onClick={() => setActiveConfig("B")}>实验组(B)</button></div>{activeConfig === "A" ? <ExperimentConfigTable title="A组已启用DSP来源" configs={aConfig} onChange={setAConfig} onNotify={onNotify} /> : copyAtoB ? <ExperimentConfigTable title="B组配置（同步A组）" configs={aConfig} onChange={setAConfig} allowBatchFloor onNotify={onNotify} /> : <ExperimentConfigTable title="B组已启用DSP来源" configs={bConfig} onChange={setBConfig} allowBatchFloor onNotify={onNotify} />}</section> : <>
      <section className="experiment-section experiment-actions"><div><h2>流量决策</h2><p>选择推全组并确认后，分组流量将 100% 按该组配置执行。</p></div><div className="experiment-allocation-buttons"><button type="button" className={aTraffic === 100 ? "active" : ""} onClick={() => setPendingAllocation("A")}>全量A组</button><button type="button" className={bTraffic === 100 ? "active" : ""} onClick={() => setPendingAllocation("B")}>全量B组</button></div></section>
    </>}

    <div className="experiment-page-actions"><button type="button" className="secondary" onClick={onBack}>取消</button>{isCreate ? <><button type="button" className="secondary" onClick={() => submit("save")}>保存</button><button type="button" className="primary" onClick={() => submit("start")}>开启测试</button></> : <><button type="button" className="secondary" onClick={saveName}>保存修改</button>{experiment.status === "draft" && <button type="button" className="primary" onClick={() => { const next = startExperiment(buildRecord("draft")); onChange(next); onNotify("A/B测试已开启"); }}>开启测试</button>}</>}</div>

    {pendingAllocation && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPendingAllocation(null)}><section className="modal" role="dialog" aria-modal="true" aria-label="流量全量切换"><header><h2>流量全量切换</h2><button type="button" aria-label="关闭流量全量切换确认" onClick={() => setPendingAllocation(null)}>×</button></header><div className="delete-confirm-body"><span className="disable-warning" aria-hidden="true">!</span><div><h3>确认将“{group.name}”的全部流量给到{pendingAllocation}组吗？</h3><p>确认后，{pendingAllocation}组流量将变为 100%，{pendingAllocation === "A" ? "B" : "A"}组流量变为 0%，并按照{pendingAllocation}组配置进行推全。</p></div></div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setPendingAllocation(null)}>取消</button><button type="button" className="primary" onClick={confirmChooseAll}>确认执行</button></div></section></div>}
  </section>;
}
