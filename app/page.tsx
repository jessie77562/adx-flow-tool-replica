"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { applyBatchOperation, BATCH_PRICE_MAX, type BatchOperation, eligibleBatchItems, validateBatchPrice } from "./batch-operations";
import { ensureDefaultGroupsEnabled, highestEffectiveGroupId, reorderGroupPriority, setManagedGroupsEnabled } from "./group-management";
import PidManager, { INITIAL_PID_RECORDS } from "./pid-manager";
import { normalizePidRecords, type PidRecord } from "./pid-management";
import ReportManager from "./report-manager";
import AbReportManager from "./ab-report-manager";
import GroupExperimentManager from "./group-experiment-manager";
import type { GroupExperiment } from "./experiment-management";

export const dynamic = "force-static";

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
  { id: 302, name: "302-社区信息流-核心用户", priority: 302, scene: "社区-信息流", platform: "IOS", adSlot: "3001-社区信息流广告", rules: [{ dimension: "身份", operator: "包含", value: "备孕" }], enabled: true, ab: true, traffic: 50, experiment: "B测试组" },
  { id: 305, name: "305-社区信息流默认分组-iOS", priority: 301, scene: "社区-信息流", platform: "IOS", adSlot: "3001-社区信息流广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 306, name: "306-社区详情页默认分组-iOS", priority: 306, scene: "社区-详情页", platform: "IOS", adSlot: "3002-社区详情页广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 307, name: "307-社区其他广告位默认分组-iOS", priority: 307, scene: "社区-其他广告位", platform: "IOS", adSlot: "3003-社区其他广告位", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 303, name: "303-搜索默认分组-iOS", priority: 303, scene: "搜索", platform: "IOS", adSlot: "4001-搜索广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 304, name: "304-icon默认分组-iOS", priority: 304, scene: "icon", platform: "IOS", adSlot: "5001-icon广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 401, name: "401-开屏默认分组-Android", priority: 401, scene: "开屏", platform: "Android", adSlot: "1100-美柚-开屏广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 402, name: "402-Android-北京用户", priority: 402, scene: "开屏", platform: "Android", adSlot: "1100-美柚-开屏广告", rules: [{ dimension: "城市", operator: "包含", value: "北京" }], enabled: false, ab: false, traffic: 100, experiment: "A对照组" },
  { id: 403, name: "403-插屏默认分组-Android", priority: 403, scene: "插屏", platform: "Android", adSlot: "2101-美柚-插屏广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 404, name: "404-社区信息流默认分组-Android", priority: 404, scene: "社区-信息流", platform: "Android", adSlot: "3101-社区信息流广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 407, name: "407-社区详情页默认分组-Android", priority: 407, scene: "社区-详情页", platform: "Android", adSlot: "3102-社区详情页广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 408, name: "408-社区其他广告位默认分组-Android", priority: 408, scene: "社区-其他广告位", platform: "Android", adSlot: "3103-社区其他广告位", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 405, name: "405-搜索默认分组-Android", priority: 405, scene: "搜索", platform: "Android", adSlot: "4101-搜索广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
  { id: 406, name: "406-icon默认分组-Android", priority: 406, scene: "icon", platform: "Android", adSlot: "5101-icon广告", rules: [], enabled: true, ab: false, traffic: 100, experiment: "A对照组", isDefault: true },
];

function normalizeGroups(current: Group[]): Group[] {
  const migrated = current.map((group) => group.scene === "信息流" ? { ...group, scene: "社区-信息流" } : group);
  const missingDefaults = initialGroups.filter((seed) => seed.isDefault && !migrated.some((group) => group.isDefault && group.scene === seed.scene && group.platform === seed.platform));
  return ensureDefaultGroupsEnabled([...migrated, ...missingDefaults]);
}

const initialSelectedGroupId = highestEffectiveGroupId(initialGroups.filter((group) => group.scene === "开屏" && group.platform === "IOS")) ?? 211;

const initialDsps: Dsp[] = [
  { id: 1, groupId: 211, name: "xyysolid通用化公司重命名", enabled: true, floor: 0.3, pids: ["x-1000-ios"], minVersion: "9.01.0", maxVersion: "", size: "全尺寸", revenue: 0, ecpm: 0, requestValue: 0, requests: 0, returns: 0, bidWins: 0, impressions: 0, ctr: 0, cpc: 0 },
  { id: 3, groupId: 211, name: "优量汇", enabled: true, floor: 0.8, pids: ["gdt-splash-ios", "gdt-splash-premium"], minVersion: "9.01.0", maxVersion: "", size: "全尺寸", revenue: 86.2, ecpm: 7.4, requestValue: 2.1, requests: 15320, returns: 12880, bidWins: 8750, impressions: 8120, ctr: 2.1, cpc: 0.31 },
  { id: 4, groupId: 211, name: "穿山甲", enabled: false, floor: 1.2, pids: ["csj-splash-ios"], minVersion: "9.02.0", maxVersion: "", size: "全尺寸", revenue: 48.5, ecpm: 6.8, requestValue: 1.9, requests: 9320, returns: 7650, bidWins: 5320, impressions: 4980, ctr: 1.9, cpc: 0.28 },
  { id: 2, groupId: 210, name: "测试DSP来源", enabled: false, floor: 0.5, pids: ["demo-pid-02"], minVersion: "", maxVersion: "", size: "全尺寸", revenue: 12.6, ecpm: 4.2, requestValue: 1.8, requests: 8260, returns: 6901, bidWins: 5150, impressions: 4810, ctr: 1.7, cpc: 0.25 },
];

const initialExperiments: GroupExperiment[] = initialGroups.filter((group) => group.ab).map((group, index) => ({
  groupId: group.id,
  testName: `${group.name} A/B 测试`,
  status: "running",
  aTraffic: 50,
  bTraffic: 50,
  allocation: "split",
  copyAtoB: true,
  createdAt: `2026-08-${String(12 + index).padStart(2, "0")} 10:30:00`,
  updatedAt: "2026-08-19 16:25:18",
  aConfig: [],
  bConfig: [],
}));

const sidebarItems = [
  "品牌智能化", "品牌小工具", "品牌管理", "女人通管理", "女人通消费管理", "女人通数据管理",
  "媒体数据管理", "DSP数据管理", "MARKETING API管理", "第三方DMP管理", "小工具", "移动端管理",
  "柚+ 管理", "全局配置管理", "诊断中心",
];

const emptyRule = (): Rule => ({ dimension: "身份", operator: "包含", value: "经期" });

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} disabled={disabled} onClick={onChange}><span /></button>;
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
  const [currentView, setCurrentView] = useState<"groups" | "pids" | "report" | "abReport">("groups");
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [dsps, setDsps] = useState<Dsp[]>(initialDsps);
  const [experiments, setExperiments] = useState<GroupExperiment[]>(initialExperiments);
  const [experimentPage, setExperimentPage] = useState<"create" | "detail" | null>(null);
  const [scene, setScene] = useState("开屏");
  const [platform, setPlatform] = useState("IOS");
  const [showEffectiveOnly, setShowEffectiveOnly] = useState(true);
  const [groupListExpanded, setGroupListExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedGroupId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [modal, setModal] = useState<"group" | "groupManager" | "deleteGroup" | "disableGroup" | "pidSelector" | "dsp" | "batch" | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [disableConfirmGroupId, setDisableConfirmGroupId] = useState<number | null>(null);
  const [editingDspId, setEditingDspId] = useState<number | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [editingFloor, setEditingFloor] = useState<number | null>(null);
  const [selectedDspIds, setSelectedDspIds] = useState<number[]>([]);
  const [managedGroupDraft, setManagedGroupDraft] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [draggedGroupId, setDraggedGroupId] = useState<number | null>(null);
  const pointerDraggedGroupId = useRef<number | null>(null);
  const lastPointerTargetId = useRef<number | null>(null);
  const [batchOperation, setBatchOperation] = useState<BatchOperation>("disable");
  const [batchPrice, setBatchPrice] = useState("");
  const [batchError, setBatchError] = useState("");
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [groupDraft, setGroupDraft] = useState({ name: "", priority: 100012, adSlot: "1000-美柚-开屏广告", rules: [] as Rule[] });
  const [dspDraft, setDspDraft] = useState({ name: "", size: "全尺寸" as "全尺寸" | "自定义", customSize: "", pids: [""], minVersion: "", maxVersion: "", floor: 0.3, enabled: true });
  const [pidLibrary, setPidLibrary] = useState<PidRecord[]>(() => normalizePidRecords(INITIAL_PID_RECORDS));
  const [selectedLibraryPidIds, setSelectedLibraryPidIds] = useState<number[]>([]);
  const [pidLibraryQuery, setPidLibraryQuery] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- Browser-local demo data is restored once after hydration. */
  useEffect(() => {
    try {
      const storedGroups = localStorage.getItem("adx-demo-groups");
      const storedDsps = localStorage.getItem("adx-demo-dsps-batch-v1");
      const storedExperiments = localStorage.getItem("adx-demo-group-experiments-v1");
      if (storedGroups) {
        const normalizedGroups = normalizeGroups(JSON.parse(storedGroups));
        setGroups(normalizedGroups);
        const highestId = highestEffectiveGroupId(normalizedGroups.filter((group) => group.scene === "开屏" && group.platform === "IOS"));
        if (highestId !== null) setSelectedId(highestId);
      }
      if (storedDsps) setDsps(JSON.parse(storedDsps));
      if (storedExperiments) setExperiments(JSON.parse(storedExperiments));
    } catch { /* keep the seeded demo data */ }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("adx-demo-groups", JSON.stringify(groups));
    localStorage.setItem("adx-demo-dsps-batch-v1", JSON.stringify(dsps));
    localStorage.setItem("adx-demo-group-experiments-v1", JSON.stringify(experiments));
  }, [groups, dsps, experiments, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const sceneGroups = useMemo(() => groups.filter((group) => group.scene === scene && group.platform === platform).sort((a, b) => b.priority - a.priority), [groups, scene, platform]);
  const visibleGroups = useMemo(() => showEffectiveOnly ? sceneGroups.filter((group) => group.enabled || group.isDefault) : sceneGroups, [sceneGroups, showEffectiveOnly]);
  const selected = visibleGroups.find((group) => group.id === selectedId) ?? visibleGroups[0];
  const selectedExperiment = selected ? experiments.find((experiment) => experiment.groupId === selected.id) : undefined;

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
    setGroupListExpanded(false);
    const nextGroups = groups.filter((group) => group.scene === nextScene && group.platform === platform).sort((a, b) => b.priority - a.priority);
    const nextGroupId = showEffectiveOnly ? highestEffectiveGroupId(nextGroups) : nextGroups[0]?.id;
    if (nextGroupId !== null && nextGroupId !== undefined) setSelectedId(nextGroupId);
    resetPidSelection();
  };

  const changePlatform = (nextPlatform: string) => {
    setPlatform(nextPlatform);
    setGroupListExpanded(false);
    const nextGroups = groups.filter((group) => group.scene === scene && group.platform === nextPlatform).sort((a, b) => b.priority - a.priority);
    const nextGroupId = showEffectiveOnly ? highestEffectiveGroupId(nextGroups) : nextGroups[0]?.id;
    if (nextGroupId !== null && nextGroupId !== undefined) setSelectedId(nextGroupId);
    resetPidSelection();
  };

  const groupDsps = dsps.filter((dsp) => dsp.groupId === selected?.id);
  const enabledDsps = groupDsps.filter((dsp) => dsp.enabled);
  const disabledDsps = groupDsps.filter((dsp) => !dsp.enabled);
  const visibleDsps = showDisabled ? [...enabledDsps, ...disabledDsps] : enabledDsps;
  const selectedDsps = groupDsps.filter((dsp) => selectedDspIds.includes(dsp.id));
  const selectablePids = pidLibrary.filter((record) => record.enabled
    && record.scene === selected?.scene
    && record.platform === selected?.platform
    && record.adSlot === selected?.adSlot
    && !groupDsps.some((dsp) => dsp.pids.includes(record.pid))
    && (!pidLibraryQuery.trim() || `${record.pid} ${record.dspSource}`.toLocaleLowerCase().includes(pidLibraryQuery.trim().toLocaleLowerCase())));
  const selectedPidCount = selectedDsps.reduce((sum, dsp) => sum + dsp.pids.length, 0);
  const enabledSelectedCount = selectedDsps.filter((dsp) => dsp.enabled).reduce((sum, dsp) => sum + dsp.pids.length, 0);
  const disabledSelectedCount = selectedDsps.filter((dsp) => !dsp.enabled).reduce((sum, dsp) => sum + dsp.pids.length, 0);
  const allVisibleSelected = visibleDsps.length > 0 && visibleDsps.every((dsp) => selectedDspIds.includes(dsp.id));
  const managerGroups = managedGroupDraft;
  const manageableGroups = managerGroups.filter((group) => !group.isDefault);
  const selectedManageGroups = manageableGroups.filter((group) => selectedGroupIds.includes(group.id));
  const allManageableSelected = manageableGroups.length > 0 && manageableGroups.every((group) => selectedGroupIds.includes(group.id));
  const selectedEnabledGroups = selectedManageGroups.filter((group) => group.enabled).length;
  const selectedDisabledGroups = selectedManageGroups.filter((group) => !group.enabled).length;

  const notify = (message: string) => setToast(message);
  const patchSelected = (patch: Partial<Group>) => selected && setGroups((current) => current.map((group) => group.id === selected.id ? { ...group, ...patch } : group));

  const requestSelectedGroupStatusChange = () => {
    if (!selected || selected.isDefault) return;
    if (!selected.enabled) {
      patchSelected({ enabled: true });
      notify("分组已开启，分组策略已生效");
      return;
    }
    setDisableConfirmGroupId(selected.id);
    setModal("disableGroup");
  };

  const closeDisableGroupConfirmation = () => {
    setModal(null);
    setDisableConfirmGroupId(null);
  };

  const confirmDisableGroup = () => {
    const target = groups.find((group) => group.id === disableConfirmGroupId);
    if (!target || target.isDefault || !target.enabled) {
      closeDisableGroupConfirmation();
      return notify("该分组当前不可停用");
    }
    setGroups((current) => current.map((group) => group.id === target.id ? { ...group, enabled: false } : group));
    closeDisableGroupConfirmation();
    notify("分组已关闭，分组策略已失效");
  };

  const openGroupModal = (group?: Group) => {
    setOpenMenu(null);
    setEditingGroupId(group?.id ?? null);
    setGroupDraft(group ? { name: group.name, priority: group.priority, adSlot: group.adSlot, rules: group.rules.map((rule) => ({ ...rule })) } : { name: "", priority: Math.max(...sceneGroups.map((item) => item.priority), 1) + 1, adSlot: scene === "开屏" ? "1000-美柚-开屏广告" : `${scene}-默认广告位`, rules: [] });
    setModal("group");
  };

  const openGroupManager = () => {
    setManagedGroupDraft(sceneGroups.map((group) => ({ ...group, rules: group.rules.map((rule) => ({ ...rule })) })));
    setSelectedGroupIds([]);
    setDraggedGroupId(null);
    setModal("groupManager");
  };

  const toggleAllManageableGroups = () => {
    setSelectedGroupIds(allManageableSelected ? [] : manageableGroups.map((group) => group.id));
  };

  const toggleEffectiveFilter = () => {
    const nextValue = !showEffectiveOnly;
    setShowEffectiveOnly(nextValue);
    setGroupListExpanded(false);
    if (nextValue) {
      const highestId = highestEffectiveGroupId(sceneGroups);
      if (highestId !== null) selectGroup(highestId);
    }
  };

  const toggleManagedGroupSelection = (id: number) => {
    setSelectedGroupIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const changeManagedGroupStatus = (ids: number[], enabled: boolean) => {
    setManagedGroupDraft((current) => setManagedGroupsEnabled(current, ids, enabled));
  };

  const dropManagedGroup = (targetId: number, sourceId: number | null = draggedGroupId) => {
    if (sourceId === null) return;
    setManagedGroupDraft((current) => reorderGroupPriority(current, current.map((group) => group.id), sourceId, targetId));
    setDraggedGroupId(null);
  };

  const startPointerGroupDrag = (event: ReactPointerEvent<HTMLButtonElement>, groupId: number) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDraggedGroupId.current = groupId;
    lastPointerTargetId.current = groupId;
    setDraggedGroupId(groupId);
  };

  const movePointerGroupDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const sourceId = pointerDraggedGroupId.current;
    if (sourceId === null) return;

    const targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-managed-group-id]");
    const targetId = Number(targetRow?.dataset.managedGroupId);
    if (!Number.isFinite(targetId) || targetId === lastPointerTargetId.current) return;

    lastPointerTargetId.current = targetId;
    setManagedGroupDraft((current) => reorderGroupPriority(current, current.map((group) => group.id), sourceId, targetId));
  };

  const endPointerGroupDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerDraggedGroupId.current = null;
    lastPointerTargetId.current = null;
    setDraggedGroupId(null);
  };

  const moveManagedGroup = (groupId: number, direction: -1 | 1) => {
    const index = managerGroups.findIndex((group) => group.id === groupId);
    const target = managerGroups[index + direction];
    if (!target || managerGroups[index]?.isDefault) return;
    setManagedGroupDraft((current) => reorderGroupPriority(current, current.map((group) => group.id), groupId, target.id));
  };

  const closeGroupManager = () => {
    setModal(null);
    setManagedGroupDraft([]);
    setSelectedGroupIds([]);
    setDraggedGroupId(null);
  };

  const confirmGroupManager = () => {
    const draftById = new Map(managerGroups.map((group) => [group.id, group]));
    setGroups((current) => normalizeGroups(current.map((group) => draftById.get(group.id) ?? group)));
    closeGroupManager();
    notify("分组管理修改已保存");
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
      setShowEffectiveOnly(false);
      selectGroup(group.id);
      notify("分组已添加");
    }
    setModal(null);
  };

  const copyGroup = (group: Group) => {
    const copy = { ...group, id: Date.now(), name: `${group.name}-副本`, priority: Math.max(...sceneGroups.map((item) => item.priority), 1) + 1, enabled: false, isDefault: false };
    setGroups((current) => [copy, ...current]);
    setShowEffectiveOnly(false);
    selectGroup(copy.id);
    setOpenMenu(null);
    notify("已复制为新分组");
  };

  const openDeleteGroupConfirmation = (group: Group) => {
    setOpenMenu(null);
    if (group.enabled || group.isDefault) return notify("仅已失效的非默认分组可删除");
    setDeletingGroupId(group.id);
    setModal("deleteGroup");
  };

  const closeDeleteGroupConfirmation = () => {
    setModal(null);
    setDeletingGroupId(null);
  };

  const confirmDeleteGroup = () => {
    const deletingGroup = groups.find((group) => group.id === deletingGroupId);
    if (!deletingGroup || deletingGroup.enabled || deletingGroup.isDefault) {
      closeDeleteGroupConfirmation();
      return notify("该分组当前不可删除");
    }

    const remainingGroups = groups.filter((group) => group.id !== deletingGroup.id);
    setGroups(remainingGroups);
    setDsps((current) => current.filter((dsp) => dsp.groupId !== deletingGroup.id));
    if (selectedId === deletingGroup.id) {
      const remainingSceneGroups = remainingGroups.filter((group) => group.scene === scene && group.platform === platform).sort((a, b) => b.priority - a.priority);
      const nextId = showEffectiveOnly ? highestEffectiveGroupId(remainingSceneGroups) : remainingSceneGroups[0]?.id;
      if (nextId !== null && nextId !== undefined) setSelectedId(nextId);
    }
    closeDeleteGroupConfirmation();
    notify(`分组“${deletingGroup.name}”已删除`);
  };

  const openBoundGroup = (groupId: number) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return notify("关联分组已不存在");
    setCurrentView("groups");
    setScene(group.scene);
    setPlatform(group.platform);
    setShowEffectiveOnly(false);
    setGroupListExpanded(true);
    setSelectedId(group.id);
    resetPidSelection();
  };

  const openDspModal = (dsp?: Dsp) => {
    setEditingDspId(dsp?.id ?? null);
    setDspDraft(dsp ? { name: dsp.name, size: dsp.size, customSize: dsp.customSize ?? "", pids: [...dsp.pids], minVersion: dsp.minVersion, maxVersion: dsp.maxVersion, floor: dsp.floor, enabled: dsp.enabled } : { name: "", size: "全尺寸", customSize: "", pids: [""], minVersion: "", maxVersion: "", floor: 0.3, enabled: true });
    setModal("dsp");
  };

  const openPidSelector = () => {
    let records = normalizePidRecords(INITIAL_PID_RECORDS);
    try {
      const stored = localStorage.getItem("adx-demo-pid-manager-v1");
      if (stored) records = normalizePidRecords(JSON.parse(stored));
    } catch { /* keep seeded PID library */ }
    setPidLibrary(records);
    setSelectedLibraryPidIds([]);
    setPidLibraryQuery("");
    setModal("pidSelector");
  };

  const confirmPidSelection = () => {
    if (!selected || !selectedLibraryPidIds.length) return;
    const picked = pidLibrary.filter((record) => selectedLibraryPidIds.includes(record.id));
    setDsps((current) => [...current, ...picked.map((record, index) => ({
      id: Date.now() + index,
      groupId: selected.id,
      name: record.dspSource,
      enabled: true,
      floor: record.floor ?? 0.3,
      pids: [record.pid],
      minVersion: record.appVersion,
      maxVersion: record.maxAppVersion ?? "",
      size: record.size ?? "全尺寸",
      customSize: record.customSize,
      revenue: 0,
      ecpm: 0,
      requestValue: 0,
      requests: 0,
      returns: 0,
      bidWins: 0,
      impressions: 0,
      ctr: 0,
      cpc: 0,
    }))]);
    const pickedIds = new Set(picked.map((record) => record.id));
    const updatedLibrary = pidLibrary.map((record) => pickedIds.has(record.id) && !record.groupIds.includes(selected.id) ? { ...record, groupIds: [...record.groupIds, selected.id] } : record);
    setPidLibrary(updatedLibrary);
    localStorage.setItem("adx-demo-pid-manager-v1", JSON.stringify(updatedLibrary));
    setModal(null);
    notify(`已选择并绑定 ${picked.length} 个 PID`);
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
        <button type="button" className={`sub-row ${currentView === "groups" ? "active" : ""}`} onClick={() => { setCurrentView("groups"); setExperimentPage(null); setModal(null); }}>›&nbsp; 流量分组管理</button>
        <button type="button" className={`sub-row ${currentView === "pids" ? "active" : ""}`} onClick={() => { setCurrentView("pids"); setExperimentPage(null); setModal(null); }}>›&nbsp; PID 管理</button>
        <button type="button" className={`sub-row ${currentView === "report" ? "active" : ""}`} onClick={() => { setCurrentView("report"); setExperimentPage(null); setModal(null); }}>›&nbsp; 综合报表</button>
        <button type="button" className={`sub-row ${currentView === "abReport" ? "active" : ""}`} onClick={() => { setCurrentView("abReport"); setExperimentPage(null); setModal(null); }}>›&nbsp; A/B测试报表</button>
        <button type="button" className="side-row">广告交互管理<span>‹</span></button>
      </aside>

      <main className="content">
        {currentView === "groups" && experimentPage && selected ? <GroupExperimentManager group={selected} dsps={groupDsps} experiment={experimentPage === "detail" ? selectedExperiment : undefined} onBack={() => setExperimentPage(null)} onNotify={notify} onChange={(nextExperiment) => {
          setExperiments((current) => current.some((item) => item.groupId === nextExperiment.groupId) ? current.map((item) => item.groupId === nextExperiment.groupId ? nextExperiment : item) : [...current, nextExperiment]);
          setGroups((current) => current.map((group) => group.id === nextExperiment.groupId ? { ...group, ab: true, traffic: nextExperiment.bTraffic, experiment: nextExperiment.aTraffic === 100 ? "A对照组" : "B测试组" } : group));
        }} /> : currentView === "groups" ? <section className="panel">
          <h1>流量分组管理</h1>
          <div className="filters">
            <label>广告场景：<select aria-label="广告场景" value={scene} onChange={(event) => changeScene(event.target.value)}><option>开屏</option><option>插屏</option><option>社区-信息流</option><option>社区-详情页</option><option>社区-其他广告位</option><option>搜索</option><option>icon</option></select></label>
            <label>平台：<select aria-label="平台" value={platform} onChange={(event) => changePlatform(event.target.value)}><option>IOS</option><option>Android</option></select></label>
          </div>
          <div className="group-toolbar"><div><button type="button" className="primary" onClick={() => openGroupModal()}>＋ 添加分组</button><button type="button" className="secondary" onClick={openGroupManager}>分组管理</button></div><button type="button" className={`effective-filter ${showEffectiveOnly ? "active" : ""}`} aria-pressed={showEffectiveOnly} onClick={toggleEffectiveFilter}><span>{showEffectiveOnly ? "✓" : ""}</span>仅展示生效中</button></div>

          <div className="group-list-area">
            <div id="group-list" className={`groups ${groupListExpanded ? "expanded" : "collapsed"}`} aria-label="分组列表">
              {visibleGroups.length ? visibleGroups.map((group) => (
                <div className={`group-item ${group.id === selected?.id ? "selected" : ""}`} key={group.id}>
                  <button type="button" className="group-select" onClick={() => selectGroup(group.id)}><span>{group.name}</span>{group.ab && <em>AB</em>}{group.enabled || group.isDefault ? <small className="effective-tag">生效中</small> : <small>已关闭</small>}</button>
                  <button type="button" className="group-more" aria-label={`${group.name}更多操作`} onClick={(event) => { event.stopPropagation(); setGroupListExpanded(true); setOpenMenu(openMenu === group.id ? null : group.id); }}>⋮</button>
                  {openMenu === group.id && <div className="group-menu"><button type="button" onClick={() => openGroupModal(group)}>编辑分组</button><button type="button" onClick={() => copyGroup(group)}>复制</button>{!group.enabled && !group.isDefault && <button type="button" className="danger" onClick={() => openDeleteGroupConfirmation(group)}>删除分组</button>}</div>}
                </div>
              )) : <div className="empty">{showEffectiveOnly ? "当前场景与平台暂无生效中的分组。" : "当前场景与平台暂无分组，点击“添加分组”新建。"}</div>}
            </div>
            {visibleGroups.length > 2 && <button type="button" className="group-list-toggle" aria-controls="group-list" aria-expanded={groupListExpanded} onClick={() => { setGroupListExpanded((value) => !value); setOpenMenu(null); }}><span>{groupListExpanded ? "⌃" : "⌄"}</span>{groupListExpanded ? "收起分组" : `展开全部分组（${visibleGroups.length}）`}</button>}
          </div>

          {selected && <>
            <div className="group-detail">
              <div><strong>广告位：</strong><span className="pink-tag">{selected.adSlot}</span></div>
              <div><strong>分组规则：</strong>{selected.rules.length ? selected.rules.map((rule, index) => <span className="rule-tag" key={`${rule.dimension}-${index}`}>{rule.dimension}({rule.operator}): {rule.value}</span>) : <span className="muted">默认流量，无附加规则</span>}</div>
              <div className="controls"><strong>分组开关</strong><Toggle checked={selected.isDefault ? true : selected.enabled} disabled={Boolean(selected.isDefault)} label={selected.isDefault ? "默认分组始终启用" : "分组开关"} onChange={requestSelectedGroupStatusChange} />{selected.isDefault && <span className="default-hint">默认分组始终启用</span>}<i /><strong>实验管理</strong>{selectedExperiment && <><span className={`experiment-status compact ${selectedExperiment.status}`}>{selectedExperiment.status === "running" ? "开启中" : "待开启"}</span><span className="experiment-ratio-summary">A {selectedExperiment.aTraffic}% / B {selectedExperiment.bTraffic}%</span></>}{selected.enabled || selected.isDefault ? <button type="button" className="primary push-right" onClick={() => setExperimentPage(selectedExperiment ? "detail" : "create")}>{selectedExperiment ? "查看A/B测试数据" : "创建A/B实验"}</button> : <span className="experiment-unavailable push-right">启用分组后可创建实验</span>}</div>
            </div>

            <div className="pid-toolbar">
              <button type="button" className="primary" onClick={openPidSelector}>＋ 选择PID</button>
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
        </section> : currentView === "pids" ? <PidManager groups={groups} onOpenGroup={openBoundGroup} onNotify={notify} /> : currentView === "report" ? <ReportManager groups={groups} onNotify={notify} /> : <AbReportManager onNotify={notify} />}
      </main>

      {modal === "groupManager" && <Modal title="分组管理" onClose={closeGroupManager} wide>
        <div className="group-manager-body">
          <div className="group-manager-meta"><strong>当前场景：{scene}</strong><span>/</span><strong>平台：{platform === "IOS" ? "iOS" : platform}</strong></div>
          <div className="group-manager-tip"><span>↕</span><div><strong>拖拽调整分组优先级，数字越小优先级越高</strong><small>调整后点击“确认”保存；默认分组固定置底并始终启用。</small></div></div>
          <div className="group-manager-toolbar">
            <label><input type="checkbox" checked={allManageableSelected} onChange={toggleAllManageableGroups} />全选非默认分组</label>
            <span>已选择 {selectedManageGroups.length} 个分组</span>
            <div><button type="button" className="secondary" disabled={!selectedDisabledGroups} onClick={() => changeManagedGroupStatus(selectedManageGroups.filter((group) => !group.enabled).map((group) => group.id), true)}>批量启用{selectedDisabledGroups ? `（${selectedDisabledGroups}）` : ""}</button><button type="button" className="secondary danger" disabled={!selectedEnabledGroups} onClick={() => changeManagedGroupStatus(selectedManageGroups.filter((group) => group.enabled).map((group) => group.id), false)}>批量停用{selectedEnabledGroups ? `（${selectedEnabledGroups}）` : ""}</button></div>
          </div>
          <div className="group-manager-list" aria-label="可排序分组列表">
            {managerGroups.map((group, index) => <div className={`managed-group-row ${group.isDefault ? "default" : ""} ${draggedGroupId === group.id ? "dragging" : ""}`} data-managed-group-id={group.id} key={group.id} draggable={!group.isDefault} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(group.id)); setDraggedGroupId(group.id); }} onDragEnd={() => setDraggedGroupId(null)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); const transferredId = Number(event.dataTransfer.getData("text/plain")); dropManagedGroup(group.id, Number.isFinite(transferredId) && transferredId > 0 ? transferredId : draggedGroupId); }}>
              <button type="button" className="drag-handle" aria-label={`拖动${group.name}调整优先级`} disabled={group.isDefault} onPointerDown={(event) => startPointerGroupDrag(event, group.id)} onPointerMove={movePointerGroupDrag} onPointerUp={endPointerGroupDrag} onPointerCancel={endPointerGroupDrag}>⠿</button>
              <input type="checkbox" aria-label={`选择分组 ${group.name}`} disabled={group.isDefault} checked={!group.isDefault && selectedGroupIds.includes(group.id)} onChange={() => toggleManagedGroupSelection(group.id)} />
              <strong className="priority-badge">P{index + 1}</strong>
              <div className="managed-group-info"><strong>{group.name}</strong><span>{group.isDefault ? "默认分组 · 固定置底" : group.rules.length ? `${group.rules.length} 条分组规则` : "无附加分组规则"}</span></div>
              <span className={`strategy-state ${group.enabled || group.isDefault ? "effective" : "inactive"}`}>{group.enabled || group.isDefault ? "策略生效" : "策略失效"}</span>
              <Toggle checked={group.isDefault ? true : group.enabled} disabled={Boolean(group.isDefault)} label={group.isDefault ? `${group.name}默认启用` : `${group.name}状态`} onChange={() => changeManagedGroupStatus([group.id], !group.enabled)} />
              <div className="move-actions"><button type="button" aria-label={`${group.name}上移`} disabled={group.isDefault || index === 0} onClick={() => moveManagedGroup(group.id, -1)}>↑</button><button type="button" aria-label={`${group.name}下移`} disabled={group.isDefault || index >= manageableGroups.length - 1} onClick={() => moveManagedGroup(group.id, 1)}>↓</button></div>
            </div>)}
          </div>
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={closeGroupManager}>取消</button><button type="button" className="primary" onClick={confirmGroupManager}>确认</button></div>
      </Modal>}

      {modal === "deleteGroup" && <Modal title="删除分组" onClose={closeDeleteGroupConfirmation}>
        <div className="delete-confirm-body">
          <span className="delete-warning" aria-hidden="true">!</span>
          <div><h3>确认删除“{groups.find((group) => group.id === deletingGroupId)?.name}”吗？</h3><p>删除后不可恢复，该分组下的 PID 配置也将同步删除。</p></div>
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={closeDeleteGroupConfirmation}>取消</button><button type="button" className="danger-primary" onClick={confirmDeleteGroup}>确认删除</button></div>
      </Modal>}

      {modal === "disableGroup" && <Modal title="停用分组" onClose={closeDisableGroupConfirmation}>
        <div className="delete-confirm-body">
          <span className="disable-warning" aria-hidden="true">!</span>
          <div><h3>确认停用“{groups.find((group) => group.id === disableConfirmGroupId)?.name}”吗？</h3><p>停用后，该流量分组策略将立即失效，分组内的 PID 配置会保留。</p></div>
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={closeDisableGroupConfirmation}>取消</button><button type="button" className="danger-primary" onClick={confirmDisableGroup}>确认停用</button></div>
      </Modal>}

      {modal === "group" && <Modal title={editingGroupId ? "编辑分组" : "添加分组"} onClose={() => setModal(null)}>
        <form onSubmit={saveGroup}>
          <div className="modal-body">
            <Field label="分组名称" required><input maxLength={20} placeholder="请输入分组名称" value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} /><small className="counter">{groupDraft.name.length}/20</small></Field>
            <Field label="优先级" hint="请在“分组管理”中拖拽调整"><input disabled value={editingGroupId ? `P${Math.max(1, sceneGroups.findIndex((group) => group.id === editingGroupId) + 1)}` : "保存后默认置顶"} /></Field>
            <Field label="广告场景"><input disabled value={scene} /></Field>
            <Field label="平台"><input disabled value={platform} /></Field>
            <Field label="广告位" required><select value={groupDraft.adSlot} onChange={(event) => setGroupDraft({ ...groupDraft, adSlot: event.target.value })}><option>1000-美柚-开屏广告</option><option>1001-美柚-开屏广告-新</option><option>{scene}-默认广告位</option></select></Field>
            <Field label="分组规则"><div className="rule-editor">{groupDraft.rules.map((rule, index) => <div className="rule-row" key={index}><select aria-label={`规则${index + 1}维度`} value={rule.dimension} onChange={(event) => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, dimension: event.target.value } : item) })}><option>身份</option><option>城市</option><option>年龄</option><option>应用版本</option></select><select aria-label={`规则${index + 1}关系`} value={rule.operator} onChange={(event) => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item) })}><option>包含</option><option>不包含</option><option>等于</option></select><input aria-label={`规则${index + 1}值`} value={rule.value} onChange={(event) => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} /><button type="button" aria-label="删除规则" onClick={() => setGroupDraft({ ...groupDraft, rules: groupDraft.rules.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>)}<button type="button" className="secondary" onClick={() => setGroupDraft({ ...groupDraft, rules: [...groupDraft.rules, emptyRule()] })}>＋ 添加规则</button></div></Field>
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button className="primary" type="submit">提 交</button></div>
        </form>
      </Modal>}

      {modal === "pidSelector" && <Modal title="选择 PID" onClose={() => setModal(null)} wide>
        <div className="pid-selector-body">
          <div className="pid-selector-context"><span>当前分组：<strong>{selected?.name}</strong></span><span>仅展示与当前广告场景、平台、广告位匹配且已启用的 PID</span></div>
          <input className="pid-selector-search" aria-label="检索可选PID" placeholder="输入 PID 或 DSP 来源检索" value={pidLibraryQuery} onChange={(event) => setPidLibraryQuery(event.target.value)} />
          <div className="table-wrap pid-selector-table"><table><thead><tr><th className="selection-cell"><input type="checkbox" aria-label="选择全部可用PID" checked={selectablePids.length > 0 && selectablePids.every((record) => selectedLibraryPidIds.includes(record.id))} onChange={(event) => setSelectedLibraryPidIds(event.target.checked ? selectablePids.map((record) => record.id) : [])} /></th><th>PID</th><th>DSP 来源</th><th>应用版本</th><th>尺寸</th><th>底价</th></tr></thead><tbody>{selectablePids.map((record) => <tr key={record.id}><td className="selection-cell"><input type="checkbox" aria-label={`选择PID ${record.pid}`} checked={selectedLibraryPidIds.includes(record.id)} onChange={() => setSelectedLibraryPidIds((current) => current.includes(record.id) ? current.filter((id) => id !== record.id) : [...current, record.id])} /></td><td><strong>{record.pid}</strong></td><td>{record.dspSource}</td><td>{record.appVersion}{record.maxAppVersion ? ` ~ ${record.maxAppVersion}` : "及以上"}</td><td>{record.size ?? "全尺寸"}{record.customSize ? `（${record.customSize}）` : ""}</td><td>¥{(record.floor ?? 0.3).toFixed(2)}</td></tr>)}{!selectablePids.length && <tr><td colSpan={6}><div className="empty">暂无可选择的 PID，请先前往 PID 管理创建或启用 PID</div></td></tr>}</tbody></table></div>
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取消</button><button type="button" className="primary" disabled={!selectedLibraryPidIds.length} onClick={confirmPidSelection}>确认选择{selectedLibraryPidIds.length ? `（${selectedLibraryPidIds.length}）` : ""}</button></div>
      </Modal>}

      {modal === "dsp" && <Modal title="编辑 PID 配置" onClose={() => setModal(null)}>
        <form onSubmit={saveDsp}>
          <div className="modal-body">
            <Field label="DSP来源"><input disabled value={dspDraft.name} /></Field>
            <Field label="广告场景"><input disabled value={scene} /></Field><Field label="平台"><input disabled value={platform} /></Field><Field label="广告位"><input disabled value={selected?.adSlot ?? ""} /></Field>
            <Field label="尺寸"><div className="radios"><label><input type="radio" checked={dspDraft.size === "全尺寸"} onChange={() => setDspDraft({ ...dspDraft, size: "全尺寸" })} />全尺寸</label><label><input type="radio" checked={dspDraft.size === "自定义"} onChange={() => setDspDraft({ ...dspDraft, size: "自定义" })} />自定义</label>{dspDraft.size === "自定义" && <input placeholder="如 1080×1920" value={dspDraft.customSize} onChange={(event) => setDspDraft({ ...dspDraft, customSize: event.target.value })} />}</div></Field>
            <Field label="PID"><input disabled value={dspDraft.pids.join(" / ")} /><div className="version-row"><span>应用版本</span><input placeholder="最小版本，如 9.01.0" value={dspDraft.minVersion} onChange={(event) => setDspDraft({ ...dspDraft, minVersion: event.target.value })} /><input placeholder="最大版本，如 9.01.0" value={dspDraft.maxVersion} onChange={(event) => setDspDraft({ ...dspDraft, maxVersion: event.target.value })} /></div></Field>
            <Field label="底价" required><input type="number" min="0" step="0.1" value={dspDraft.floor} onChange={(event) => setDspDraft({ ...dspDraft, floor: Number(event.target.value) })} /></Field>
            <Field label="状态"><Toggle checked={dspDraft.enabled} label="DSP状态" onChange={() => setDspDraft({ ...dspDraft, enabled: !dspDraft.enabled })} /></Field>
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取 消</button><button className="primary" type="submit">提 交</button></div>
        </form>
      </Modal>}

      {modal === "batch" && <Modal title="批量操作" onClose={() => setModal(null)}>
        <form noValidate onSubmit={submitBatchOperation}>
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
              <div className="currency-input"><span>¥</span><input type="number" inputMode="decimal" min="0" max={BATCH_PRICE_MAX} step="any" placeholder="请输入价格" value={batchPrice} onChange={(event) => { setBatchPrice(event.target.value); setBatchError(""); }} /></div>
              <small>人民币（¥），必须大于 0，最高 {BATCH_PRICE_MAX}，支持小数</small>
            </Field>}
            {batchError && <div className="field-error" role="alert">{batchError}</div>}
          </div>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>取消</button><button className="primary" type="submit">确认执行</button></div>
        </form>
      </Modal>}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function DspRow({ dsp, selected, onSelect, editingFloor, setEditingFloor, patchDsp, openEdit, percent }: { dsp: Dsp; selected: boolean; onSelect: () => void; editingFloor: number | null; setEditingFloor: (id: number | null) => void; patchDsp: (id: number, patch: Partial<Dsp>) => void; openEdit: () => void; percent: (part: number, whole: number) => string }) {
  return <tr className={!dsp.enabled ? "disabled-row" : ""}><td className="selection-cell"><input type="checkbox" aria-label={`选择 ${dsp.name} 的PID`} checked={selected} onChange={onSelect} /></td><td><button type="button" className="text-action" onClick={openEdit}>编辑</button></td><td>{dsp.name}<small className="pid-note">{dsp.pids.join(" / ")}</small></td><td><Toggle checked={dsp.enabled} label={`${dsp.name}状态`} onChange={() => patchDsp(dsp.id, { enabled: !dsp.enabled })} /></td><td>{editingFloor === dsp.id ? <span className="floor-edit"><input aria-label="底价" type="number" min="0" step="0.1" value={dsp.floor} onChange={(event) => patchDsp(dsp.id, { floor: Number(event.target.value) })} /><button type="button" aria-label="保存底价" onClick={() => setEditingFloor(null)}>✓</button></span> : <button type="button" className="floor-value" onClick={() => setEditingFloor(dsp.id)}>¥{dsp.floor} <span>✎</span></button>}</td><td>¥{dsp.revenue}</td><td>{dsp.ecpm.toFixed(2)}</td><td>¥{dsp.requestValue}</td><td>{dsp.requests}</td><td>{dsp.returns}</td><td>{percent(dsp.returns, dsp.requests)}</td><td>{dsp.bidWins}</td><td>{percent(dsp.bidWins, dsp.returns)}</td><td>{dsp.impressions}</td><td>{percent(dsp.impressions, dsp.bidWins)}</td><td>{dsp.ctr}%</td><td>¥{dsp.cpc}</td></tr>;
}
