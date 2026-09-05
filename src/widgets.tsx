import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowCounterClockwise,
  CalendarBlank,
  CheckCircle,
  CloudSun,
  Pause,
  Play,
  NotePencil,
  Sun,
  Timer,
  Wind,
} from '@phosphor-icons/react';
import type {
  DesktopWidget,
  JsonValue,
  WidgetDefinition,
  WidgetRegistry,
  WidgetRenderProps,
} from './types';
import './widgets.css';

type Props = Record<string, JsonValue>;

function widgetProps(item: DesktopWidget): Props {
  return item.props ?? {};
}

function stringProp(props: Props, key: string, fallback: string): string {
  const value = props[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberProp(props: Props, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const widgetCard = (children: ReactNode, className = '') => (
  <section className={`tably-widget-card ${className}`}>{children}</section>
);

function WeatherWidget({ item }: WidgetRenderProps) {
  const props = widgetProps(item);
  const city = stringProp(props, 'city', '北京');
  const temp = numberProp(props, 'temp', numberProp(props, 'temperature', 24));
  const high = numberProp(props, 'high', 27);
  const low = numberProp(props, 'low', 18);
  const condition = stringProp(props, 'condition', '晴间多云');
  const samples = [
    ['现在', temp],
    ['14:00', temp + 1],
    ['16:00', Math.max(low, temp - 1)],
    ['18:00', Math.max(low, temp - 3)],
  ];
  return widgetCard(
    <div className="tably-weather">
      <div className="tably-weather-head">
        <div>
          <span className="tably-eyebrow">演示天气 · {city}</span>
          <h2>{condition}</h2>
          <p className="tably-weather-range">最高 {high}° · 最低 {low}°</p>
        </div>
        <div className="tably-weather-sun" aria-hidden="true"><Sun weight="fill" /></div>
      </div>
      <div className="tably-weather-temp"><strong>{temp}°</strong><span>体感舒适，微风</span></div>
      <div className="tably-weather-hourly" aria-label="小时预报（演示数据）">
        {samples.map(([label, value], index) => (
          <div className="tably-hour" key={`${label}-${index}`}><span>{label}</span><CloudSun weight="duotone" /><b>{value}°</b></div>
        ))}
      </div>
      <div className="tably-weather-foot"><Wind /> <span>12 km/h · 演示数据</span></div>
    </div>,
    'tably-widget-weather',
  );
}

function ClockWidget({ item }: WidgetRenderProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const seconds = now.toLocaleTimeString([], { second: '2-digit' });
  const date = now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
  return widgetCard(
    <div className="tably-clock">
      <div className="tably-clock-icon"><Timer weight="duotone" /></div>
      <span className="tably-eyebrow">现在</span>
      <div className="tably-clock-time">{time}<small>:{seconds}</small></div>
      <div className="tably-clock-date">{date}</div>
      <div className="tably-clock-zone">本地时间 · {Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'}</div>
    </div>,
    'tably-widget-clock',
  );
}

function NotesWidget({ item, updateProps, readOnly = false }: WidgetRenderProps) {
  const props = widgetProps(item);
  const initial = typeof props.text === 'string' ? props.text : '';
  const [text, setText] = useState(initial);
  useEffect(() => {
    setText(typeof props.text === 'string' ? props.text : '');
  }, [props.text]);
  return widgetCard(
    <div className="tably-notes">
      <div className="tably-notes-title"><span>随手记</span><NotePencil weight="duotone" /></div>
      <textarea
        data-no-drag
        aria-label="笔记内容"
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          if (readOnly) return;
          setText(value);
          updateProps({ text: value });
        }}
        onPointerDown={(event) => event.stopPropagation()}
        placeholder="写下你的想法…"
        readOnly={readOnly}
      />
      <div className="tably-notes-meta">记录灵感 · {text.length} 字</div>
    </div>,
    'tably-widget-notes',
  );
}

function FocusWidget({ item }: WidgetRenderProps) {
  const props = widgetProps(item);
  const configuredMinutes = Math.max(1, numberProp(props, 'minutes', 25));
  const totalSeconds = Math.round(configuredMinutes * 60);
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  useEffect(() => {
    deadlineRef.current = null;
    setRemaining(totalSeconds);
    setRunning(false);
  }, [totalSeconds]);
  useEffect(() => {
    if (!running) return undefined;
    deadlineRef.current = Date.now() + remaining * 1000;
    const id = window.setInterval(() => {
      const deadline = deadlineRef.current ?? Date.now();
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0) {
        deadlineRef.current = null;
        setRunning(false);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;
  const circumference = 2 * Math.PI * 38;
  const toggle = () => {
    if (running) {
      if (deadlineRef.current !== null) setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      setRunning(false);
      deadlineRef.current = null;
      return;
    }
    if (remaining === 0) setRemaining(totalSeconds);
    setRunning(true);
  };
  return widgetCard(
    <div className="tably-focus">
      <div className="tably-focus-head"><span className="tably-eyebrow">专注时段</span><CheckCircle weight="duotone" /></div>
      <div className="tably-focus-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="tably-focus-track" cx="50" cy="50" r="38" /><circle className="tably-focus-progress" cx="50" cy="50" r="38" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} /></svg>
        <div className="tably-focus-time"><strong>{minutes}:{seconds}</strong><small>{running ? '进行中' : remaining === 0 ? '完成' : '准备好了吗？'}</small></div>
      </div>
      <div className="tably-focus-actions">
        <button data-no-drag type="button" className="tably-button tably-button-primary" onPointerDown={(event) => event.stopPropagation()} onClick={toggle}>{running ? <Pause weight="fill" /> : <Play weight="fill" />}<span>{running ? '暂停' : '开始'}</span></button>
        <button data-no-drag type="button" className="tably-button tably-button-ghost" aria-label="重置计时" onPointerDown={(event) => event.stopPropagation()} onClick={() => { deadlineRef.current = null; setRemaining(totalSeconds); setRunning(false); }}><ArrowCounterClockwise /></button>
      </div>
    </div>,
    'tably-widget-focus',
  );
}

function CalendarWidget({ item }: WidgetRenderProps) {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const start = (first.getDay() + 6) % 7;
  const cells: Array<number | null> = [...Array(start).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthLabel = today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  return widgetCard(
    <div className="tably-calendar">
      <div className="tably-calendar-head"><div><span className="tably-eyebrow">日历</span><h2>{monthLabel}</h2></div><CalendarBlank weight="duotone" /></div>
      <div className="tably-calendar-week">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="tably-calendar-grid">{cells.map((day, index) => <span key={`${day ?? 'blank'}-${index}`} className={day === today.getDate() ? 'is-today' : ''}>{day}</span>)}</div>
    </div>,
    'tably-widget-calendar',
  );
}

const definition = (title: string, component: WidgetDefinition['component'], defaultProps?: Props, defaultSize = { width: 3, height: 2 }, description?: string): WidgetDefinition => ({ title, component, defaultProps, defaultSize, description });

export const builtInWidgets: WidgetRegistry = {
  weather: definition('天气', WeatherWidget, { city: '北京', temp: 24, high: 27, low: 18, condition: '晴间多云' }, undefined, '一眼查看今天的演示天气'),
  clock: definition('时钟', ClockWidget, undefined, undefined, '本地时间与日期'),
  notes: definition('随手记', NotesWidget, { text: '把今天最重要的一件事写下来…' }, undefined, '轻松记下灵感与待办'),
  focus: definition('专注计时', FocusWidget, { minutes: 25 }, undefined, '25 分钟专注节奏'),
  calendar: definition('日历', CalendarWidget, undefined, { width: 3, height: 3 }, '今天与本月的日期'),
};

export { WeatherWidget, ClockWidget, NotesWidget, FocusWidget, CalendarWidget };



