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
  const highest = [...groups]
    .filter((group) => group.enabled || group.isDefault)
    .sort((a, b) => b.priority - a.priority)[0];
  return highest?.id ?? null;
}

export function reorderGroupPriority<T extends ManagedGroup>(
  groups: T[],
  scopeIds: number[],
  draggedId: number,
  targetId: number,
): T[] {
  const scopedGroups = scopeIds.map((id) => groups.find((group) => group.id === id)).filter((group): group is T => Boolean(group));
  const dragged = scopedGroups.find((group) => group.id === draggedId);
  if (!dragged || dragged.isDefault || draggedId === targetId) return ensureDefaultGroupsEnabled(groups);

  const orderedIds = scopedGroups.map((group) => group.id);
  const sourceIndex = orderedIds.indexOf(draggedId);
  const targetIndex = orderedIds.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return ensureDefaultGroupsEnabled(groups);

  orderedIds.splice(sourceIndex, 1);
  orderedIds.splice(targetIndex, 0, draggedId);

  const defaultIds = new Set(scopedGroups.filter((group) => group.isDefault).map((group) => group.id));
  const normalizedIds = [...orderedIds.filter((id) => !defaultIds.has(id)), ...orderedIds.filter((id) => defaultIds.has(id))];
  const priorities = new Map(normalizedIds.map((id, index) => [id, normalizedIds.length - index]));
  const updatedById = new Map(groups.map((group) => [group.id, priorities.has(group.id) ? { ...group, priority: priorities.get(group.id)! } : group]));
  let scopedIndex = 0;

  const reordered = groups.map((group) => {
    if (!priorities.has(group.id)) return updatedById.get(group.id)!;
    const nextId = normalizedIds[scopedIndex++];
    return updatedById.get(nextId)!;
  });

  return ensureDefaultGroupsEnabled(reordered);
}
