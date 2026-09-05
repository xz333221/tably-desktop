'use client';

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Desktop } from './Desktop';
import type { DesktopProps } from './types';

export { Desktop } from './Desktop';
export { builtInWidgets } from './widgets';
export { autoArrange, extractFromFolder, getItemSize, isSafeUrl, mergeItems, moveItem, removeItem, resolveLayout, validateConfig } from './core';
export { migrateLegacyHomeConfig } from './migration';
export type { LegacyMigrationResult } from './migration';
export type * from './types';

/** Mount the React desktop in any DOM container. Call destroy before removing the container. */
export function mountDesktop(element: HTMLElement, initialProps: DesktopProps) {
  const root = createRoot(element);
  let props = initialProps;
  let destroyed = false;
  root.render(createElement(Desktop, props));
  return {
    update(nextProps: Partial<DesktopProps>) {
      if (destroyed) throw new Error('This Tably desktop has already been destroyed.');
      props = { ...props, ...nextProps }; root.render(createElement(Desktop, props));
    },
    destroy() { if (!destroyed) { root.unmount(); destroyed = true; } },
  };
}
