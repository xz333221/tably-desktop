import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { DotsThree, DotsSix, PuzzlePiece, ArrowSquareOut } from '@phosphor-icons/react';
import type { DesktopConfig, DesktopItem, DesktopLink, DesktopWidget, LayoutItem, Position, WidgetRegistry, JsonValue } from './types';
import { resolveLayout, moveItem, mergeItems } from './core';
import { AppIcon } from './icons';

class WidgetBoundary extends Component<{ children: ReactNode; title: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[Tably widget]', error, info.componentStack); }
  render() { return this.state.failed ? <div className="tably-widget-missing"><PuzzlePiece size={28} /><strong>{this.props.title} 暂时无法显示</strong><button type="button" onClick={() => this.setState({ failed: false })}>重新加载</button></div> : this.props.children; }
}

interface GridProps {
  config: DesktopConfig;
  registry: WidgetRegistry;
  editing: boolean;
  editable: boolean;
  minimal: boolean;
  onChange: (config: DesktopConfig) => void;
  onOpen: (item: DesktopItem) => void;
  onMenu: (item: DesktopItem) => void;
  onNotify: (text: string) => void;
  onColumns: (columns: number) => void;
}
interface Drag {
  id: string; pointerId: number; startX: number; startY: number; start: Position;
  element: HTMLElement; active: boolean; position: Position; size: { width: number; height: number };
  candidate: string | null; ready: boolean; timer?: ReturnType<typeof setTimeout>;
  touchTimer?: ReturnType<typeof setTimeout>;
  scrollTop: number;
}

export function DesktopGrid({ config, registry, editing, editable, minimal, onChange, onOpen, onMenu, onNotify, onColumns }: GridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [width, setWidth] = useState(1100);
  const [containerHeight, setContainerHeight] = useState(900);
  const [active, setActive] = useState<string | null>(null);
  const [merge, setMerge] = useState<{ id: string; ready: boolean } | null>(null);
  const desiredColumns = config.settings?.columns ?? 12;
  const columns = Math.min(desiredColumns, Math.max(3, Math.floor((width + 16) / 88)));
  const gap = config.settings?.gap ?? 16;
  const pitch = (width + gap) / columns;
  const rowHeight = Math.min(config.settings?.rowHeight ?? 104, containerHeight <= 800 && width > 900 ? 92 : 240);
  const mode = config.settings?.layout ?? 'grid';
  const layout = useMemo(() => resolveLayout(config.items.map(item => item.type === 'widget' && !item.size && registry[item.widget]?.defaultSize ? { ...item, size: registry[item.widget].defaultSize } : item), columns, mode), [config.items, columns, mode, registry]);
  const height = Math.max(4, ...layout.map(x => x.position.y + x.size.height)) * rowHeight - gap;
  const latest = useRef({ config, layout, columns, pitch, rowHeight, mode, onChange, onNotify });
  latest.current = { config, layout, columns, pitch, rowHeight, mode, onChange, onNotify };

  useLayoutEffect(() => {
    const node = gridRef.current;
    if (!node) return;
    const root = node.closest('.tably-desktop');
    const measure = () => { setWidth(node.clientWidth); setContainerHeight(root?.clientHeight ?? 900); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (root) observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { onColumns(columns); }, [columns, onColumns]);

  useEffect(() => {
    const activate = (drag: Drag) => {
      if (drag.active) return;
      drag.active = true;
      drag.element.setPointerCapture(drag.pointerId);
      suppressClick.current = true;
      setActive(drag.id);
      drag.element.style.zIndex = '30';
      drag.element.style.transition = 'none';
    };
    const reset = () => {
      const drag = dragRef.current;
      if (drag) {
        clearTimeout(drag.timer); clearTimeout(drag.touchTimer);
        drag.element.style.removeProperty('z-index');
        drag.element.style.removeProperty('transition');
        drag.element.style.removeProperty('translate');
        if (drag.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
      }
      dragRef.current = null; setActive(null); setMerge(null);
      setTimeout(() => { suppressClick.current = false; }, 60);
    };
    const pointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const { layout, columns, pitch, rowHeight, mode } = latest.current;
      const scrollTop = gridRef.current?.closest('.tably-workspace')?.scrollTop ?? 0;
      const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY + scrollTop - drag.scrollTop;
      if (!drag.active && Math.hypot(dx, dy) > 7) activate(drag);
      if (!drag.active) return;
      event.preventDefault();
      const x = Math.max(0, Math.min(columns - drag.size.width, drag.start.x + dx / pitch));
      const y = Math.min(1000, Math.max(0, drag.start.y + dy / rowHeight));
      drag.position = mode === 'grid' ? { x: Math.round(x), y: Math.round(y) } : { x: +x.toFixed(3), y: +y.toFixed(3) };
      drag.element.style.translate = `${(x - drag.start.x) * pitch}px ${(y - drag.start.y) * rowHeight}px`;
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${drag.position.x * pitch}px, ${drag.position.y * rowHeight}px)`;
        ghostRef.current.style.width = `${drag.size.width * pitch - gap}px`;
        ghostRef.current.style.height = `${drag.size.height * rowHeight - gap}px`;
      }
      const rect = gridRef.current!.getBoundingClientRect();
      const px = event.clientX - rect.left, py = event.clientY - rect.top;
      const source = layout.find(l => l.item.id === drag.id);
      const candidate = source?.item.type === 'link' ? layout.find(l => l.item.id !== drag.id && l.item.type !== 'widget' && px > l.position.x * pitch + 10 && px < (l.position.x + l.size.width) * pitch - gap - 10 && py > l.position.y * rowHeight + 5 && py < (l.position.y + l.size.height) * rowHeight - gap - 5)?.item.id ?? null : null;
      if (candidate !== drag.candidate) {
        clearTimeout(drag.timer); drag.candidate = candidate; drag.ready = false;
        setMerge(candidate ? { id: candidate, ready: false } : null);
        if (candidate) drag.timer = setTimeout(() => {
          if (dragRef.current === drag && drag.candidate === candidate) { drag.ready = true; setMerge({ id: candidate, ready: true }); }
        }, 550);
      }
      const scroller = gridRef.current?.closest('.tably-workspace');
      if (scroller) {
        const sr = scroller.getBoundingClientRect();
        if (event.clientY > sr.bottom - 50) scroller.scrollTop += 12;
        else if (event.clientY < sr.top + 40) scroller.scrollTop -= 12;
      }
    };
    const pointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const { config, layout, columns, onChange, onNotify } = latest.current;
      if (drag.active) {
        const rendered = { ...config, items: layout.map(l => ({ ...l.item, position: l.position })) };
        if (drag.ready && drag.candidate) {
          onChange(mergeItems(rendered, drag.id, drag.candidate, columns));
          onNotify('已放入文件夹');
        } else { onChange(moveItem(rendered, drag.id, drag.position, columns)); onNotify('桌面布局已更新'); }
      }
      reset();
    };
    const cancel = (event: Event) => { if (event.type === 'pointercancel' && dragRef.current && (event as PointerEvent).pointerId !== dragRef.current.pointerId) return; reset(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && dragRef.current) { reset(); event.preventDefault(); } };
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key);
      clearTimeout(dragRef.current?.timer); clearTimeout(dragRef.current?.touchTimer);
    };
  }, [gap]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, entry: LayoutItem) {
    if (!editable || event.button !== 0 || dragRef.current || (event.target as HTMLElement).closest('[data-no-drag]')) return;
    if (entry.item.type === 'widget' && !(event.target as HTMLElement).closest('[data-drag-handle]')) return;
    const element = event.currentTarget;
    dragRef.current = { id: entry.item.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, start: entry.position, position: entry.position, element, active: false, size: entry.size, candidate: null, ready: false, scrollTop: gridRef.current?.closest('.tably-workspace')?.scrollTop ?? 0 };
  }
  function updateProps(item: DesktopWidget, patch: Record<string, JsonValue>) {
    if (!editable) return;
    onChange({ ...config, items: config.items.map(i => i.id === item.id ? { ...item, props: { ...item.props, ...patch } } : i) });
  }
  return <div ref={gridRef} className={`tably-grid${editing ? ' tably-grid--editing' : ''}${active ? ' tably-grid--dragging' : ''}${!editable ? ' tably-grid--readonly' : ''}`} style={{ height: height + (active ? rowHeight * 2 : 0), '--tably-col-pitch': `${pitch}px`, '--tably-row-pitch': `${rowHeight}px` } as React.CSSProperties} aria-label="桌面应用与小组件">
    <div ref={ghostRef} className="tably-drop-ghost" aria-hidden="true" style={{ display: active ? 'block' : 'none' }} />
    {layout.map(entry => {
      const { item, position, size } = entry;
      const definition = item.type === 'widget' ? registry[item.widget] : undefined;
      const Widget = definition?.component;
      return <div key={item.id} data-item-id={item.id} data-item-type={item.type} className={`tably-tile tably-tile--${item.type}${active === item.id ? ' tably-tile--dragging' : ''}${merge?.id === item.id ? ` tably-tile--merge${merge.ready ? ' tably-tile--merge-ready' : ''}` : ''}`} style={{ transform: `translate(${position.x * pitch}px, ${position.y * rowHeight}px)`, width: size.width * pitch - gap, height: size.height * rowHeight - gap }} onPointerDown={e => startDrag(e, entry)} onKeyDown={e => {
        if (!editable || (e.target as HTMLElement).closest('[data-no-drag]') || !e.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const delta = mode === 'free' ? .25 : 1;
        const x = position.x + (e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0);
        const y = position.y + (e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0);
        const rendered = { ...config, items: layout.map(l => ({ ...l.item, position: l.position })) };
        onChange(moveItem(rendered, item.id, { x: Math.max(0, x), y: Math.max(0, y) }, columns));
        onNotify(`${item.title}位置已更新`);
      }}>
        {item.type === 'link' && <button type="button" className="tably-app" title={item.url} aria-label={`打开${item.title}`} onClick={() => { if (!suppressClick.current) onOpen(item); }}><AppIcon item={item} /><span className="tably-app-label">{item.title}</span></button>}
        {item.type === 'folder' && <button type="button" className="tably-folder" aria-label={`打开文件夹${item.title}，${item.children.length}个应用`} onClick={() => { if (!suppressClick.current) onOpen(item); }}><span className="tably-folder-preview">{item.children.slice(0, 9).map(child => <AppIcon key={child.id} item={child as DesktopLink} small />)}{item.children.length === 0 && <span className="tably-folder-empty">拖入应用</span>}</span><span className="tably-folder-caption"><span>{item.title}</span><span>{item.children.length}</span></span></button>}
        {item.type === 'widget' && <article className={`tably-widget tably-widget--${item.widget}`} aria-label={item.title}>
          {editable && <div className="tably-widget-handle" data-drag-handle tabIndex={0} aria-label={`移动${item.title}`} title="拖动移动；Alt + 方向键微调"><DotsSix size={18} weight="bold" /></div>}
          <WidgetBoundary key={item.widget} title={item.title}>{Widget ? <Widget item={item} editing={editing && editable} readOnly={!editable} updateProps={patch => updateProps(item, patch)} /> : <div className="tably-widget-missing"><PuzzlePiece size={30} /><strong>{item.title}</strong><span>请注册 {item.widget} 组件</span></div>}</WidgetBoundary>
        </article>}
        {editable && !minimal && <button type="button" className="tably-item-menu" data-no-drag aria-label={`管理${item.title}`} onClick={() => onMenu(item)}><DotsThree size={19} weight="bold" /></button>}
        {merge?.id === item.id && <span className="tably-merge-label">{merge.ready ? '松开放入文件夹' : '稍停片刻，合并应用'}</span>}
      </div>;
    })}
    {config.items.length === 0 && <div className="tably-empty"><ArrowSquareOut size={32} weight="duotone" /><h3>从一个喜欢的网站开始</h3><p>{editable ? '点击右上角「添加」，把网站和小组件放到桌面。' : '这里还没有应用或小组件。'}</p></div>}
  </div>;
}
