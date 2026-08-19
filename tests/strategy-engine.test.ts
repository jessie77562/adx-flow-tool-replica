import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExclusiveMatchTrace,
  duplicatePriority,
  selectExclusiveStrategy,
  strategyMatches,
  type MatchContext,
  type MatchableStrategy,
} from "../app/strategy-engine.ts";

const user: MatchContext = {
  identity: "经期",
  city: "北京",
  age: 28,
  appVersion: "9.8.0",
};

const strategies: MatchableStrategy[] = [
  { id: 1, adSlotId: "slot-a", priority: 1000, enabled: true, rules: [{ dimension: "身份", operator: "包含", value: "经期" }] },
  { id: 2, adSlotId: "slot-a", priority: 900, enabled: true, rules: [{ dimension: "城市", operator: "等于", value: "北京" }] },
  { id: 3, adSlotId: "slot-a", priority: 0, enabled: true, rules: [] },
  { id: 4, adSlotId: "slot-b", priority: 2000, enabled: true, rules: [] },
];

test("same ad slot returns only the highest-priority matching strategy", () => {
  const match = selectExclusiveStrategy(strategies, "slot-a", user);
  assert.equal(match?.id, 1);
});

test("evaluation stops immediately after the first match", () => {
  const trace = buildExclusiveMatchTrace(strategies, "slot-a", user);
  assert.deepEqual(trace.map(({ strategy, matched, stopped }) => ({ id: strategy.id, matched, stopped })), [
    { id: 1, matched: true, stopped: true },
  ]);
});

test("strategies from another ad slot never participate", () => {
  const match = selectExclusiveStrategy(strategies, "slot-a", { ...user, identity: "普通用户", city: "广州" });
  assert.equal(match?.id, 3);
  assert.notEqual(match?.id, 4);
});

test("disabled strategies are skipped and the next match wins", () => {
  const match = selectExclusiveStrategy(strategies.map((strategy) => strategy.id === 1 ? { ...strategy, enabled: false } : strategy), "slot-a", user);
  assert.equal(match?.id, 2);
});

test("multiple rules inside one strategy use AND semantics", () => {
  const strategy: MatchableStrategy = { id: 5, adSlotId: "slot-a", priority: 100, enabled: true, rules: [{ dimension: "身份", operator: "包含", value: "经期" }, { dimension: "城市", operator: "等于", value: "上海" }] };
  assert.equal(strategyMatches(strategy, user), false);
});

test("priority uniqueness is scoped to the same ad slot", () => {
  assert.equal(duplicatePriority(strategies, "slot-a", 1000), true);
  assert.equal(duplicatePriority(strategies, "slot-b", 1000), false);
  assert.equal(duplicatePriority(strategies, "slot-a", 1000, 1), false);
});
