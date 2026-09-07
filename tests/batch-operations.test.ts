import assert from "node:assert/strict";
import test from "node:test";
import { applyBatchOperation, eligibleBatchItems, validateBatchPrice } from "../app/batch-operations.ts";

const items = [
  { id: 1, enabled: true, floor: 0.3 },
  { id: 2, enabled: false, floor: 0.5 },
  { id: 3, enabled: true, floor: 0.8 },
];

test("validates batch prices", () => {
  assert.equal(validateBatchPrice(""), "请输入价格");
  assert.equal(validateBatchPrice("abc"), "请输入有效的价格");
  assert.equal(validateBatchPrice("-1"), "请输入有效的价格");
  assert.equal(validateBatchPrice("0"), "价格必须大于 0");
  assert.equal(validateBatchPrice("0.00"), "价格必须大于 0");
  assert.equal(validateBatchPrice("10000"), "超出价格上限");
  assert.equal(validateBatchPrice("0.01"), null);
  assert.equal(validateBatchPrice("12.345"), null);
  assert.equal(validateBatchPrice("9999.00"), null);
});

test("filters status-specific batch operations", () => {
  assert.deepEqual(eligibleBatchItems(items, "disable").map((item) => item.id), [1, 3]);
  assert.deepEqual(eligibleBatchItems(items, "enable").map((item) => item.id), [2]);
  assert.deepEqual(eligibleBatchItems(items, "price").map((item) => item.id), [1, 2, 3]);
});

test("applies enable, disable and price changes only to eligible selected rows", () => {
  const disabled = applyBatchOperation(items, [1, 2], "disable");
  assert.equal(disabled[0].enabled, false);
  assert.equal(disabled[1].enabled, false);

  const enabled = applyBatchOperation(items, [1, 2], "enable");
  assert.equal(enabled[0].enabled, true);
  assert.equal(enabled[1].enabled, true);

  const repriced = applyBatchOperation(items, [1, 2], "price", 8.88);
  assert.equal(repriced[0].floor, 8.88);
  assert.equal(repriced[1].floor, 8.88);
  assert.equal(repriced[2].floor, 0.8);
});
