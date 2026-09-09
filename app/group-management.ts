type ManagedGroup = {
  id: number;
  priority: number;
  enabled: boolean;
  isDefault?: boolean;
};

export function ensureDefaultGroupsEnabled<T extends ManagedGroup>(groups: T[]): T[] {
  return groups.map((group) => group.isDefault && !group.enabled ? { ...group, enabled: true } : group);
}

export function setManagedGroupsEnabled<T extends ManagedGroup>(groups: T[], selectedIds: number[], enabled: boolean): T[] {
  const selected = new Set(selectedIds);
  return groups.map((group) => {
    if (group.isDefault) return group.enabled ? group : { ...group, enabled: true };
    return selected.has(group.id) ? { ...group, enabled } : group;
  });
}

export function highestEffectiveGroupId<T extends ManagedGroup>(groups: T[]): number | null {
  const highest = sortGroupsByPriority(groups.filter((group) => group.enabled || group.isDefault))[0];
  return highest?.id ?? null;
}

export function sortGroupsByPriority<T extends ManagedGroup>(groups: T[]): T[] {
  return [...groups].sort((a, b) => b.priority - a.priority || a.id - b.id);
}

export function validateGroupPriorities<T extends ManagedGroup>(groups: T[]): string {
  if (groups.some((group) => !Number.isInteger(group.priority) || group.priority <= 0)) return "优先级必须为大于 0 的整数";
  if (new Set(groups.map((group) => group.priority)).size !== groups.length) return "优先级数值不可重复，请重新设置";
  return "";
}
