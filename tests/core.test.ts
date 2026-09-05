import { describe, expect, it } from 'vitest';
import { autoArrange, extractFromFolder, getItemSize, isSafeUrl, mergeItems, moveItem, removeItem, resolveLayout, validateConfig } from '../src/core';
import type { DesktopConfig, DesktopItem, DesktopFolder, DesktopLink, LayoutItem } from '../src/types';
import { initialConfig } from '../demo/config';

const link = (id: string, x?: number, y?: number): DesktopItem => ({ type: 'link', id, title: id, url: `https://${id}.example`, ...(x === undefined ? {} : { position: { x, y: y! } }) });
const config = (items: DesktopItem[]): DesktopConfig => ({ version: 1, items });
const folder = (id: string, children: DesktopItem[]): DesktopFolder => ({ id, type: 'folder', title: id, children: children as DesktopLink[] });
const collisionFree = (layout: LayoutItem[], columns: number) => {
  for (const [i, a] of layout.entries()) {
    expect(a.position.x).toBeGreaterThanOrEqual(0);
    expect(a.position.y).toBeGreaterThanOrEqual(0);
    expect(a.position.x + a.size.width).toBeLessThanOrEqual(columns);
    for (const b of layout.slice(i + 1)) {
      const overlap = a.position.x < b.position.x + b.size.width && a.position.x + a.size.width > b.position.x && a.position.y < b.position.y + b.size.height && a.position.y + a.size.height > b.position.y;
      expect(overlap).toBe(false);
    }
  }
};

describe('core desktop algorithms', () => {
  it('uses type defaults and custom sizes', () => {
    expect(getItemSize(link('a'))).toEqual({ width: 1, height: 1 });
    expect(getItemSize({ type: 'widget', id: 'w', title: 'w', widget: 'weather', size: { width: 3, height: 4 } })).toEqual({ width: 3, height: 4 });
  });
  it('resolves deterministic collision-free layouts without mutation', () => {
    const items = [link('a', 0, 0), link('b', 0, 0), link('c')];
    const before = JSON.stringify(items);
    const a = resolveLayout(items, 4, 'grid');
    const b = resolveLayout(items, 4, 'grid');
    expect(a.map(x => x.position)).toEqual(b.map(x => x.position));
    expect(new Set(a.map(x => `${x.position.x},${x.position.y}`)).size).toBe(3);
    expect(JSON.stringify(items)).toBe(before);
  });
  it('preserves fractional free positions', () => {
    const out = resolveLayout([link('a', 1.25, 2.5)], 12, 'free');
    expect(out[0].position).toEqual({ x: 1.25, y: 2.5 });
  });
  it('moves requested item first and reflows collisions immutably', () => {
    const c = config([link('a', 0, 0), link('b', 1, 0)]);
    const out = moveItem(c, 'b', { x: 0, y: 0 }, 4);
    expect(out.items.find(i => i.id === 'b')?.position).toEqual({ x: 0, y: 0 });
    expect(out.items.find(i => i.id === 'a')?.position).not.toEqual({ x: 0, y: 0 });
    expect(c.items[1].position).toEqual({ x: 1, y: 0 });
  });
  it('merges links and supports folder extraction/removal', () => {
    const merged = mergeItems(config([link('a', 0, 0), link('b', 1, 0)]), 'b', 'a');
    expect(merged.items).toHaveLength(1); expect(merged.items[0].type).toBe('folder');
    const folderId = merged.items[0].id;
    const extracted = extractFromFolder(merged, folderId, 'b');
    expect(extracted.items.some(i => i.id === 'b')).toBe(true);
    expect(extracted.items.some(i => i.type === 'folder')).toBe(true);
    expect(removeItem(merged, folderId).items).toHaveLength(0);
  });
  it('validates shape, safe urls, duplicate ids and malformed props', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(validateConfig({ version: 1, items: [link('x'), link('x')] }).valid).toBe(false);
    expect(validateConfig({ version: 1, items: [{ type: 'widget', id: 'w', title: 'w', widget: 'x', props: { bad: undefined } }] }).valid).toBe(false);
    expect(validateConfig({ version: 1, items: [link('x')] }).config).toEqual({ version: 1, items: [link('x')] });
  });
  it('auto-arranges to packed grid', () => {
    const out = autoArrange(config([link('a', 20, 20), link('b', 20, 20)]), 3);
    expect(out.items.map(i => i.position)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  });
  it('reserves valid positions before placing earlier unpositioned or out-of-bounds items', () => {
    const layout = resolveLayout([link('new'), link('offscreen', 20, 0), link('fixed', 0, 0), link('edge', 2, 0)], 3);
    expect(layout.find(l => l.item.id === 'fixed')?.position).toEqual({ x: 0, y: 0 });
    expect(layout.find(l => l.item.id === 'edge')?.position).toEqual({ x: 2, y: 0 });
    collisionFree(layout, 3);
  });
  it('moves one item without shifting noncolliding explicit positions', () => {
    const output = moveItem(config([link('a', 0, 0), link('b', 1, 0), link('c', 2, 0)]), 'c', { x: 0, y: 0 }, 3);
    expect(output.items.map(i => i.position)).toEqual([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
  });
  it('clamps a moved off-screen destination before reserving its priority', () => {
    const output = moveItem(config([link('a', 2, 0), link('b', 1, 0)]), 'b', { x: 99, y: 0 }, 3);
    expect(output.items.find(i => i.id === 'b')?.position).toEqual({ x: 2, y: 0 });
    expect(output.items.find(i => i.id === 'a')?.position).toEqual({ x: 0, y: 0 });
  });
  it.each(['grid', 'free'] as const)('reflows wide widgets on responsive %s columns without losing source coordinates', mode => {
    const before = JSON.stringify(initialConfig);
    const layout = resolveLayout(initialConfig.items, 3, mode);
    collisionFree(layout, 3);
    expect(resolveLayout(initialConfig.items, 3, mode)).toEqual(layout);
    expect(JSON.stringify(initialConfig)).toBe(before);
    collisionFree(resolveLayout(initialConfig.items, 12, mode), 12);
  });
  it('keeps free movement fractional within viewport columns', () => {
    const output = moveItem({ ...config([link('a', 0, 0), link('b', 1, 0)]), settings: { layout: 'free' } }, 'b', { x: 2.75, y: 3.25 }, 3);
    expect(output.items[1].position).toEqual({ x: 2, y: 3.25 });
    collisionFree(resolveLayout(output.items, 3, 'free'), 3);
  });
  it('packs many tall items without the former fallback overlap after row 1000', () => {
    const items: DesktopItem[] = Array.from({ length: 70 }, (_, i) => ({ type: 'widget', id: `w-${i}`, title: 'W', widget: 'weather', size: { width: 24, height: 24 } }));
    const result = resolveLayout(items, 1);
    collisionFree(result, 1);
    expect(result.at(-1)?.position.y).toBe(69 * 24);
  });
  it('bounds unreasonable coordinates and nonfinite column arguments', () => {
    for (const columns of [Number.NaN, Infinity, -10]) {
      const result = resolveLayout([link('far', 1e50, 1e50)], columns);
      expect(result[0].position.y).toBeLessThanOrEqual(1000);
      expect(Number.isFinite(result[0].position.x)).toBe(true);
    }
  });
  it('creates a globally unique folder id, preserves target position and child ids', () => {
    const input = config([link('a', 0, 0), link('b', 2, 0), link('neighbor', 1, 0), { ...folder('existing', [link('a-folder')]), position: { x: 0, y: 3 } }]);
    const output = mergeItems(input, 'b', 'a', 3);
    const created = output.items.find(i => i.id === 'a-folder-2') as DesktopFolder;
    expect(created.position).toEqual({ x: 0, y: 0 });
    expect(created.children.map(i => i.id)).toEqual(['a', 'b']);
    expect(validateConfig(output).valid).toBe(true);
    collisionFree(resolveLayout(output.items, 3), 3);
    expect(input.items[0].type).toBe('link');
  });
  it('does not overfill a folder or nest folders/widgets', () => {
    const full = config([folder('f', Array.from({ length: 100 }, (_, i) => link(`child-${i}`))), link('new')]);
    expect(mergeItems(full, 'new', 'f')).toEqual(full);
    expect(mergeItems(full, 'f', 'new')).toEqual(full);
    expect(mergeItems(full, 'new', 'new')).toEqual(full);
  });
  it('extracts without displacing existing slots and deletes only an emptied folder', () => {
    const input = config([{ ...folder('f', [link('child')]), position: { x: 0, y: 0 } }, link('fixed', 2, 0)]);
    const output = extractFromFolder(input, 'f', 'child', 3);
    expect(output.items.map(i => i.id)).toEqual(['fixed', 'child']);
    expect(output.items[0].position).toEqual({ x: 2, y: 0 });
    expect(output.items[1].position).toEqual({ x: 0, y: 0 });
    expect(validateConfig(output).valid).toBe(true);
    expect((input.items[0] as DesktopFolder).children).toHaveLength(1);
  });
  it('removes a folder child, then cleans an empty folder', () => {
    const input = config([folder('f', [link('a'), link('b')]), link('fixed')]);
    const first = removeItem(input, 'a');
    expect((first.items[0] as DesktopFolder).children.map(i => i.id)).toEqual(['b']);
    expect(removeItem(first, 'b').items.map(i => i.id)).toEqual(['fixed']);
  });
  it('auto-arranges fractional free positions to grid cells', () => {
    const input: DesktopConfig = { ...config([link('a', 2.5, 3.25), link('b', 0.25, 0.5)]), settings: { layout: 'free' } };
    const output = autoArrange(input, 3);
    expect(output.items.map(i => i.position)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(output.settings?.layout).toBe('free');
  });
  it('returns independent nested data from transforms', () => {
    const input = config([folder('f', [link('a')])]);
    const result = moveItem(input, 'f', { x: 2, y: 2 });
    (result.items[0] as DesktopFolder).children[0].title = 'changed';
    expect((input.items[0] as DesktopFolder).children[0].title).toBe('a');
  });
  it.each(['javascript:alert(1)', ' javascript:alert(1)', 'java\nscript:alert(1)', 'https://', 'https://bad host.test', 'https://user:pass@example.com', 'https:\\example.com', ' https://example.com', 'https://example.com\n', 'data:text/html,Hi'])('rejects unsafe or malformed url %s', url => {
    expect(isSafeUrl(url)).toBe(false);
    expect(validateConfig(config([{ ...link('a'), url } as DesktopLink])).valid).toBe(false);
    expect(validateConfig(config([folder('f', [{ ...link('a'), url } as DesktopLink])])).valid).toBe(false);
  });
  it.each([null, true, 'text', [], { version: 1, items: [null] }, { version: 1, items: [folder('f', [null as unknown as DesktopLink])] }])('rejects malformed JSON input without throwing', input => {
    expect(() => validateConfig(input)).not.toThrow();
    expect(validateConfig(input).valid).toBe(false);
  });
  it('rejects duplicate ids throughout folders and enforces JSON bounds', () => {
    expect(validateConfig(config([link('a'), folder('f', [link('a')])])).valid).toBe(false);
    expect(validateConfig(config(Array.from({ length: 301 }, (_, i) => link(`a-${i}`)))).valid).toBe(false);
    expect(validateConfig(config([folder('f', Array.from({ length: 101 }, (_, i) => link(`a-${i}`)))])).valid).toBe(false);
    expect(validateConfig(config([link('a', 0, 1e9)])).valid).toBe(false);
    expect(validateConfig(config([link('a', 0, -1)])).valid).toBe(false);
  });
  it.each([{ rowHeight: 0 }, { rowHeight: 1000 }, { gap: 1000 }, { columns: 25 }, { columns: 1.5 }, { arbitrary: true }])('rejects invalid settings', settings => {
    expect(validateConfig({ version: 1, items: [], settings }).valid).toBe(false);
  });
  it('rejects non-record widget props, nonfinite values, functions, cycles, and extra geometry', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    for (const props of [[], 'text', 2, { value: Infinity }, { value: () => 1 }, cyclic, { nested: new Date() }, { sparse: new Array(1_000_000) }]) {
      expect(validateConfig({ version: 1, items: [{ type: 'widget', id: 'w', title: 'W', widget: 'test', props }] }).valid).toBe(false);
    }
    expect(validateConfig({ version: 1, items: [{ ...link('a'), position: { x: 0, y: 0, extra: cyclic } }] }).valid).toBe(false);
  });
  it('validates the full shipped demo and provides a detached JSON configuration', () => {
    const result = validateConfig(initialConfig);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.config).toEqual(initialConfig);
    expect(result.config).not.toBe(initialConfig);
  });
});
