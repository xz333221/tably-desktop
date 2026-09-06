import { useCallback, useState, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Desktop, validateConfig, type DesktopConfig } from '../src';
import { initialConfig } from './config';
import './demo.css';

const STORAGE_KEY = 'tably.desktop.v1';
function loadConfig(): DesktopConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { const result = validateConfig(JSON.parse(saved)); if (result.valid && result.config) return result.config; }
  } catch { /* Storage can be disabled by the embedding browser. */ }
  return initialConfig;
}
function Demo() {
  const [config, setConfig] = useState(loadConfig);
  const [storageError, setStorageError] = useState(false);
  const onChange = useCallback((next: DesktopConfig) => {
    setConfig(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }, []);
  const minimal = new URLSearchParams(window.location.search).has('minimal');
  return <><Desktop config={config} onChange={onChange} minimal={minimal} />{storageError && <div className="demo-storage-error" role="status">浏览器存储不可用，请导出 JSON 保存桌面。</div>}</>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
