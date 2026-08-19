export type BatchOperation = "disable" | "enable" | "price";

type BatchItem = {
  id: number;
  enabled: boolean;
  floor: number;
};

export function validateBatchPrice(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return "请输入价格";
  if (!/^-?\d+(\.\d+)?$/.test(value)) return "请输入有效价格";

  const price = Number(value);
  if (price < 0 || price > 9999) return "价格应在 0–9999 元之间";
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return "价格最多保留两位小数";
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
