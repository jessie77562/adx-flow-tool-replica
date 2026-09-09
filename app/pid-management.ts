export type PidPlatform = "Android" | "IOS";

export type PidRecord = {
  id: number;
  pid: string;
  dspSource: string;
  enabled: boolean;
  platform: PidPlatform;
  scene: string;
  adSlot: string;
  groupIds: number[];
  appVersion: string;
  maxAppVersion?: string;
  size?: "全尺寸" | "自定义";
  customSize?: string;
  floor?: number;
};

export type PidFilters = {
  scene: string;
  platform: string;
  adSlot: string;
  pid: string;
  dspSources: string[];
  groupIds: string[];
  showAll: boolean;
};

export type PidDraft = Omit<PidRecord, "id" | "groupIds" | "platform" | "maxAppVersion" | "size" | "customSize" | "floor"> & {
  platform: PidPlatform | "";
  maxAppVersion: string;
  size: "全尺寸" | "自定义";
  customSize: string;
  floor: number;
};

export type PidDraftErrors = Partial<Record<keyof PidDraft, string>>;

export const PID_SCENES = ["开屏", "插屏", "社区-信息流", "社区-详情页", "社区-其他广告位", "搜索", "icon"];

export const PID_DSP_SOURCES = ["穿山甲", "腾讯广告", "快手", "Mintegral", "巨量引擎", "Unity Ads", "AppLovin", "AdMob"];

export const PID_AD_SLOTS = [
  { scene: "开屏", platform: "IOS" as const, value: "1000-美柚-开屏广告" },
  { scene: "开屏", platform: "Android" as const, value: "1100-美柚-开屏广告" },
  { scene: "插屏", platform: "IOS" as const, value: "2001-美柚-插屏广告" },
  { scene: "插屏", platform: "Android" as const, value: "2101-美柚-插屏广告" },
  { scene: "社区-信息流", platform: "IOS" as const, value: "3001-社区信息流广告" },
  { scene: "社区-信息流", platform: "Android" as const, value: "3101-社区信息流广告" },
  { scene: "社区-详情页", platform: "IOS" as const, value: "3002-社区详情页广告" },
  { scene: "社区-详情页", platform: "Android" as const, value: "3102-社区详情页广告" },
  { scene: "社区-其他广告位", platform: "IOS" as const, value: "3003-社区其他广告位" },
  { scene: "社区-其他广告位", platform: "Android" as const, value: "3103-社区其他广告位" },
  { scene: "搜索", platform: "IOS" as const, value: "4001-美柚-搜索广告" },
  { scene: "搜索", platform: "Android" as const, value: "4101-美柚-搜索广告" },
  { scene: "icon", platform: "IOS" as const, value: "5001-icon广告" },
  { scene: "icon", platform: "Android" as const, value: "5101-icon广告" },
];

export function validatePidDraft(draft: PidDraft, records: PidRecord[], editingId: number | null): PidDraftErrors {
  const errors: PidDraftErrors = {};
  if (!draft.dspSource) errors.dspSource = "请选择 DSP 来源";
  if (!draft.scene) errors.scene = "请选择广告场景";
  if (!draft.platform) errors.platform = "请选择平台";
  if (!draft.adSlot) errors.adSlot = "请选择广告位";
  if (!draft.pid.trim()) errors.pid = "请输入 PID";
  else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(draft.pid.trim())) errors.pid = "PID 格式错误";
  else if (records.some((record) => record.id !== editingId && record.pid.toLowerCase() === draft.pid.trim().toLowerCase())) errors.pid = "该 PID 已存在，请重新输入";

  if (!draft.appVersion.trim()) errors.appVersion = "请输入应用版本";
  else if (!/^\d+\.\d+\.\d+$/.test(draft.appVersion.trim())) errors.appVersion = "应用版本格式错误";
  else if (draft.maxAppVersion.trim() && !/^\d+\.\d+\.\d+$/.test(draft.maxAppVersion.trim())) errors.maxAppVersion = "应用版本格式错误";
  else if (draft.maxAppVersion.trim() && compareVersions(draft.maxAppVersion, draft.appVersion) <= 0) errors.maxAppVersion = "最大版本必须大于最小版本";
  if (draft.size === "自定义" && !draft.customSize.trim()) errors.customSize = "请输入自定义尺寸";
  if (!Number.isFinite(draft.floor) || draft.floor <= 0) errors.floor = "底价必须大于 0";
  return errors;
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function normalizePidRecords(records: (PidRecord | (Omit<PidRecord, "appVersion"> & { appVersion?: string; minSdkVersion?: string }))[]): PidRecord[] {
  return records.map((record) => ({ ...record, appVersion: record.appVersion ?? ("minSdkVersion" in record ? record.minSdkVersion : "") ?? "", maxAppVersion: record.maxAppVersion ?? "", size: record.size ?? "全尺寸", customSize: record.customSize ?? "", floor: record.floor ?? 0.3 }));
}

export function filterPidRecords(records: PidRecord[], filters: PidFilters): PidRecord[] {
  return records.filter((record) => (
    (filters.showAll || record.enabled)
    && (!filters.scene || record.scene === filters.scene)
    && (!filters.platform || record.platform === filters.platform)
    && (!filters.adSlot || record.adSlot === filters.adSlot)
    && (!filters.pid.trim() || record.pid.toLocaleLowerCase().includes(filters.pid.trim().toLocaleLowerCase()))
    && (!filters.dspSources.length || filters.dspSources.includes(record.dspSource))
    && (!filters.groupIds.length || record.groupIds.some((groupId) => filters.groupIds.includes(String(groupId))))
  ));
}
