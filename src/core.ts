import type { DesktopConfig, DesktopFolder, DesktopItem, ItemSize, LayoutItem, Position, ValidationResult, JsonValue } from './types';

const MAX_GRID = 24, MAX_COORD = 1000, MAX_ITEMS = 300, MAX_CHILDREN = 100;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function getItemSize(item: DesktopItem): ItemSize {
  const fallback = item.type === 'link' ? { width: 1, height: 1 } : { width: 2, height: 2 };
  const s = item.size;
  if (s && finite(s.width) && finite(s.height) && s.width > 0 && s.height > 0) {
    return { width: Math.min(MAX_GRID, s.width), height: Math.min(MAX_GRID, s.height) };
  }
  return fallback;
}

const rectsOverlap = (a: Position & ItemSize, b: Position & ItemSize) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function boundedSize(item: DesktopItem, columns: number, grid: boolean): ItemSize {
  const s = getItemSize(item);
  return { width: Math.max(1, Math.min(columns, grid ? Math.round(s.width) : s.width)), height: Math.max(1, Math.min(MAX_GRID, grid ? Math.round(s.height) : s.height)) };
}

const columnCount = (columns: number) => finite(columns) ? Math.max(1, Math.min(MAX_GRID, Math.floor(columns))) : 12;
function normalizedPosition(position: Position, size: ItemSize, columns: number, grid: boolean): Position {
  return {
    x: Math.max(0, Math.min(columns - size.width, grid ? Math.round(position.x) : position.x)),
    y: Math.max(0, Math.min(MAX_COORD, grid ? Math.round(position.y) : position.y)),
  };
}

function freePosition(size: ItemSize, occupied: Array<Position & ItemSize>, columns: number): Position {
  // A first-fit integer row can only begin at zero or immediately below an obstacle.
  // This skips empty rows and keeps huge requested coordinates from expanding a scan.
  const rows = [...new Set([0, ...occupied.map(o => Math.ceil(o.y + o.height))])].sort((a, b) => a - b);
  for (const y of rows) for (let x = 0; x <= columns - size.width; x++) {
    const p = { x, y };
    if (!occupied.some(o => rectsOverlap({ ...p, ...size }, o))) return p;
  }
  return { x: 0, y: Math.max(0, ...occupied.map(o => Math.ceil(o.y + o.height))) };
}

export function resolveLayout(items: DesktopItem[], columns = 12, mode: 'grid' | 'free' = 'grid'): LayoutItem[] {
  const cols = columnCount(columns);
  const grid = mode !== 'free';
  const occupied: Array<Position & ItemSize> = [];
  const result: LayoutItem[] = items.map(item => ({ item, size: boundedSize(item, cols, grid), position: { x: 0, y: 0 } }));
  const placed = new Set<LayoutItem>();
  const commit = (entry: LayoutItem, position: Position) => {
    entry.position = position; placed.add(entry); occupied.push({ ...position, ...entry.size });
  };
  // Reserve existing valid positions before unpositioned/displaced items get a slot.
  for (const clamped of [false, true]) for (const entry of result) {
    const p = entry.item.position;
    if (placed.has(entry) || !p || !finite(p.x) || !finite(p.y)) continue;
    const inBounds = p.x >= 0 && p.y >= 0 && p.x + entry.size.width <= cols && p.y <= MAX_COORD;
    if (inBounds === clamped) continue;
    const position = normalizedPosition(p, entry.size, cols, grid);
    if (!occupied.some(o => rectsOverlap({ ...position, ...entry.size }, o))) commit(entry, position);
  }
  for (const entry of result) if (!placed.has(entry)) commit(entry, freePosition(entry.size, occupied, cols));
  return result;
}

function withPositions(config: DesktopConfig, idsFirst?: string, columns?: number): DesktopConfig {
  const mode = config.settings?.layout ?? 'grid';
  const cols = columns ?? config.settings?.columns ?? 12;
  const next = clone(config);
  const items = idsFirst ? [...next.items].sort((a, b) => a.id === idsFirst ? -1 : b.id === idsFirst ? 1 : 0) : next.items;
  const priority = items.find(i => i.id === idsFirst);
  if (priority?.position) priority.position = normalizedPosition(priority.position, boundedSize(priority, columnCount(cols), mode === 'grid'), columnCount(cols), mode === 'grid');
  const layouts = resolveLayout(items, cols, mode);
  const pos = new Map(layouts.map(l => [l.item.id, l.position]));
  return { ...next, items: next.items.map(i => ({ ...i, position: pos.get(i.id) })) };
}

export function moveItem(config: DesktopConfig, id: string, position: Position, columns?: number): DesktopConfig {
  const idx = config.items.findIndex(i => i.id === id);
  if (idx < 0 || !position || !finite(position.x) || !finite(position.y)) return clone(config);
  const next = clone(config);
  next.items[idx].position = { x: position.x, y: position.y };
  return withPositions(next, id, columns);
}

export function mergeItems(config: DesktopConfig, sourceId: string, targetId: string, columns?: number): DesktopConfig {
  const next = clone(config);
  const source = next.items.find(i => i.id === sourceId);
  const target = next.items.find(i => i.id === targetId);
  if (!source || !target || source === target || source.type !== 'link' || (target.type !== 'link' && target.type !== 'folder')) return next;
  if (target.type === 'folder') {
    if (target.children.length >= MAX_CHILDREN || target.children.some(c => c.id === source.id)) return next;
    delete source.position;
    target.children.push(source);
    next.items = next.items.filter(i => i.id !== sourceId);
    return next;
  }
  const used = new Set(next.items.flatMap(i => i.type === 'folder' ? [i.id, ...i.children.map(c => c.id)] : [i.id]));
  const baseId = `${target.id.slice(0, 180)}-folder`;
  let folderId = baseId, n = 2;
  while (used.has(folderId)) folderId = `${baseId}-${n++}`;
  const targetPosition = resolveLayout(next.items, columns ?? config.settings?.columns, config.settings?.layout).find(e => e.item.id === target.id)!.position;
  const folder: DesktopFolder = { id: folderId, title: target.title, type: 'folder', position: targetPosition, size: { width: 2, height: 2 }, children: [target, source] };
  delete source.position;
  delete target.position;
  const targetIndex = next.items.findIndex(i => i.id === targetId);
  next.items = next.items.filter(i => i.id !== sourceId && i.id !== targetId);
  next.items.splice(Math.max(0, Math.min(targetIndex, next.items.length)), 0, folder);
  return withPositions(next, folder.id, columns);
}

export function removeItem(config: DesktopConfig, id: string): DesktopConfig {
  const next = clone(config);
  next.items = next.items.filter(i => i.id !== id);
  for (const item of next.items) if (item.type === 'folder') item.children = item.children.filter(c => c.id !== id);
  next.items = next.items.filter(i => i.type !== 'folder' || i.children.length > 0);
  return next;
}

export function extractFromFolder(config: DesktopConfig, folderId: string, childId: string, columns?: number): DesktopConfig {
  const next = clone(config);
  const folder = next.items.find(i => i.id === folderId && i.type === 'folder') as DesktopFolder | undefined;
  if (!folder) return next;
  const idx = folder.children.findIndex(c => c.id === childId);
  if (idx < 0) return next;
  if (next.items.some(i => i.id === childId) || (next.items.length >= MAX_ITEMS && folder.children.length > 1)) return next;
  const child = folder.children.splice(idx, 1)[0];
  delete child.position;
  next.items = next.items.filter(i => i.id !== folderId || (i.type === 'folder' && i.children.length > 0));
  next.items.push(child);
  return withPositions(next, undefined, columns);
}

export function autoArrange(config: DesktopConfig, columns?: number): DesktopConfig {
  const next = clone(config);
  next.items = next.items.map(i => { delete i.position; return i; });
  const layout = resolveLayout(next.items, columns ?? config.settings?.columns, 'grid');
  return { ...next, items: layout.map(l => ({ ...l.item, position: l.position })) };
}

export function isSafeUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2048 || !/^https?:\/\//i.test(url) || url.trim() !== url || /[\u0000-\u001f\u007f]/.test(url) || url.includes('\\')) return false;
  try { const u = new URL(url); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname && !u.username && !u.password; } catch { return false; }
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function validJson(v: unknown, state: { nodes: number; characters: number }, depth = 0, ancestors = new Set<object>()): v is JsonValue {
  if (++state.nodes > 20000 || depth > 20) return false;
  if (typeof v === 'string') { state.characters += v.length; return state.characters <= 1_000_000; }
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (!Array.isArray(v) && !record(v)) return false;
  if (Array.isArray(v) && v.length > 1000) return false;
  if (ancestors.has(v)) return false;
  ancestors.add(v);
  const keys = Object.keys(v);
  const valid = (Array.isArray(v) ? keys.length === v.length : keys.length <= 100) && keys.every(k => k.length <= 200 && validJson((v as Record<string, unknown>)[k], state, depth + 1, ancestors));
  ancestors.delete(v);
  return valid;
}

export function validateConfig(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!record(input)) return { valid: false, errors: ['config must be an object'] };
  const c = input as Record<string, unknown>;
  const allowedTop = new Set(['version', 'name', 'items', 'settings']);
  for (const k of Object.keys(c)) if (!allowedTop.has(k)) errors.push(`unknown field ${k}`);
  if (c.version !== 1) errors.push('version must be 1');
  if (c.name !== undefined && (typeof c.name !== 'string' || c.name.length > 500)) errors.push('name invalid');
  if (!Array.isArray(c.items)) errors.push('items must be an array');
  else if (c.items.length > MAX_ITEMS) return { valid: false, errors: [`items exceeds ${MAX_ITEMS}`] };
  const ids = new Set<string>();
  const jsonBudget = { nodes: 0, characters: 0 };
  const checkBase = (it: any, path: string) => {
    if (!record(it)) { errors.push(`${path} must be an object`); return false; }
    const allowed = new Set(['id', 'title', 'position', 'size', 'type', 'url', 'icon', 'color', 'children', 'widget', 'props']);
    for (const k of Object.keys(it)) if (!allowed.has(k)) errors.push(`${path}.${k} unknown`);
    if (typeof it.id !== 'string' || !it.id || it.id.length > 200) errors.push(`${path}.id invalid`); else if (ids.has(it.id)) errors.push(`duplicate id ${it.id}`); else ids.add(it.id);
    if (typeof it.title !== 'string' || it.title.length > 500) errors.push(`${path}.title invalid`);
    if (it.icon !== undefined && (typeof it.icon !== 'string' || it.icon.length > 4096)) errors.push(`${path}.icon invalid`);
    if (it.color !== undefined && (typeof it.color !== 'string' || it.color.length > 100)) errors.push(`${path}.color invalid`);
    if (it.position !== undefined && (!record(it.position) || Object.keys(it.position).some(k => k !== 'x' && k !== 'y') || !finite(it.position.x) || !finite(it.position.y) || it.position.x < 0 || it.position.y < 0 || it.position.x > MAX_COORD || it.position.y > MAX_COORD)) errors.push(`${path}.position invalid`);
    if (it.size !== undefined && (!record(it.size) || Object.keys(it.size).some(k => k !== 'width' && k !== 'height') || !finite(it.size.width) || !finite(it.size.height) || it.size.width < 1 || it.size.height < 1 || it.size.width > MAX_GRID || it.size.height > MAX_GRID)) errors.push(`${path}.size invalid`);
    return true;
  };
  if (Array.isArray(c.items)) Array.from(c.items).forEach((it: any, i) => {
    const p = `items[${i}]`; if (!checkBase(it, p)) return;
    if (!['link', 'folder', 'widget'].includes(it.type)) { errors.push(`${p}.type invalid`); return; }
    if (it.type === 'link') {
      if (!isSafeUrl(it.url)) errors.push(`${p}.url invalid`);
      for (const k of ['children', 'widget', 'props']) if (it[k] !== undefined) errors.push(`${p}.${k} not allowed`);
    }
    if (it.type === 'folder') {
      for (const k of ['url', 'widget', 'props', 'icon', 'color']) if (it[k] !== undefined) errors.push(`${p}.${k} not allowed`);
      if (!Array.isArray(it.children) || it.children.length > MAX_CHILDREN) { errors.push(`${p}.children invalid`); return; }
      Array.from(it.children).forEach((ch: any, j: number) => {
        const cp = `${p}.children[${j}]`;
        if (!checkBase(ch, cp)) return;
        if (ch.type !== 'link') errors.push(`${cp} must be link`);
        else if (!isSafeUrl(ch.url)) errors.push(`${cp}.url invalid`);
        for (const k of ['children', 'widget', 'props']) if (ch[k] !== undefined) errors.push(`${cp}.${k} not allowed`);
      });
    }
    if (it.type === 'widget') {
      if (typeof it.widget !== 'string' || !it.widget || it.widget.length > 200) errors.push(`${p}.widget invalid`);
      for (const k of ['url', 'children', 'icon', 'color']) if (it[k] !== undefined) errors.push(`${p}.${k} not allowed`);
    }
    if (it.type === 'widget' && it.props !== undefined && (!record(it.props) || !validJson(it.props, jsonBudget))) errors.push(`${p}.props invalid`);
  });
  if (c.settings !== undefined) {
    const s: any = c.settings;
    if (!record(s)) errors.push('settings invalid'); else {
      const allowedSettings = new Set(['layout', 'columns', 'rowHeight', 'gap', 'wallpaper']);
      for (const k of Object.keys(s)) if (!allowedSettings.has(k)) errors.push(`settings.${k} unknown`);
      if (s.layout !== undefined && s.layout !== 'grid' && s.layout !== 'free') errors.push('settings.layout invalid');
      if (s.columns !== undefined && (!finite(s.columns) || !Number.isInteger(s.columns) || s.columns < 1 || s.columns > MAX_GRID)) errors.push('settings.columns invalid');
      if (s.rowHeight !== undefined && (!finite(s.rowHeight) || s.rowHeight < 80 || s.rowHeight > 240)) errors.push('settings.rowHeight invalid');
      if (s.gap !== undefined && (!finite(s.gap) || s.gap < 0 || s.gap > 32)) errors.push('settings.gap invalid');
      if (s.wallpaper !== undefined && (typeof s.wallpaper !== 'string' || !['linen', 'sage', 'dusk'].includes(s.wallpaper))) errors.push('settings.wallpaper invalid');
    }
  }
  if (errors.length) return { valid: false, errors };
  return { valid: true, errors: [], config: clone(input as unknown as DesktopConfig) };
}
