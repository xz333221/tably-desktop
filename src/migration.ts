import type { DesktopConfig, DesktopItem, DesktopLink, DesktopWidget, JsonValue } from './types';
import { isSafeUrl, resolveLayout } from './core';

export interface LegacyMigrationResult {
  config: DesktopConfig;
  warnings: string[];
  skipped: number;
}

type AnyRecord = Record<string, unknown>;
const record = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && !!value.trim())?.trim();
const safeId = (value: unknown, fallback: string, used: Set<string>) => {
  const base = (typeof value === 'string' && value.trim() ? value : fallback).replace(/[^\w\-\u4e00-\u9fff]+/g, '-').slice(0, 100) || fallback;
  let id = base, index = 2;
  while (used.has(id)) id = `${base}-${index++}`;
  used.add(id);
  return id;
};

function linkFrom(value: unknown, index: number, used: Set<string>): DesktopLink | undefined {
  if (!record(value)) return undefined;
  const url = text(value.url, value.href, value.link, value.website_url);
  if (!url || !isSafeUrl(url)) return undefined;
  return {
    id: safeId(value.id, `legacy-link-${index + 1}`, used), type: 'link',
    title: text(value.title, value.name, value.website_name, value.text) || new URL(url).hostname,
    url, icon: text(value.icon, value.icon_url, value.favicon, value.favicon_url),
    color: text(value.color, value.background, value.bg_color),
  };
}

function widgetName(value: unknown): string {
  const name = String(value || '').toLowerCase().replace(/[\s_-]/g, '');
  if (name.includes('weather') || name.includes('天气')) return 'weather';
  if (name.includes('calendar') || name.includes('日历')) return 'calendar';
  if (name.includes('time') || name.includes('clock') || name.includes('时间')) return 'clock';
  if (name.includes('focus') || name.includes('pomodoro') || name.includes('专注')) return 'focus';
  if (name.includes('note') || name.includes('便签') || name.includes('记')) return 'notes';
  return text(value) || 'legacy-widget';
}

function widgetFrom(value: unknown, index: number, used: Set<string>): DesktopWidget | undefined {
  if (!record(value)) return undefined;
  const widget = widgetName(value.widget ?? value.component ?? value.name);
  const props = record(value.props) ? value.props : record(value.config) ? value.config : {};
  const row = Number(value.row ?? value.height ?? value.h ?? 2);
  const col = Number(value.col ?? value.width ?? value.w ?? 3);
  return {
    id: safeId(value.id, `legacy-widget-${index + 1}`, used), type: 'widget',
    title: text(value.title, value.label, value.name) || widget,
    widget, props: { ...props } as Record<string, JsonValue>,
    size: { width: Number.isFinite(col) && col > 0 ? Math.min(24, Math.round(col)) : 3, height: Number.isFinite(row) && row > 0 ? Math.min(24, Math.round(row)) : 2 },
  };
}

/** Convert legacy Nuxt/Vue or React home config into a validated Tably v1 config. */
export function migrateLegacyHomeConfig(input: unknown): LegacyMigrationResult {
  const warnings: string[] = [];
  const used = new Set<string>();
  const root = record(input) ? input : {};
  const front = record(root.front_config) ? root.front_config : record(root.config) && record(root.config.front_config) ? root.config.front_config : record(root.config) ? root.config : root;
  const items: DesktopItem[] = [];
  const addLinks = (values: unknown) => {
    if (!Array.isArray(values)) return;
    values.forEach((value, index) => { const link = linkFrom(value, index, used); if (link) items.push(link); else warnings.push(`跳过第 ${index + 1} 个无效网站地址`); });
  };
  addLinks(front.open_url_list);
  addLinks(front.user_url_list);
  addLinks(root.user_url_list);
  if (Array.isArray(front.componentsList)) front.componentsList.forEach((value, index) => {
    const widget = widgetFrom(value, index, used); if (widget) items.push(widget); else warnings.push(`小组件 ${index + 1} 未能迁移`);
  });
  if (Array.isArray(front.widgets)) front.widgets.forEach((value, index) => {
    const widget = widgetFrom(value, index + items.length, used); if (widget) items.push(widget);
  });
  const columns = Number.isInteger(front.columns) && Number(front.columns) >= 1 && Number(front.columns) <= 24 ? Number(front.columns) : 12;
  const layout = resolveLayout(items, columns, 'grid');
  const name = text(front.title, front.page_title, root.name) || '我的桌面';
  const config: DesktopConfig = {
    version: 1, name,
    items: layout.map(({ item, position }) => ({ ...item, position })),
    settings: { layout: 'grid', columns, rowHeight: 104, gap: 16, wallpaper: 'linen' },
  };
  return { config, warnings, skipped: warnings.length };
}
