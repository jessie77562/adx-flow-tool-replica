export type TargetingRule = {
  dimension: "身份" | "城市" | "年龄" | "应用版本";
  operator: "包含" | "不包含" | "等于" | "大于等于" | "小于等于";
  value: string;
};

export type MatchContext = {
  identity: string;
  city: string;
  age: number;
  appVersion: string;
};

export type MatchableStrategy = {
  id: number;
  adSlotId: string;
  priority: number;
  enabled: boolean;
  rules: TargetingRule[];
};

export type MatchTrace<T extends MatchableStrategy> = {
  strategy: T;
  matched: boolean;
  stopped: boolean;
};

function compareVersions(left: string, right: string) {
  const a = left.split(".").map((part) => Number(part) || 0);
  const b = right.split(".").map((part) => Number(part) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function ruleMatches(rule: TargetingRule, context: MatchContext) {
  const source = rule.dimension === "身份"
    ? context.identity
    : rule.dimension === "城市"
      ? context.city
      : rule.dimension === "年龄"
        ? context.age
        : context.appVersion;

  if (rule.dimension === "年龄") {
    const expected = Number(rule.value);
    if (Number.isNaN(expected)) return false;
    if (rule.operator === "大于等于") return Number(source) >= expected;
    if (rule.operator === "小于等于") return Number(source) <= expected;
    if (rule.operator === "不包含") return Number(source) !== expected;
    return Number(source) === expected;
  }

  if (rule.dimension === "应用版本") {
    const comparison = compareVersions(String(source), rule.value);
    if (rule.operator === "大于等于") return comparison >= 0;
    if (rule.operator === "小于等于") return comparison <= 0;
    if (rule.operator === "不包含") return comparison !== 0;
    return comparison === 0;
  }

  const actual = String(source);
  if (rule.operator === "不包含") return !actual.includes(rule.value);
  if (rule.operator === "等于") return actual === rule.value;
  return actual.includes(rule.value);
}

export function strategyMatches(strategy: MatchableStrategy, context: MatchContext) {
  return strategy.rules.every((rule) => ruleMatches(rule, context));
}

export function selectExclusiveStrategy<T extends MatchableStrategy>(
  strategies: T[],
  adSlotId: string,
  context: MatchContext,
) {
  return strategies
    .filter((strategy) => strategy.enabled && strategy.adSlotId === adSlotId)
    .sort((left, right) => right.priority - left.priority || left.id - right.id)
    .find((strategy) => strategyMatches(strategy, context)) ?? null;
}

export function buildExclusiveMatchTrace<T extends MatchableStrategy>(
  strategies: T[],
  adSlotId: string,
  context: MatchContext,
): MatchTrace<T>[] {
  const ordered = strategies
    .filter((strategy) => strategy.enabled && strategy.adSlotId === adSlotId)
    .sort((left, right) => right.priority - left.priority || left.id - right.id);
  const trace: MatchTrace<T>[] = [];

  for (const strategy of ordered) {
    const matched = strategyMatches(strategy, context);
    trace.push({ strategy, matched, stopped: matched });
    if (matched) break;
  }
  return trace;
}

export function duplicatePriority(
  strategies: MatchableStrategy[],
  adSlotId: string,
  priority: number,
  ignoredId?: number | null,
) {
  return strategies.some((strategy) => strategy.adSlotId === adSlotId && strategy.id !== ignoredId && strategy.priority === priority);
}
