export type ReportMetricKey = "revenuePerThousandUsers" | "revenue" | "ecpm" | "requests" | "impressions" | "clicks" | "ctr" | "bidSuccessRate" | "winImpressionRate" | "cpc";
export type ReportSortOrder = "asc" | "desc";

export type ReportFilters = {
  startDate: string;
  endDate: string;
  scene: string;
  platform: string;
  group: string;
  app: string;
  abGroup: string;
  adSources: string[];
  versionOperator: string;
  appVersion: string;
};

export type ReportRow = {
  date: string;
  users: number;
  revenue: number;
  requests: number;
  returns: number;
  bidWins: number;
  impressions: number;
  clicks: number;
  effectRequestUsers: number;
  revenuePerThousandUsers: number;
  ecpm: number;
  requestValue: number;
  returnRate: number;
  bidSuccessRate: number;
  winImpressionRate: number;
  ctr: number;
  cpc: number;
  effectRevenuePerThousandUsers: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultReportDateRange(reference = new Date()): Pick<ReportFilters, "startDate" | "endDate"> {
  const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
}

export function inclusiveDateSpan(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function validateReportDateRange(startDate: string, endDate: string, maxDays = 90): string {
  if (!startDate || !endDate) return "请选择日期范围";
  const days = inclusiveDateSpan(startDate, endDate);
  if (days <= 0) return "结束日期不能早于开始日期";
  if (days > maxDays) return `时间范围不能超过 ${maxDays} 天`;
  return "";
}

function stringHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function filterMultiplier(filters: ReportFilters): number {
  let multiplier = 1;
  if (filters.scene) multiplier *= 0.72;
  if (filters.platform) multiplier *= 0.61;
  if (filters.group) multiplier *= 0.48;
  if (filters.abGroup) multiplier *= 0.52;
  if (filters.adSources.length) multiplier *= Math.min(0.37 * filters.adSources.length, 0.9);
  if (filters.appVersion.trim()) multiplier *= 0.68;
  return multiplier;
}

function withDerivedMetrics(raw: Omit<ReportRow, "revenuePerThousandUsers" | "ecpm" | "requestValue" | "returnRate" | "bidSuccessRate" | "winImpressionRate" | "ctr" | "cpc" | "effectRevenuePerThousandUsers">): ReportRow {
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
    effectRevenuePerThousandUsers: raw.effectRequestUsers ? raw.revenue / raw.effectRequestUsers * 1000 : 0,
  };
}

export function generateDailyReport(filters: ReportFilters): ReportRow[] {
  const days = inclusiveDateSpan(filters.startDate, filters.endDate);
  if (days <= 0 || days > 90) return [];
  const multiplier = filterMultiplier(filters);
  const start = parseDate(filters.startDate);

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const date = formatDateInput(current);
    const selectedSources = filters.adSources.slice().sort().join("|");
    const seed = stringHash(`${date}-${filters.scene}-${filters.platform}-${filters.group}-${selectedSources}-${filters.appVersion}`);
    const wave = 0.9 + (seed % 210) / 1000;
    const weekdayFactor = [0.91, 0.97, 1.01, 1.03, 1.06, 1.09, 0.95][current.getDay()];
    const scale = multiplier * wave * weekdayFactor;
    const users = Math.max(1, Math.round(2_180_000 * scale));
    const requests = Math.max(1, Math.round(4_735_087 * scale));
    const returnRate = 0.77 + (seed % 90) / 1000;
    const returns = Math.round(requests * returnRate);
    const bidWins = Math.round(returns * (0.57 + (seed % 80) / 1000));
    const impressions = Math.round(bidWins * (0.58 + (seed % 70) / 1000));
    const clicks = Math.max(1, Math.round(impressions * (0.0032 + (seed % 18) / 10000)));
    const effectRequestUsers = Math.max(1, Math.round(users * (0.76 + (seed % 120) / 1000)));
    const revenue = Math.round((315_000 * scale * (0.94 + (seed % 130) / 1000)) * 100) / 100;
    return withDerivedMetrics({ date, users, revenue, requests, returns, bidWins, impressions, clicks, effectRequestUsers });
  });
}

export function summarizeReport(rows: ReportRow[]): ReportRow | null {
  if (!rows.length) return null;
  const totals = rows.reduce((sum, row) => ({
    users: sum.users + row.users,
    revenue: sum.revenue + row.revenue,
    requests: sum.requests + row.requests,
    returns: sum.returns + row.returns,
    bidWins: sum.bidWins + row.bidWins,
    impressions: sum.impressions + row.impressions,
    clicks: sum.clicks + row.clicks,
    effectRequestUsers: sum.effectRequestUsers + row.effectRequestUsers,
  }), { users: 0, revenue: 0, requests: 0, returns: 0, bidWins: 0, impressions: 0, clicks: 0, effectRequestUsers: 0 });
  return withDerivedMetrics({ date: "总计", ...totals });
}

export function sortReportRowsByDate(rows: ReportRow[], order: ReportSortOrder): ReportRow[] {
  return [...rows].sort((left, right) => order === "asc" ? left.date.localeCompare(right.date) : right.date.localeCompare(left.date));
}

export function getMetricValue(row: ReportRow, metric: ReportMetricKey): number {
  return row[metric];
}
