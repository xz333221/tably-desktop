# tably-desktop

一个由 JSON 驱动的平板风 Web 桌面组件。把网站快捷方式、文件夹和小组件放进同一张可自由整理的桌面，既可以作为 React 组件使用，也可以通过一个小型 DOM 挂载 API 接入其他前端应用。

> 包名 `tably-desktop` 当前是临时命名，发布前请自行确认 npm 名称是否可用。本项目尚未发布到 npm。

## 特性

- **JSON 配置**：用 `DesktopConfig` 描述桌面，方便导入、导出和持久化。
- **自由整理**：拖动应用、文件夹和小组件；网格模式会自动对齐并避让重叠，`free` 模式保留更细的坐标。
- **拖动合并**：将一个网站链接拖到另一个链接或文件夹上并短暂停留（约 550 ms），即可创建或加入文件夹。小组件不会参与合并。
- **键盘微调**：聚焦项目后使用 `Alt + 方向键` 移动；网格模式按 1 格移动，自由模式按 0.25 单位移动。
- **网站快捷方式**：链接带标题、图标和颜色，点击后交给 `onOpenLink` 处理。图标可以是 URL、`data:image`，或 `google`、`github`、`figma` 等内置名称。
- **可扩展小组件**：内置天气（演示数据）、时钟、随手记、专注计时和日历；也可以注册自己的 React 组件。
- **三种壁纸与响应式列数**：`linen`、`sage`、`dusk`，网格列数会根据容器宽度自动收敛。
- **安全边界**：配置中的链接只接受 `http`/`https` URL；桌面不会把任意网站嵌入 iframe，也不是操作系统原生桌面。

## 安装

发布后可以通过 npm 安装。当前版本请先在本项目执行 `npm pack`，再到消费项目运行 `npm install /path/to/tably-desktop-0.1.0.tgz react react-dom`。

```bash
npm install tably-desktop react react-dom
```

React 和 React DOM 是 peer dependency。样式需要显式引入：

```ts
import 'tably-desktop/style.css';
```

## 快速开始（React）

```tsx
import { useState } from 'react';
import {
  Desktop,
  builtInWidgets,
  type DesktopConfig,
} from 'tably-desktop';
import 'tably-desktop/style.css';

const initialConfig: DesktopConfig = {
  version: 1,
  name: '我的桌面',
  items: [
    {
      id: 'google',
      type: 'link',
      title: 'Google',
      url: 'https://www.google.com',
      icon: 'google',
      position: { x: 0, y: 0 },
    },
    {
      id: 'weather',
      type: 'widget',
      title: '天气',
      widget: 'weather',
      size: { width: 3, height: 2 },
      position: { x: 2, y: 0 },
    },
  ],
  settings: { layout: 'grid', columns: 12, wallpaper: 'linen' },
};

export function App() {
  const [config, setConfig] = useState(initialConfig);

  return (
    <Desktop
      config={config}
      widgets={builtInWidgets}
      editable
      onChange={setConfig}
      onOpenLink={(link) => window.open(link.url, '_blank', 'noopener,noreferrer')}
      style={{ minHeight: '100vh' }}
    />
  );
}
```

传入 `onChange` 时，桌面发生拖动、合并或小组件属性变化会回调最新 JSON，适合由宿主保存为受控状态。省略 `onChange` 时，桌面会在组件内部维护更新；仍可通过外部 `config` 重新初始化或覆盖。`editable={false}` 会关闭拖动、合并、菜单和小组件编辑控件，适合只读展示。

## DOM 挂载 API

包内部使用 React 渲染，但 `mountDesktop` 只需要一个 DOM 元素，适合原生 JavaScript、Vue、Svelte 或其他框架的页面：

以下示例使用 Vite 等支持 npm 模块和 CSS 导入的构建工具；浏览器直接打开 HTML 无法解析裸包名。

```html
<div id="desktop" style="min-height: 100vh"></div>
<script type="module">
  import {
    mountDesktop,
    builtInWidgets,
  } from 'tably-desktop';
  import 'tably-desktop/style.css';

  const config = {
    version: 1,
    items: [
      { id: 'baidu', type: 'link', title: '百度', url: 'https://www.baidu.com', icon: 'baidu' },
      { id: 'clock', type: 'widget', title: '时钟', widget: 'clock', size: { width: 3, height: 2 } },
    ],
    settings: { layout: 'grid', wallpaper: 'sage' },
  };

  const desktop = mountDesktop(document.querySelector('#desktop'), {
    config,
    widgets: builtInWidgets,
    editable: true,
    onChange(next) {
      desktop.update({ config: next });
      localStorage.setItem('my-desktop', JSON.stringify(next));
    },
  });

  // 需要换桌面或切换只读状态时：
  // desktop.update({ config: anotherConfig, editable: false });
  // 页面卸载时：desktop.destroy();
</script>
```

`mountDesktop(element, props)` 返回 `{ update(nextProps), destroy() }`。`update` 接受 `Partial<DesktopProps>`，`destroy` 会卸载 React 根节点并清理事件。

## 配置格式

配置版本固定为 `1`。`items` 可以包含 `link`、`folder` 和 `widget`：

```json
{
  "version": 1,
  "name": "工作台",
  "items": [
    {
      "id": "search",
      "type": "link",
      "title": "Google",
      "url": "https://www.google.com",
      "icon": "google",
      "color": "#4285f4",
      "position": { "x": 0, "y": 0 }
    },
    {
      "id": "design-tools",
      "type": "folder",
      "title": "设计工具",
      "position": { "x": 1, "y": 0 },
      "size": { "width": 2, "height": 2 },
      "children": [
        {
          "id": "figma",
          "type": "link",
          "title": "Figma",
          "url": "https://www.figma.com",
          "icon": "figma"
        }
      ]
    },
    {
      "id": "weather-card",
      "type": "widget",
      "title": "天气",
      "widget": "weather",
      "props": {
        "city": "上海",
        "temp": 26,
        "high": 29,
        "low": 21,
        "condition": "多云"
      },
      "size": { "width": 3, "height": 2 },
      "position": { "x": 4, "y": 0 }
    }
  ],
  "settings": {
    "layout": "grid",
    "columns": 12,
    "rowHeight": 104,
    "gap": 16,
    "wallpaper": "linen"
  }
}
```

`settings.layout` 默认为 `grid`，也可以设为 `free`；`columns` 默认为 12，`rowHeight` 默认为 104，`gap` 默认为 16，`wallpaper` 默认为 `linen`。位置和尺寸以网格单位表示，网格模式会取整并自动寻找空位；自由模式支持小数坐标。省略尺寸时链接默认占 `1 × 1`，文件夹占 `2 × 2`；小组件优先使用注册表的 `defaultSize`，未声明时占 `2 × 2`。纯布局辅助函数不读取注册表，建议在 JSON 中显式指定小组件尺寸。较矮的桌面容器会缩小行高，窄容器会减少列数。文件夹的 `children` 仅支持链接，所有项目（包括文件夹中的链接）的 `id` 必须全局唯一。

在交给组件前可以调用 `validateConfig(value)` 检查版本、ID、URL、尺寸和 JSON 属性。列数接受 1–24 的整数，行高范围为 80–240 px，间距范围为 0–32 px。`autoArrange(config, columns?)` 会重新排列所有项目；`mergeItems(config, sourceId, targetId)` 可在自己的编辑器中复用文件夹合并逻辑。

## 自定义小组件

注册表的键就是配置中 `item.widget` 的值：

```tsx
import { builtInWidgets, type WidgetRegistry } from 'tably-desktop';

const widgets: WidgetRegistry = {
  ...builtInWidgets,
  quote: {
    title: '每日一句',
    description: '显示宿主传入的 quote 文本',
    defaultSize: { width: 3, height: 2 },
    defaultProps: { quote: '保持好奇。' },
    component: ({ item, editing, readOnly, updateProps }) => (
      <section>
        <strong>{String(item.props?.quote ?? '保持好奇。')}</strong>
        {editing && !readOnly && (
          <button type="button" data-no-drag onClick={() => updateProps({ quote: '今天也要保持好奇。' })}>
            换一句
          </button>
        )}
      </section>
    ),
  },
};
```

组件收到 `{ item, editing, readOnly, updateProps }`。自定义组件应尊重 `readOnly`：只读时禁用输入或修改操作。输入框、按钮等交互控件应加 `data-no-drag`，避免与桌面拖动手势冲突。用户通过小组件顶部的拖动手柄移动整个小组件，内容区保持可交互。把这个 `widgets` 注册表传入 `<Desktop widgets={widgets} />` 即可使用，内置组件也会默认合并到注册表中。

内置 `weather` 使用静态演示数据，不会自动请求天气服务。实时天气需要由宿主提供 API 调用和自己的小组件实现。

## 导入、导出与本地保存（示例）

```ts
function exportConfig(config: DesktopConfig) {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tably-desktop.json';
  a.click();
  URL.revokeObjectURL(url);
}

function loadConfig(raw: string): DesktopConfig {
  const result = validateConfig(JSON.parse(raw));
  if (!result.valid || !result.config) throw new Error(result.errors.join('; '));
  return result.config;
}

const saved = localStorage.getItem('my-desktop');
const config = saved ? loadConfig(saved) : initialConfig;
```

`localStorage` 只是演示用途；生产应用应根据自己的账户、权限和同步策略保存配置。

## 开发

```bash
npm install
npm test
npm run build
npm run build:demo
npm run dev
```

预览 demo 构建产物：

```bash
npm run build:demo
npm run preview
```

端到端测试使用 Chromium，覆盖桌面拖动、文件夹、表单、JSON、笔记保存、计时器及手机尺寸的交互和横向溢出：

```bash
npx playwright install chromium
npm run test:e2e
```

手机项目使用 Chromium 的触摸输入验证拖动合并，并验证响应式界面；鼠标拖到空格和 Escape 取消拖动在桌面项目执行。真实设备的兼容性仍需要设备测试。

发布前可以构建并检查 tarball 内容：

```bash
npm pack --dry-run
npm pack
```

项目包含 GitHub Actions CI（Ubuntu、Node 22），会执行安装、单元测试、库构建、demo 构建和 Chromium 端到端测试。创建自己的 GitHub 仓库后，可以按需推送：

```bash
git init
git add .
git commit -m "chore: initial tably desktop package"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

CI 不包含 npm 发布步骤；发布前请先在自己的仓库和 npm 账户中完成审核与配置。

## License

[MIT](./LICENSE)


