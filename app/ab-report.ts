export type AbExperimentSource = {
  id: number;
  name: string;
  enabled: boolean;
  ab: boolean;
  isDefault?: boolean;
};

export type AbExperiment = AbExperimentSource & {
  optionLabel: string;
  testName: string;
  startAt: string;
  endAt: string;
  status: "ongoing" | "ended";
  effect: number;
};

export type AbMetricKey = "revenuePerThousandUsers" | "revenue" | "ecpm" | "requestValue" | "requests" | "returnRate" | "bidWins" | "bidSuccessRate" | "impressions" | "winImpressionRate" | "clicks" | "ctr" | "cpc";

export type AbGroupMetrics = {
  users: number;
  revenue: number;
  requests: number;
  returns: number;
  bidWins: number;
  impressions: number;
  clicks: number;
  revenuePerThousandUsers: number;
  ecpm: number;
  requestValue: number;
  returnRate: number;
  bidSuccessRate: number;
  winImpressionRate: number;
  ctr: number;
  cpc: number;
};

export type AbDailyRow = { date: string; a: AbGroupMetrics; b: AbGroupMetrics };
export type AbTrafficLog = { date: string; aTraffic: number; bTraffic: number };

export const AB_EXPERIMENTS: AbExperiment[] = [
  { id: 1001, name: "默认分组", optionLabel: "默认分组", testName: "瀑布流广告位 eCPM 优化测试", startAt: "2026-08-21T11:24:43", endAt: "2026-09-18T10:40:22", status: "ongoing", enabled: true, ab: true, effect: 0.0986 },
  { id: 1002, name: "高价值用户组", optionLabel: "高价值用户组", testName: "高价值用户竞价策略测试", startAt: "2026-08-25T09:30:00", endAt: "2026-09-20T23:59:59", status: "ongoing", enabled: true, ab: true, effect: 0.0642 },
  { id: 1003, name: "新用户组", optionLabel: "新用户组", testName: "新用户广告加载策略测试", startAt: "2026-09-01T00:00:00", endAt: "2026-09-28T23:59:59", status: "ongoing", enabled: true, ab: true, effect: -0.0318 },
  { id: 1005, name: "回流用户组", optionLabel: "回流用户组", testName: "回流用户广告频控测试", startAt: "2026-09-02T08:30:00", endAt: "2026-09-30T23:59:59", status: "ongoing", enabled: true, ab: true, effect: 0.0436 },
  { id: 1006, name: "高活跃用户组", optionLabel: "高活跃用户组", testName: "高活跃用户底价策略测试", startAt: "2026-09-05T10:00:00", endAt: "2026-10-03T23:59:59", status: "ongoing", enabled: true, ab: true, effect: 0.0721 },
  { id: 1004, name: "历史实验", optionLabel: "历史实验", testName: "历史瀑布流策略测试", startAt: "2026-01-22T11:24:43", endAt: "2026-02-02T10:40:22", status: "ended", enabled: false, ab: true, effect: 0.021 },
];

export function filterAbExperimentsByKeyword<T extends Pick<AbExperiment, "optionLabel" | "testName">>(experiments: T[], keyword: string): T[] {
  const normalized = keyword.trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return experiments;
  return experiments.filter((experiment) => `${experiment.optionLabel} ${experiment.testName}`.toLocaleLowerCase("zh-CN").includes(normalized));
}

export function getOngoingAbExperiments<T extends AbExperimentSource>(groups: T[]): T[] {
  return groups.filter((group) => group.ab && group.enabled && !group.isDefault);
}

export function resolveAbExperimentId(experiments: AbExperimentSource[], selectedId: string): string {
  if (experiments.some((experiment) => String(experiment.id) === selectedId)) return selectedId;
  return experiments[0] ? String(experiments[0].id) : "";
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stringHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function withDerivedMetrics(raw: Pick<AbGroupMetrics, "users" | "revenue" | "requests" | "returns" | "bidWins" | "impressions" | "clicks">): AbGroupMetrics {
  return {
    ...raw,
    revenuePerThousandUsers: raw.users ? raw.revenue / raw.users * 1000 : 0,
    ecpm: raw.impressions ? raw.revenue / raw.impressions * 1000 : 0,
    requestValue: raw.requests ? raw.revenue / raw.requests * 1000 : 0,
    returnRate: raw.requests ? raw.returns / raw.requests : 0,
    bidSuccessRate: raw.returns ? raw.bidWins / raw.returns : 0,
    winImpressionRate: raw.bidWins ? raw.impressions / raw.bidWins : 0,
    ctr: raw.impressions ? raw.clicks / raw.impressions : 0,
    cpc: raw.clicks ? raw.revenue / raw.clicks : 0,
  };
}

function makeGroupMetrics(seed: number, volumeScale: number, performanceScale: number): AbGroupMetrics {
  const users = Math.max(1, Math.round(430_000 * volumeScale));
  const requests = Math.max(1, Math.round(920_000 * volumeScale));
  const returns = Math.round(requests * (0.76 + seed % 90 / 1000));
  const bidWins = Math.round(returns * (0.55 + seed % 85 / 1000));
  const impressions = Math.round(bidWins * (0.58 + seed % 70 / 1000));
  const clicks = Math.max(1, Math.round(impressions * (0.0033 + seed % 17 / 10000)));
  const revenue = Math.round(56_000 * volumeScale * performanceScale * 100) / 100;
  return withDerivedMetrics({ users, revenue, requests, returns, bidWins, impressions, clicks });
}

export function experimentDateBounds(experiment: AbExperiment): { startDate: string; endDate: string } {
  return { startDate: experiment.startAt.slice(0, 10), endDate: experiment.endAt.slice(0, 10) };
}

export function defaultAbDateRange(experiment: AbExperiment, reference = new Date()): { startDate: string; endDate: string } {
  const bounds = experimentDateBounds(experiment);
  const cycleStart = parseDate(bounds.startDate);
  const cycleEnd = parseDate(bounds.endDate);
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const end = referenceDay < cycleStart ? cycleStart : referenceDay > cycleEnd ? cycleEnd : referenceDay;
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  if (start < cycleStart) start.setTime(cycleStart.getTime());
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

export function validateAbDateRange(startDate: string, endDate: string, experiment: AbExperiment): string {
  if (!startDate || !endDate) return "请选择日期范围";
  if (endDate < startDate) return "结束日期不能早于开始日期";
  const bounds = experimentDateBounds(experiment);
  if (startDate < bounds.startDate || endDate > bounds.endDate) return "日期范围不可超出实验生效时间";
  return "";
}

export function generateAbDailyRows(experiment: AbExperiment, startDate: string, endDate: string): AbDailyRow[] {
  if (validateAbDateRange(startDate, endDate, experiment)) return [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const date = formatDate(current);
    const seed = stringHash(`${experiment.id}-${date}`);
    const volume = (0.9 + seed % 190 / 1000) * ([0.94, 0.97, 1, 1.02, 1.05, 1.08, 0.96][current.getDay()]);
    const aPerformance = 0.96 + seed % 70 / 1000;
    const bVolume = volume * (0.98 + seed % 45 / 1000);
    const dailyEffect = experiment.effect + (seed % 21 - 10) / 1000;
    return { date, a: makeGroupMetrics(seed, volume, aPerformance), b: makeGroupMetrics(seed + 37, bVolume, aPerformance * (1 + dailyEffect)) };
  });
}

export function validateAbHourlyDate(date: string, experiment: AbExperiment): string {
  if (!date) return "请选择日期";
  const bounds = experimentDateBounds(experiment);
  if (date < bounds.startDate || date > bounds.endDate) return "日期不可超出实验生效时间";
  return "";
}

export function generateAbHourlyRows(experiment: AbExperiment, date: string, reference = new Date()): AbDailyRow[] {
  if (validateAbHourlyDate(date, experiment)) return [];
  const referenceDate = formatDate(reference);
  const lastHour = date === referenceDate ? reference.getHours() : 23;
  return Array.from({ length: lastHour + 1 }, (_, hour) => {
    const time = `${date} ${String(hour).padStart(2, "0")}:00`;
    const seed = stringHash(`${experiment.id}-${time}`);
    const daytimeCurve = 0.62 + Math.sin((hour - 6) / 24 * Math.PI * 2) * 0.24 + hour / 120;
    const volume = Math.max(0.018, 0.042 * daytimeCurve * (0.94 + seed % 120 / 1000));
    const aPerformance = 0.96 + seed % 70 / 1000;
    const dailyEffect = experiment.effect + (seed % 21 - 10) / 1000;
    return { date: time, a: makeGroupMetrics(seed, volume, aPerformance), b: makeGroupMetrics(seed + 37, volume * (0.98 + seed % 45 / 1000), aPerformance * (1 + dailyEffect)) };
  });
}

export function summarizeAbGroup(rows: AbDailyRow[], group: "a" | "b"): AbGroupMetrics | null {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => ({
    users: sum.users + row[group].users,
    revenue: sum.revenue + row[group].revenue,
    requests: sum.requests + row[group].requests,
    returns: sum.returns + row[group].returns,
    bidWins: sum.bidWins + row[group].bidWins,
    impressions: sum.impressions + row[group].impressions,
    clicks: sum.clicks + row[group].clicks,
  }), { users: 0, revenue: 0, requests: 0, returns: 0, bidWins: 0, impressions: 0, clicks: 0 });
  return withDerivedMetrics(total);
}

export function metricLift(a: number, b: number): number | null {
  return a ? (b - a) / a : null;
}

export function generateAbTrafficLogs(experiment: AbExperiment): AbTrafficLog[] {
  const bounds = experimentDateBounds(experiment);
  const start = parseDate(bounds.startDate);
  const end = parseDate(bounds.endDate);
  const ratios = experiment.effect < 0 ? [50, 45, 60, 100] : [50, 40, 30, 20];
  return ratios.map((aTraffic, index) => {
    const date = new Date(start);
    const offset = Math.round((end.getTime() - start.getTime()) / 86_400_000 * index / Math.max(ratios.length - 1, 1));
    date.setDate(date.getDate() + offset);
    return { date: `${formatDate(date)} ${["11:24:43", "09:30:18", "16:05:36", "10:40:22"][index]}`, aTraffic, bTraffic: 100 - aTraffic };
  });
}

export function filterAndSortAbTrafficLogs(logs: AbTrafficLog[], startDate: string, endDate: string, order: "asc" | "desc"): AbTrafficLog[] {
  return [...logs]
    .filter((log) => (!startDate || log.date.slice(0, 10) >= startDate) && (!endDate || log.date.slice(0, 10) <= endDate))
    .sort((a, b) => order === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
}
