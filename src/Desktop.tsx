'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { SquaresFour, Plus, MagnifyingGlass, SlidersHorizontal, Code, ArrowCounterClockwise, ArrowUUpLeft, Check, ArrowUpRight, UploadSimple, DownloadSimple, Copy, GridFour, Cursor, PencilSimple, ArrowSquareOut, Trash, X, CloudSun, Clock, NoteBlank, Timer, CalendarBlank, PuzzlePiece, CaretRight, House, CheckCircle } from '@phosphor-icons/react';
import { DesktopGrid } from './DesktopGrid';
import { Dialog } from './Dialog';
import { AppIcon } from './icons';
import { builtInWidgets } from './widgets';
import { autoArrange, extractFromFolder, getItemSize, isSafeUrl, removeItem, resolveLayout, validateConfig } from './core';
import type { DesktopConfig, DesktopFolder, DesktopItem, DesktopLink, DesktopProps, DesktopWidget, WidgetRegistry } from './types';
import './style.css';

type Panel = 'add' | 'widgets' | 'appearance' | 'json' | null;
type ContextMenuState = { x: number; y: number; item: DesktopItem | null };
const builtInIconOptions = ['google', 'baidu', 'github', 'figma', 'notion', 'youtube', 'bilibili', 'pinterest', 'spotify', 'dribbble', 'browser', 'read', 'mail', 'image'];
const widgetIcons: Record<string, typeof CloudSun> = { weather: CloudSun, clock: Clock, notes: NoteBlank, focus: Timer, calendar: CalendarBlank };
const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function Desktop(props: DesktopProps) {
  const validation = useMemo(() => validateConfig(props.config), [props.config]);
  if (!validation.valid) return <div className={`tably-desktop ${props.className ?? ''}`} style={props.style}><div className="tably-empty" role="alert"><PuzzlePiece size={32} /><h3>这份桌面配置暂时无法显示</h3><p>{validation.errors.slice(0, 3).join('；')}</p></div></div>;
  return <DesktopSurface {...props} />;
}

function DesktopSurface({ config, onChange, widgets, onOpenLink, editable = true, minimal: minimalProp = false, mode = 'full', compact = false, className = '', style }: DesktopProps) {
  const minimal = minimalProp || compact || mode === 'minimal';
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(config);
  const current = onChange ? config : internal;
  const currentRef = useRef(current);
  currentRef.current = current;
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [managed, setManaged] = useState<DesktopItem | null>(null);
  const [notice, setNotice] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [history, setHistory] = useState<DesktopConfig[]>([]);
  const [columns, setColumns] = useState(12);
  const [now, setNow] = useState(() => new Date());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitted = useRef<DesktopConfig | undefined>(undefined);
  const searchId = useId();
  const registry: WidgetRegistry = useMemo(() => ({ ...builtInWidgets, ...widgets }), [widgets]);
  useEffect(() => {
    setInternal(config);
    if (submitted.current !== config) { setHistory([]); setManaged(null); setFolderId(null); setPanel(null); setQuery(''); setEditing(false); setContextMenu(null); }
  }, [config]);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30_000); return () => { clearInterval(id); clearTimeout(notificationTimer.current); }; }, []);
  useEffect(() => { if (!minimal) setContextMenu(null); }, [minimal]);
  const notify = useCallback((text: string) => {
    clearTimeout(notificationTimer.current); setNotice(text);
    notificationTimer.current = setTimeout(() => setNotice(''), 2600);
  }, []);
  const change = useCallback((next: DesktopConfig) => {
    if (!editable) return;
    const validation = validateConfig(next);
    if (!validation.valid) { notify(`无法更新：${validation.errors[0]}`); return; }
    setHistory(h => [...h.slice(-29), currentRef.current]);
    submitted.current = next; setInternal(next); onChange?.(next);
  }, [editable, onChange, notify]);
  const undo = () => {
    const previous = history.at(-1);
    if (!previous || !editable) return;
    setHistory(h => h.slice(0, -1)); submitted.current = previous; setInternal(previous); onChange?.(previous); notify('已撤销上一步');
  };
  const openLink = (item: DesktopLink) => {
    if (!isSafeUrl(item.url)) { notify('网站地址需要以 https:// 或 http:// 开头'); return; }
    if (onOpenLink) onOpenLink(item); else window.open(item.url, '_blank', 'noopener,noreferrer');
    setQuery('');
  };
  const openItem = (item: DesktopItem) => {
    if (item.type === 'link') openLink(item);
    else if (item.type === 'folder') { setFolderId(item.id); setQuery(''); }
    else {
      const element = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? []).find(e => e.dataset.itemId === item.id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); element?.querySelector<HTMLElement>('textarea, button, [tabindex="0"]')?.focus(); setQuery('');
    }
  };
  const showJSON = () => { setJsonText(JSON.stringify(current, null, 2)); setJsonError(''); setPanel('json'); };
  const applyJSON = (value: string) => {
    if (value.length > 1_000_000) { setJsonError('配置文件不能超过 1 MB'); return; }
    try {
      const result = validateConfig(JSON.parse(value));
      if (!result.valid || !result.config) { setJsonError(result.errors.slice(0, 5).join('\n')); return; }
      change(result.config); setPanel(null); notify('已应用 JSON 配置');
    } catch { setJsonError('JSON 格式有误，请检查引号、逗号和括号。'); }
  };
  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'tably-desktop.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); notify('桌面配置已导出');
  };
  const addItem = (item: DesktopItem) => {
    const items = resolveLayout([...current.items, item], columns, current.settings?.layout ?? 'grid').map(l => ({ ...l.item, position: l.position }));
    change({ ...current, items }); setPanel(null); notify(`已添加${item.title}`);
  };
  const folder = current.items.find(i => i.id === folderId && i.type === 'folder') as DesktopFolder | undefined;
  const results = query.trim() ? current.items.flatMap<DesktopItem>(item => item.type === 'folder' ? [item, ...item.children] : [item]).filter(item => `${item.title} ${item.type === 'link' ? item.url : ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  const dock = current.items.filter((i): i is DesktopLink => i.type === 'link').slice(0, 4);
  const dateLabel = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const wallpaper = current.settings?.wallpaper ?? 'linen';
  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!minimal) return;
    event.preventDefault();
    const tile = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
    const item = tile ? current.items.find(candidate => candidate.id === tile.dataset.itemId) ?? null : null;
    const menuWidth = 246;
    const menuHeight = item ? 310 : 360;
    setContextMenu({
      x: Math.min(event.clientX, Math.max(8, window.innerWidth - menuWidth - 8)),
      y: Math.min(event.clientY, Math.max(8, window.innerHeight - menuHeight - 8)),
      item,
    });
  };

  return <div ref={rootRef} className={`tably-desktop tably-theme-${wallpaper}${minimal ? ' tably-desktop--minimal' : ''} ${className}`} style={style} onContextMenu={handleContextMenu} onPointerDown={event => {
    if (contextMenu && !(event.target as HTMLElement).closest('.tably-context-menu')) setContextMenu(null);
  }} onKeyDown={e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    if (e.key === 'Escape') { setQuery(''); setEditing(false); setContextMenu(null); }
  }}>
    {!minimal && <header className="tably-topbar">
      <a className="tably-brand" href="#" onClick={e => { e.preventDefault(); rootRef.current?.querySelector('.tably-workspace')?.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Tably 桌面首页"><span className="tably-brand-symbol"><SquaresFour size={22} weight="fill" /></span><span>tably<span className="tably-brand-period">.</span></span></a>
      <nav className="tably-topnav" aria-label="桌面导航"><button type="button" className="tably-nav-active" onClick={() => { setPanel(null); setQuery(''); }}><House size={16} weight="fill" />我的桌面</button>{editable && <><button type="button" onClick={() => setPanel('widgets')}><SquaresFour size={17} />小组件</button><button type="button" onClick={() => setPanel('appearance')}><SlidersHorizontal size={17} />外观</button></>}</nav>
      <div className="tably-top-actions">{editable && <button type="button" className="tably-icon-button tably-mobile-only" aria-label="外观" onClick={() => setPanel('appearance')}><SlidersHorizontal size={20} /></button>}<button type="button" className="tably-icon-button tably-config-trigger" aria-label="桌面 JSON 配置" title="桌面 JSON 配置" onClick={showJSON}><Code size={20} /></button>{editable && <button type="button" className="tably-button tably-button-primary" onClick={() => setPanel('add')}><Plus size={17} weight="bold" />添加<span className="tably-desktop-only">到桌面</span></button>}</div>
    </header>}

    <main className={`tably-workspace${minimal ? ' tably-workspace--minimal' : ''}`}>
      {!minimal && <section className="tably-intro">
        <div className="tably-greeting"><p className="tably-date">{dateLabel}<span className="tably-date-separator">/</span><span>好好享受今天</span></p><h1>{current.name || '你的日常，自成一桌'}<span className="tably-title-spark">*</span></h1><p className="tably-subtitle">喜欢的网站，随手的灵感。都在这里。</p></div>
        <div className="tably-search-wrap"><div className="tably-search"><MagnifyingGlass size={19} /><input ref={searchRef} aria-label="搜索桌面" placeholder="找点什么…" value={query} onChange={e => setQuery(e.target.value)} aria-controls={query ? searchId : undefined} aria-expanded={!!query} onKeyDown={e => { if (e.key === 'Enter' && results[0]) openItem(results[0]); }} />{query ? <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={15} /></button> : <kbd>Ctrl K</kbd>}</div>
          {query && <div id={searchId} className="tably-search-results" aria-label="搜索结果">{results.length ? results.map(item => <button type="button" key={item.id} onClick={() => openItem(item)}>{item.type === 'link' ? <AppIcon item={item} small /> : <SquaresFour size={24} />}<span><strong>{item.title}</strong><small>{item.type === 'link' ? new URL(item.url).hostname : item.type === 'folder' ? '文件夹' : '小组件'}</small></span><ArrowUpRight size={16} /></button>) : <p>没有找到“{query}”</p>}</div>}
        </div>
      </section>}

      {!minimal && <div className="tably-section-bar"><div className="tably-section-name"><span className="tably-section-dot" />我的空间<span className="tably-item-count">{current.items.length}</span></div>{editable && <div className="tably-layout-actions">{history.length > 0 && <button type="button" onClick={undo} title="撤销上一步" aria-label="撤销上一步"><ArrowUUpLeft size={17} /></button>}<button type="button" onClick={() => { change(autoArrange(current, columns)); notify('桌面已自动整理'); }}><GridFour size={15} /><span>自动整理</span></button><span className="tably-toolbar-divider" /><button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)} className={editing ? 'tably-edit-active' : ''}>{editing ? <Check size={15} /> : <PencilSimple size={15} />}<span>{editing ? '完成编辑' : '编辑布局'}</span></button></div>}</div>}
      <DesktopGrid config={current} registry={registry} editing={editing} editable={editable} minimal={minimal} onChange={change} onOpen={openItem} onMenu={setManaged} onNotify={notify} onColumns={setColumns} />
      {!minimal && <div className="tably-desk-hint">{editable ? <><Cursor size={14} />{editing ? '拖动应用调整位置；小组件顶部可拖动。Alt + 方向键也能移动。' : '随意拖一拖。将两个应用叠在一起，发现新的可能。'}</> : '属于你的数字空间'}</div>}
    </main>

    <footer className={`tably-bottom${minimal ? ' tably-bottom--minimal' : ''}`}>{!minimal && <span className="tably-bottom-caption">A LITTLE SPACE. ALL YOURS.</span>}<div className="tably-dock" aria-label="快捷栏"><button type="button" className="tably-dock-home" aria-label="回到桌面顶部" onClick={() => rootRef.current?.querySelector('.tably-workspace')?.scrollTo({ top: 0, behavior: 'smooth' })}><SquaresFour size={25} weight="fill" /></button><span className="tably-dock-divider" />{dock.map(item => <button type="button" key={item.id} aria-label={`快捷打开${item.title}`} title={item.title} onClick={() => openLink(item)}><AppIcon item={item} small /><span className="tably-dock-tooltip">{item.title}</span></button>)}{editable && !minimal && <><span className="tably-dock-divider" /><button type="button" className="tably-dock-add" aria-label="添加小组件" title="添加小组件" onClick={() => setPanel('widgets')}><Plus size={24} /></button></>}</div>{!minimal && <span className="tably-bottom-mode"><span />{current.settings?.layout === 'free' ? '自由布局' : '网格对齐'}</span>}</footer>
    <div className={`tably-toast${notice ? ' tably-toast--visible' : ''}`} role="status" aria-live="polite">{notice && <><CheckCircle size={18} weight="fill" />{notice}</>}</div>

    {minimal && contextMenu && <div className="tably-context-menu" role="menu" aria-label="桌面操作" style={{ left: contextMenu.x, top: contextMenu.y }} onContextMenu={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
      {contextMenu.item ? <>
        <div className="tably-context-heading">{contextMenu.item.title}</div>
        <button type="button" role="menuitem" onClick={() => { const item = contextMenu.item; setContextMenu(null); if (item) openItem(item); }}><ArrowUpRight size={16} />打开</button>
        {editable && <button type="button" role="menuitem" onClick={() => { const item = contextMenu.item; setContextMenu(null); if (item) setManaged(item); }}><PencilSimple size={16} />编辑</button>}
        {editable && <button type="button" role="menuitem" className="tably-context-danger" onClick={() => { const item = contextMenu.item; setContextMenu(null); if (item) { change(removeItem(current, item.id)); notify('已移除，可撤销恢复'); } }}><Trash size={16} />移除</button>}
        <span className="tably-context-divider" />
      </> : <div className="tably-context-heading">桌面操作</div>}
      {editable && <>
        <button type="button" role="menuitem" onClick={() => { setContextMenu(null); setPanel('add'); }}><Plus size={16} />添加网站</button>
        <button type="button" role="menuitem" onClick={() => { setContextMenu(null); setPanel('widgets'); }}><SquaresFour size={16} />添加小组件</button>
        <button type="button" role="menuitem" onClick={() => { setContextMenu(null); change(autoArrange(current, columns)); notify('桌面已自动整理'); }}><GridFour size={16} />自动整理</button>
        <button type="button" role="menuitem" onClick={() => { setContextMenu(null); setEditing(value => !value); }}><PencilSimple size={16} />{editing ? '完成编辑' : '编辑布局'}</button>
        {history.length > 0 && <button type="button" role="menuitem" onClick={() => { setContextMenu(null); undo(); }}><ArrowUUpLeft size={16} />撤销上一步</button>}
        <span className="tably-context-divider" />
        <button type="button" role="menuitem" onClick={() => { setContextMenu(null); setPanel('appearance'); }}><SlidersHorizontal size={16} />外观设置</button>
      </>}
      <button type="button" role="menuitem" onClick={() => { setContextMenu(null); showJSON(); }}><Code size={16} />桌面 JSON 配置</button>
    </div>}

    {(panel === 'add' || panel === 'widgets') && <Dialog title={panel === 'add' ? '把喜欢的，放到桌面' : '给桌面加一点可能'} subtitle={panel === 'add' ? '一个网站，一点灵感，或一个好用的小组件。' : '轻量的小工具，让日常更顺手。'} onClose={() => setPanel(null)} wide>
      <div className="tably-tabs"><button type="button" className={panel === 'add' ? 'tably-tab-active' : ''} onClick={() => setPanel('add')}><ArrowSquareOut size={17} />网站应用</button><button type="button" className={panel === 'widgets' ? 'tably-tab-active' : ''} onClick={() => setPanel('widgets')}><SquaresFour size={17} />小组件</button></div>
      {panel === 'add' ? <LinkForm onSubmit={addItem} /> : <div className="tably-widget-catalog">{Object.entries(registry).map(([key, definition]) => { const Icon = widgetIcons[key] ?? PuzzlePiece; return <button type="button" key={key} className={`tably-catalog-card tably-catalog-${key}`} onClick={() => addItem({ id: uid(key), type: 'widget', title: definition.title, widget: key, size: definition.defaultSize ?? { width: 3, height: 2 }, props: definition.defaultProps ? JSON.parse(JSON.stringify(definition.defaultProps)) : {} })}><span className="tably-catalog-preview"><Icon size={38} weight="duotone" />{key === 'clock' && <span>09:41</span>}{key === 'focus' && <span>25:00</span>}{key === 'weather' && <span>24°</span>}</span><span className="tably-catalog-info"><strong>{definition.title}</strong><small>{definition.description || '你的自定义小组件'}</small></span><Plus size={18} /></button>; })}</div>}
    </Dialog>}

    {panel === 'appearance' && <Dialog title="让桌面更像你" subtitle="找到舒服的颜色，留出喜欢的空间。" onClose={() => setPanel(null)}>
      <div className="tably-settings-section"><h3>桌面底色</h3><div className="tably-wallpapers">{([['linen', '晨间留白'], ['sage', '浅野绿意'], ['dusk', '暮色时分']] as const).map(([key, title]) => <button type="button" key={key} className={wallpaper === key ? 'tably-selected' : ''} aria-pressed={wallpaper === key} onClick={() => change({ ...current, settings: { ...current.settings, wallpaper: key } })}><span className={`tably-wallpaper-swatch tably-swatch-${key}`}>{wallpaper === key && <Check size={20} />}</span><span>{title}</span></button>)}</div></div>
      <div className="tably-settings-section"><h3>移动方式</h3><div className="tably-mode-options">{([['grid', GridFour, '网格对齐', '自动吸附，整齐又舒服'], ['free', Cursor, '自由摆放', '随心微调，保留你的留白']] as const).map(([key, Icon, title, desc]) => <button type="button" key={key} className={(current.settings?.layout ?? 'grid') === key ? 'tably-selected' : ''} aria-pressed={(current.settings?.layout ?? 'grid') === key} onClick={() => change({ ...current, settings: { ...current.settings, layout: key } })}><Icon size={23} /><span><strong>{title}</strong><small>{desc}</small></span>{(current.settings?.layout ?? 'grid') === key && <Check size={18} />}</button>)}</div></div>
      <div className="tably-dialog-footer"><button type="button" className="tably-button" onClick={() => { change(autoArrange(current, columns)); notify('桌面已自动整理'); }}><ArrowCounterClockwise size={17} />一键整理</button><button type="button" className="tably-button tably-button-primary" onClick={() => setPanel(null)}>就这样，很好</button></div>
    </Dialog>}

    {panel === 'json' && <Dialog title="一份 JSON，一整张桌面" subtitle="保存你的布局，或将它带到另一个项目里。" onClose={() => setPanel(null)} wide>
      <div className="tably-json-toolbar"><span><span className="tably-json-file-dot" />desktop.config.json</span><button type="button" className="tably-text-button" onClick={async () => { try { await navigator.clipboard.writeText(jsonText); notify('JSON 已复制'); } catch { notify('复制失败，请在文本框中全选复制'); } }}><Copy size={15} />复制</button></div>
      <textarea className="tably-json-editor" aria-label="桌面 JSON" value={jsonText} onChange={e => { setJsonText(e.target.value); setJsonError(''); }} spellCheck={false} readOnly={!editable} />
      {jsonError && <p className="tably-form-error" role="alert">{jsonError}</p>}
      <div className="tably-dialog-footer"><div className="tably-inline-actions">{editable && <label className="tably-button tably-upload-label"><UploadSimple size={16} />导入<input type="file" accept=".json,application/json" aria-label="导入 JSON 文件" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 1_000_000) { setJsonError('配置文件不能超过 1 MB'); return; } try { const text = await file.text(); setJsonText(text); setJsonError(''); } catch { setJsonError('无法读取文件，请重新选择。'); } }} /></label>}<button type="button" className="tably-button" onClick={downloadJSON}><DownloadSimple size={16} />导出</button></div>{editable && <button type="button" className="tably-button tably-button-primary" onClick={() => applyJSON(jsonText)}>应用配置<ArrowUpRight size={16} /></button>}</div>
    </Dialog>}

    {folder && <Dialog title={folder.title} subtitle={`${folder.children.length} 个应用，放在一起刚刚好。`} onClose={() => setFolderId(null)}>
      <div className="tably-folder-content">{folder.children.map(item => <div key={item.id}><button type="button" className="tably-app" aria-label={`打开${item.title}`} onClick={() => openLink(item)}><AppIcon item={item} /><span className="tably-app-label">{item.title}</span></button>{editable && <button type="button" className="tably-extract-button" aria-label={`将${item.title}移到桌面`} onClick={() => { change(extractFromFolder(current, folder.id, item.id, columns)); notify(`${item.title}已移到桌面`); }}><ArrowSquareOut size={13} />移出</button>}</div>)}</div>
      {editable && <div className="tably-folder-footer"><span>拖动桌面图标到文件夹上，可以继续添加。</span><button type="button" className="tably-text-button" onClick={() => { setManaged(folder); setFolderId(null); }}><PencilSimple size={15} />编辑文件夹</button></div>}
    </Dialog>}

    {managed && editable && <ManageItem item={managed} onClose={() => setManaged(null)} onRemove={() => { change(removeItem(current, managed.id)); setManaged(null); notify('已移除，可撤销恢复'); }} onSave={item => {
      const items = resolveLayout(current.items.map(i => i.id === item.id ? item : i), columns, current.settings?.layout ?? 'grid').map(l => ({ ...l.item, position: l.position }));
      change({ ...current, items }); setManaged(null); notify('已保存修改');
    }} />}
  </div>;
}

function LinkForm({ onSubmit }: { onSubmit: (item: DesktopLink) => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('browser');
  const [customIcon, setCustomIcon] = useState('');
  const [error, setError] = useState('');
  const preview: DesktopLink = { id: 'preview', type: 'link', title: title || '新网站', url, icon: customIcon || icon };
  return <form className="tably-link-form" onSubmit={e => { e.preventDefault(); const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`; if (!title.trim() || !isSafeUrl(normalized)) { setError('请填写名称和有效的网站地址。'); return; } onSubmit({ ...preview, id: uid('app'), title: title.trim(), url: normalized }); }}>
    <div className="tably-form-preview"><AppIcon item={preview} /><span>{title || '新网站'}</span></div>
    <div className="tably-form-fields"><label>网站名称<input value={title} onChange={e => setTitle(e.target.value)} placeholder="比如：我的作品集" required maxLength={80} autoFocus /></label><label>网站地址<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" required /></label></div>
    <fieldset className="tably-icon-picker"><legend>选一个图标</legend><div>{builtInIconOptions.map(name => <button type="button" key={name} aria-label={`选择${name}图标`} aria-pressed={icon === name && !customIcon} className={icon === name && !customIcon ? 'tably-selected' : ''} onClick={() => { setIcon(name); setCustomIcon(''); }}><AppIcon item={{ ...preview, icon: name }} small /></button>)}</div></fieldset>
    <label className="tably-custom-icon-label">或使用自己的图标<input value={customIcon} onChange={e => setCustomIcon(e.target.value)} placeholder="粘贴图片 URL，如 https://example.com/icon.png" /></label>
    {error && <p className="tably-form-error" role="alert">{error}</p>}
    <div className="tably-dialog-footer"><span className="tably-form-note">网站将在新标签页打开</span><button className="tably-button tably-button-primary" type="submit"><Plus size={16} />添加到桌面</button></div>
  </form>;
}

function ManageItem({ item, onClose, onSave, onRemove }: { item: DesktopItem; onClose: () => void; onSave: (item: DesktopItem) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState(item);
  const [error, setError] = useState('');
  return <Dialog title={`编辑${item.type === 'link' ? '网站' : item.type === 'folder' ? '文件夹' : '小组件'}`} onClose={onClose}>
    <form className="tably-manage-form" onSubmit={e => { e.preventDefault(); if (!draft.title.trim()) { setError('名称不能为空'); return; } if (draft.type === 'link' && !isSafeUrl(draft.url)) { setError('请输入以 http:// 或 https:// 开头的网站地址'); return; } onSave({ ...draft, title: draft.title.trim() }); }}>
      <label>名称<input value={draft.title} maxLength={80} required onChange={e => setDraft({ ...draft, title: e.target.value })} autoFocus /></label>
      {draft.type === 'link' && <><label>网站地址<input value={draft.url} required onChange={e => setDraft({ ...draft, url: e.target.value })} /></label><label>图标名称或图片 URL<input value={draft.icon ?? ''} onChange={e => setDraft({ ...draft, icon: e.target.value })} placeholder="google 或 https://…" /></label><label>图标背景色<input type="color" value={draft.color && /^#[\da-f]{6}$/i.test(draft.color) ? draft.color : '#ffffff'} onChange={e => setDraft({ ...draft, color: e.target.value })} /></label></>}
      {draft.type !== 'link' && <label>占用网格<select value={`${getItemSize(draft).width}x${getItemSize(draft).height}`} onChange={e => { const [width, height] = e.target.value.split('x').map(Number); setDraft({ ...draft, size: { width, height } }); }}>{Array.from(new Set([`${getItemSize(draft).width}x${getItemSize(draft).height}`, '2x2', '3x2', '4x2', '3x3', '4x3'])).map(size => <option value={size} key={size}>{size.replace('x', ' × ')}</option>)}</select></label>}
      {draft.type === 'folder' && <p className="tably-form-note">删除文件夹会同时移除其中的 {draft.children.length} 个应用。操作后可以撤销。</p>}
      {error && <p className="tably-form-error" role="alert">{error}</p>}
      <div className="tably-dialog-footer"><button className="tably-button tably-button-danger" type="button" onClick={onRemove}><Trash size={16} />移除</button><button className="tably-button tably-button-primary" type="submit"><Check size={16} />保存修改</button></div>
    </form>
  </Dialog>;
}
