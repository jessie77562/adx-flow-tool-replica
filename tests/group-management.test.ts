import assert from "node:assert/strict";
import test from "node:test";
import { ensureDefaultGroupsEnabled, highestEffectiveGroupId, reorderGroupPriority, setManagedGroupsEnabled } from "../app/group-management.ts";

const groups = [
  { id: 1, priority: 30, enabled: true },
  { id: 2, priority: 20, enabled: false },
  { id: 3, priority: 10, enabled: false, isDefault: true },
  { id: 4, priority: 99, enabled: true },
];

test("default groups are always enabled", () => {
  const result = ensureDefaultGroupsEnabled(groups);
  assert.equal(result[2].enabled, true);
});

test("batch status changes skip default groups", () => {
  const disabled = setManagedGroupsEnabled(groups, [1, 3], false);
  assert.equal(disabled[0].enabled, false);
  assert.equal(disabled[2].enabled, true);

  const enabled = setManagedGroupsEnabled(groups, [2], true);
  assert.equal(enabled[1].enabled, true);
});

test("selects the highest-priority effective group by default", () => {
  assert.equal(highestEffectiveGroupId(groups.slice(0, 3)), 1);
  assert.equal(highestEffectiveGroupId([
    { id: 5, priority: 50, enabled: false },
    { id: 6, priority: 40, enabled: true },
    { id: 7, priority: 30, enabled: true },
  ]), 6);
  assert.equal(highestEffectiveGroupId([{ id: 8, priority: 10, enabled: false }]), null);
});

test("drag sorting recalculates scoped priorities and keeps default last", () => {
  const result = reorderGroupPriority(groups, [1, 2, 3], 2, 1);
  const scoped = result.filter((group) => [1, 2, 3].includes(group.id));
  assert.deepEqual(scoped.map((group) => group.id), [2, 1, 3]);
  assert.equal(scoped[0].priority, 3);
  assert.equal(scoped[2].priority, 1);
  assert.equal(result.find((group) => group.id === 4)?.priority, 99);
});
