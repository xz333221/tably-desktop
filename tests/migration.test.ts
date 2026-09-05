import { describe, expect, it } from 'vitest';
import { migrateLegacyHomeConfig } from '../src/migration';

describe('migrateLegacyHomeConfig', () => {
  it('maps old links and components to stable v1 items', () => {
    const result = migrateLegacyHomeConfig({ front_config: {
      title: '旧首页', columns: 10,
      open_url_list: [{ id: 'a', title: '百度', url: 'https://baidu.com', icon_url: 'https://baidu.com/i.png' }],
      user_url_list: [{ name: '重复 ID', href: 'https://example.com', id: 'a' }],
      componentsList: [{ component: 'Weather', row: 2, col: 4, config: { city: '杭州' } }, { component: 'Calendar', row: 3, col: 3 }],
    } });
    expect(result.config.version).toBe(1);
    expect(result.config.name).toBe('旧首页');
    expect(result.config.items.map(item => item.type)).toEqual(['link', 'link', 'widget', 'widget']);
    expect(new Set(result.config.items.map(item => item.id)).size).toBe(4);
    expect(result.config.items[2]).toMatchObject({ widget: 'weather', size: { width: 4, height: 2 }, props: { city: '杭州' } });
    expect(result.warnings).toHaveLength(0);
  });

  it('skips unsafe or malformed URLs without throwing', () => {
    const result = migrateLegacyHomeConfig({ open_url_list: [null, { title: 'bad', url: 'javascript:alert(1)' }, { url: 'https://valid.example' }] });
    expect(result.config.items).toHaveLength(1);
    expect(result.skipped).toBe(2);
    expect(result.warnings.join(' ')).toContain('无效网站地址');
  });

  it('accepts the nested user config shape used by the old server', () => {
    const result = migrateLegacyHomeConfig({ config: { front_config: { open_url_list: [{ url: 'https://example.com', title: 'Example' }] } } });
    expect(result.config.items[0]).toMatchObject({ title: 'Example', url: 'https://example.com', position: { x: 0, y: 0 } });
  });
});
