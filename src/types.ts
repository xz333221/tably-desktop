import type { ComponentType, CSSProperties } from 'react';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface Position { x: number; y: number }
export interface ItemSize { width: number; height: number }
interface ItemBase {
  id: string;
  title: string;
  position?: Position;
  size?: ItemSize;
}
export interface DesktopLink extends ItemBase {
  type: 'link';
  url: string;
  /** Image URL, data:image URL, or a built-in name such as google, github, figma. */
  icon?: string;
  color?: string;
}
export interface DesktopFolder extends ItemBase {
  type: 'folder';
  children: DesktopLink[];
}
export interface DesktopWidget extends ItemBase {
  type: 'widget';
  widget: string;
  props?: Record<string, JsonValue>;
}
export type DesktopItem = DesktopLink | DesktopFolder | DesktopWidget;
export interface DesktopSettings {
  layout?: 'grid' | 'free';
  columns?: number;
  rowHeight?: number;
  gap?: number;
  wallpaper?: 'linen' | 'sage' | 'dusk';
}
export interface DesktopConfig {
  version: 1;
  name?: string;
  items: DesktopItem[];
  settings?: DesktopSettings;
}
export interface WidgetRenderProps {
  item: DesktopWidget;
  editing: boolean;
  readOnly?: boolean;
  updateProps: (patch: Record<string, JsonValue>) => void;
}
export interface WidgetDefinition {
  title: string;
  description?: string;
  defaultSize?: ItemSize;
  defaultProps?: Record<string, JsonValue>;
  component: ComponentType<WidgetRenderProps>;
}
export type WidgetRegistry = Record<string, WidgetDefinition>;
export interface DesktopProps {
  config: DesktopConfig;
  onChange?: (config: DesktopConfig) => void;
  widgets?: WidgetRegistry;
  onOpenLink?: (link: DesktopLink) => void;
  editable?: boolean;
  /** Render only the desktop grid and dock; editing actions are available from the context menu. */
  minimal?: boolean;
  /**
   * Controls the amount of chrome rendered around the desktop. `minimal`
   * keeps only the grid and dock; actions are available from the context menu.
   */
  mode?: 'full' | 'minimal';
  /** Alias for `mode="minimal"`, useful when the host app exposes a compact toggle. */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}
export interface LayoutItem { item: DesktopItem; position: Position; size: ItemSize }
export interface ValidationResult { valid: boolean; errors: string[]; config?: DesktopConfig }
