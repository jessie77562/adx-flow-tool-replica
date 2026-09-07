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
  minSdkVersion: string;
  maxSdkVersion: string;
};

export type PidFilters = {
  scene: string;
  platform: string;
  adSlot: string;
  dspSources: string[];
  sdkVersionOperator: "gte" | "lte" | "gt" | "lt" | "contains";
  sdkVersion: string;
  groupIds: string[];
  showAll: boolean;
};

export type PidDraft = Omit<PidRecord, "id" | "groupIds" | "platform"> & { platform: PidPlatform | "" };

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

function versionParts(version: string): number[] {
  const parts = version.split(".").map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function compareSdkVersions(left: string, right: string): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

export function validatePidDraft(draft: PidDraft, records: PidRecord[], editingId: number | null): PidDraftErrors {
  const errors: PidDraftErrors = {};
  if (!draft.dspSource) errors.dspSource = "请选择 DSP 来源";
  if (!draft.scene) errors.scene = "请选择广告场景";
  if (!draft.platform) errors.platform = "请选择平台";
  if (!draft.adSlot) errors.adSlot = "请选择广告位";
  if (!draft.pid.trim()) errors.pid = "请输入 PID";
  else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(draft.pid.trim())) errors.pid = "PID 格式错误";
  else if (records.some((record) => record.id !== editingId && record.pid.toLowerCase() === draft.pid.trim().toLowerCase())) errors.pid = "该 PID 已存在，请重新输入";

  if (!/^\d+\.\d+\.\d+$/.test(draft.minSdkVersion.trim())) errors.minSdkVersion = "版本输入格式错误";
  if (draft.maxSdkVersion.trim() && !/^\d+\.\d+\.\d+$/.test(draft.maxSdkVersion.trim())) errors.maxSdkVersion = "版本输入格式错误";
  else if (draft.maxSdkVersion.trim() && !errors.minSdkVersion && compareSdkVersions(draft.maxSdkVersion.trim(), draft.minSdkVersion.trim()) <= 0) errors.maxSdkVersion = "最大版本必须大于最小版本";
  return errors;
}

export function filterPidRecords(records: PidRecord[], filters: PidFilters): PidRecord[] {
  return records.filter((record) => (
    (filters.showAll || record.enabled)
    && (!filters.scene || record.scene === filters.scene)
    && (!filters.platform || record.platform === filters.platform)
    && (!filters.adSlot || record.adSlot === filters.adSlot)
    && (!filters.dspSources.length || filters.dspSources.includes(record.dspSource))
    && (!filters.groupIds.length || record.groupIds.some((groupId) => filters.groupIds.includes(String(groupId))))
    && matchesSdkVersion(record, filters)
  ));
}

function matchesSdkVersion(record: PidRecord, filters: PidFilters): boolean {
  const target = filters.sdkVersion.trim();
  if (!target) return true;
  if (filters.sdkVersionOperator === "contains") {
    return `${record.minSdkVersion}${record.maxSdkVersion ? ` ～ ${record.maxSdkVersion}` : " 以上"}`.includes(target);
  }
  if (!/^\d+(?:\.\d+){0,2}$/.test(target)) return false;
  const comparison = compareSdkVersions(record.minSdkVersion, target);
  if (filters.sdkVersionOperator === "gte") return comparison >= 0;
  if (filters.sdkVersionOperator === "lte") return comparison <= 0;
  if (filters.sdkVersionOperator === "gt") return comparison > 0;
  return comparison < 0;
}
