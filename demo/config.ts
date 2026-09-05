import type { DesktopConfig } from '../src';

export const initialConfig: DesktopConfig = {
  version: 1,
  name: '你的日常，自成一桌',
  settings: { layout: 'grid', columns: 12, rowHeight: 108, gap: 18, wallpaper: 'linen' },
  items: [
    { id: 'google', type: 'link', title: 'Google', url: 'https://www.google.com', icon: 'google', position: { x: 0, y: 0 } },
    { id: 'baidu', type: 'link', title: '百度', url: 'https://www.baidu.com', icon: 'baidu', position: { x: 1, y: 0 } },
    { id: 'notion', type: 'link', title: 'Notion', url: 'https://www.notion.so', icon: 'notion', position: { x: 2, y: 0 } },
    { id: 'figma', type: 'link', title: 'Figma', url: 'https://www.figma.com', icon: 'figma', position: { x: 3, y: 0 } },
    { id: 'github', type: 'link', title: 'GitHub', url: 'https://github.com', icon: 'github', position: { x: 4, y: 0 } },
    { id: 'weather', type: 'widget', title: '今日天气', widget: 'weather', position: { x: 6, y: 0 }, size: { width: 3, height: 2 }, props: { city: '杭州', temperature: 24, condition: '晴间多云', high: 27, low: 19 } },
    { id: 'calendar', type: 'widget', title: '日历', widget: 'calendar', position: { x: 9, y: 0 }, size: { width: 3, height: 2 } },
    { id: 'inspiration', type: 'folder', title: '灵感收集', position: { x: 0, y: 1 }, size: { width: 2, height: 2 }, children: [
      { id: 'dribbble', type: 'link', title: 'Dribbble', url: 'https://dribbble.com', icon: 'dribbble' },
      { id: 'pinterest', type: 'link', title: 'Pinterest', url: 'https://pinterest.com', icon: 'pinterest' },
      { id: 'behance', type: 'link', title: 'Behance', url: 'https://behance.net', icon: 'behance' },
      { id: 'unsplash', type: 'link', title: 'Unsplash', url: 'https://unsplash.com', icon: 'camera', color: '#dedcce' },
      { id: 'awwwards', type: 'link', title: 'Awwwards', url: 'https://awwwards.com', icon: 'planet', color: '#e8e5f1' },
      { id: 'are-na', type: 'link', title: 'Are.na', url: 'https://www.are.na', icon: 'image' },
    ] },
    { id: 'spotify', type: 'link', title: 'Spotify', url: 'https://open.spotify.com', icon: 'spotify', position: { x: 2, y: 1 } },
    { id: 'youtube', type: 'link', title: 'YouTube', url: 'https://youtube.com', icon: 'youtube', position: { x: 3, y: 1 } },
    { id: 'bilibili', type: 'link', title: '哔哩哔哩', url: 'https://www.bilibili.com', icon: 'bilibili', position: { x: 4, y: 1 } },
    { id: 'read', type: 'link', title: '读点什么', url: 'https://weread.qq.com', icon: 'read', position: { x: 2, y: 2 } },
    { id: 'mail', type: 'link', title: '邮箱', url: 'https://mail.google.com', icon: 'mail', position: { x: 3, y: 2 } },
    { id: 'notes', type: 'widget', title: '随手记', widget: 'notes', position: { x: 6, y: 2 }, size: { width: 3, height: 2 }, props: { text: '把脑海里的小想法，\n放在看得见的地方。\n\n今天也要留一点时间给自己。' } },
    { id: 'focus', type: 'widget', title: '专注片刻', widget: 'focus', position: { x: 9, y: 2 }, size: { width: 3, height: 2 }, props: { minutes: 25 } },
  ],
};
