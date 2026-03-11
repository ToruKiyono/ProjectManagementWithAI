export type DiffResult<T> = {
  added: Array<{ id: string; now?: T }>;
  removed: Array<{ id: string; old?: T }>;
  changed: Array<{ id: string; fields: string[]; old: T; now: T }>;
};

export function compareLists<T extends { id: string }>(previous: T[], current: T[]): DiffResult<T> {
  const previousMap = new Map(previous.map((item) => [item.id, item]));
  const currentMap = new Map(current.map((item) => [item.id, item]));
  const added: DiffResult<T>["added"] = [];
  const removed: DiffResult<T>["removed"] = [];
  const changed: DiffResult<T>["changed"] = [];

  currentMap.forEach((now, id) => {
    const old = previousMap.get(id);
    if (!old) {
      added.push({ id, now });
      return;
    }
    const fields = Object.keys(now).filter((key) => JSON.stringify((old as Record<string, unknown>)[key]) !== JSON.stringify((now as Record<string, unknown>)[key]));
    if (fields.length) changed.push({ id, fields, old, now });
  });

  previousMap.forEach((old, id) => {
    if (!currentMap.has(id)) removed.push({ id, old });
  });

  return { added, removed, changed };
}
