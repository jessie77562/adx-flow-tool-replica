export type BatchOperation = "disable" | "enable" | "price";

export const BATCH_PRICE_MAX = 9999;

type BatchItem = {
  id: number;
  enabled: boolean;
  floor: number;
};

export function validateBatchPrice(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return "请输入价格";
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) return "请输入有效的价格";

  const price = Number(value);
  if (price <= 0) return "价格必须大于 0";
  if (price > BATCH_PRICE_MAX) return "超出价格上限";
  return null;
}

export function eligibleBatchItems<T extends BatchItem>(items: T[], operation: BatchOperation): T[] {
  if (operation === "disable") return items.filter((item) => item.enabled);
  if (operation === "enable") return items.filter((item) => !item.enabled);
  return items;
}

export function applyBatchOperation<T extends BatchItem>(
  items: T[],
  selectedIds: number[],
  operation: BatchOperation,
  price?: number,
): T[] {
  const selected = new Set(selectedIds);

  return items.map((item) => {
    if (!selected.has(item.id)) return item;
    if (operation === "disable" && item.enabled) return { ...item, enabled: false };
    if (operation === "enable" && !item.enabled) return { ...item, enabled: true };
    if (operation === "price" && price !== undefined) return { ...item, floor: price };
    return item;
  });
}
