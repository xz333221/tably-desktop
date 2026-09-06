import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'tably.desktop.v1';

async function openFresh(page: Page) {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await expect(page.getByRole('button', { name: '打开Google', exact: true })).toBeVisible();
}

async function savedConfig(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY) as Promise<any>;
}

test.describe('tably desktop demo', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
  });

  test('renders initial links, folders and widgets', async ({ page }) => {
    await expect(page.getByRole('button', { name: '打开百度', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /打开文件夹灵感收集，6个应用/ })).toBeVisible();
    await expect(page.getByRole('article', { name: '今日天气', exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: '随手记', exact: true })).toBeVisible();
  });

  test('adds a custom site and restores it after reload', async ({ page }) => {
    await page.getByRole('button', { name: /^添加\s*(到桌面)?$/ }).first().click();
    await page.getByLabel('网站名称').fill('项目主页');
    await page.getByLabel('网站地址').fill('https://example.com/project');
    await page.getByRole('button', { name: '添加到桌面', exact: true }).last().click();
    await expect(page.getByRole('button', { name: '打开项目主页', exact: true })).toBeVisible();
    const config = await savedConfig(page);
    expect(config.items.some((item: any) => item.title === '项目主页' && item.url === 'https://example.com/project')).toBe(true);

    await page.reload();
    await expect(page.getByRole('button', { name: '打开项目主页', exact: true })).toBeVisible();
  });

  test('rejects malformed JSON and applies valid JSON', async ({ page }) => {
    await page.getByRole('button', { name: '桌面 JSON 配置', exact: true }).click();
    const editor = page.getByRole('textbox', { name: '桌面 JSON', exact: true });
    await editor.fill('{"version":');
    await page.getByRole('button', { name: /应用配置/ }).click();
    await expect(page.getByRole('alert')).toContainText('JSON 格式有误');

    const replacement = { version: 1, items: [{ id: 'only', type: 'link', title: '唯一入口', url: 'https://example.com', icon: 'globe' }] };
    await editor.fill(JSON.stringify(replacement));
    await page.getByRole('button', { name: /应用配置/ }).click();
    await expect(page.getByRole('button', { name: '打开唯一入口', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '打开Google', exact: true })).toHaveCount(0);
    const config = await savedConfig(page);
    expect(config.items).toHaveLength(1);
    expect(config.items[0].id).toBe('only');
  });

  test('merges two links into a folder with pointer or touch dragging', async ({ page, isMobile }) => {
    const source = page.getByRole('button', { name: '打开Google', exact: true });
    const target = page.getByRole('button', { name: '打开百度', exact: true });
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    const from = { x: sourceBox!.x + sourceBox!.width / 2, y: sourceBox!.y + sourceBox!.height / 2 };
    const to = { x: targetBox!.x + targetBox!.width / 2, y: targetBox!.y + targetBox!.height / 2 };
    if (isMobile) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 0 }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8, id: 0 }] });
      }
      await page.waitForTimeout(650);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.waitForTimeout(650);
      await page.mouse.up();
    }

    await expect(page.getByRole('button', { name: /打开文件夹百度，2个应用/ })).toBeVisible();
    const config = await savedConfig(page);
    const folder = config.items.find((item: any) => item.type === 'folder' && item.children.some((child: any) => child.id === 'google'));
    expect(folder?.children.map((item: any) => item.id)).toEqual(['baidu', 'google']);
  });

  test('moves an app to an empty grid cell and saves its position', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mouse drag is verified by the desktop project; mobile verifies responsive UI flows.');
    const source = page.getByRole('button', { name: '打开Figma', exact: true });
    const sourceBox = await source.boundingBox();
    const gridBox = await page.locator('.tably-grid').boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(gridBox).not.toBeNull();
    // Column index 5 in the first row is intentionally empty in the demo config.
    const columns = 12;
    const pitch = gridBox!.width / columns;
    const x = gridBox!.x + pitch * 5.5;
    const y = sourceBox!.y + sourceBox!.height / 2;
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText('桌面布局已更新')).toBeVisible();
    const config = await savedConfig(page);
    const figma = config.items.find((item: any) => item.id === 'figma');
    expect(figma.position.x).toBe(5);
    expect(figma.position.y).toBe(0);
  });

  test('opens a folder and extracts a child to the desktop', async ({ page }) => {
    await page.getByRole('button', { name: /打开文件夹灵感收集，6个应用/ }).click();
    await expect(page.getByRole('heading', { name: '灵感收集', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '将Dribbble移到桌面', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: '打开Dribbble', exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toContainText('5 个应用');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByRole('button', { name: '打开Dribbble', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '灵感收集', exact: true })).toHaveCount(0);
    const config = await savedConfig(page);
    expect(config.items.some((item: any) => item.id === 'dribbble')).toBe(true);
    expect(config.items.find((item: any) => item.id === 'inspiration')?.children).toHaveLength(5);
  });

  test('moves a focused app with Alt and arrow keys', async ({ page }) => {
    const google = page.getByRole('button', { name: '打开Google', exact: true });
    await google.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(async () => (await savedConfig(page))?.items.find((item: any) => item.id === 'google')?.position).toEqual({ x: 1, y: 0 });
    await page.reload();
    await expect(page.getByRole('button', { name: '打开Google', exact: true })).toBeVisible();
    expect((await savedConfig(page)).items.find((item: any) => item.id === 'google')?.position).toEqual({ x: 1, y: 0 });
  });

  test('cancels an active drag with Escape without saving changes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard cancellation is verified with a physical-pointer desktop interaction.');
    const source = page.getByRole('button', { name: '打开Google', exact: true });
    const sourceBox = await source.boundingBox();
    expect(sourceBox).not.toBeNull();
    const before = await page.locator('[data-item-id="google"]').getAttribute('style');
    const from = { x: sourceBox!.x + sourceBox!.width / 2, y: sourceBox!.y + sourceBox!.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 120, from.y + 30, { steps: 8 });
    await expect(page.locator('[data-item-id="google"]')).toHaveClass(/tably-tile--dragging/);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('[data-item-id="google"]')).not.toHaveClass(/tably-tile--dragging/);
    expect(await savedConfig(page)).toBeNull();
    expect(await page.locator('[data-item-id="google"]').getAttribute('style')).toBe(before);
  });

  test('persists notes and supports focus start, pause and reset', async ({ page }) => {
    const notes = page.getByRole('article', { name: '随手记', exact: true });
    const text = notes.getByRole('textbox', { name: '笔记内容', exact: true });
    await text.fill('由 E2E 测试写入');
    await expect.poll(async () => (await savedConfig(page)).items.find((item: any) => item.id === 'notes')?.props?.text).toBe('由 E2E 测试写入');
    await page.reload();
    await expect(page.getByRole('article', { name: '随手记', exact: true }).getByRole('textbox', { name: '笔记内容', exact: true })).toHaveValue('由 E2E 测试写入');

    const focus = page.getByRole('article', { name: '专注片刻', exact: true });
    await focus.getByRole('button', { name: '开始', exact: true }).click();
    await expect(focus.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
    await focus.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(focus.getByRole('button', { name: '开始', exact: true })).toBeVisible();
    await focus.getByRole('button', { name: '重置计时', exact: true }).click();
    await expect(focus).toContainText('25:00');
  });

  test('switches to free layout and avoids horizontal page overflow on mobile', async ({ page }) => {
    await page.getByRole('button', { name: '外观', exact: true }).click();
    await page.getByRole('button', { name: /自由摆放/ }).click();
    await expect(page.getByRole('button', { name: /自由摆放/ })).toHaveAttribute('aria-pressed', 'true');
    expect((await savedConfig(page)).settings.layout).toBe('free');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('button', { name: '打开Google', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('minimal mode keeps only the desktop and exposes actions through context menus', async ({ page }) => {
    await page.goto('/?minimal=1');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await expect(page.getByRole('button', { name: '打开Google', exact: true })).toBeVisible();
    await expect(page.locator('.tably-topbar')).toHaveCount(0);
    await expect(page.locator('.tably-intro')).toHaveCount(0);
    await expect(page.locator('.tably-section-bar')).toHaveCount(0);
    await expect(page.locator('.tably-desk-hint')).toHaveCount(0);
    await expect(page.locator('.tably-bottom-caption')).toHaveCount(0);
    await expect(page.locator('.tably-bottom-mode')).toHaveCount(0);
    await expect(page.locator('.tably-item-menu')).toHaveCount(0);

    await page.locator('.tably-workspace').click({ button: 'right', position: { x: 10, y: 10 } });
    const menu = page.getByRole('menu', { name: '桌面操作' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: '添加网站' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '关闭', exact: true }).click();

    await page.getByRole('button', { name: '打开Google', exact: true }).click({ button: 'right' });
    const itemMenu = page.getByRole('menu', { name: '桌面操作' });
    await expect(itemMenu).toContainText('Google');
    await itemMenu.getByRole('menuitem', { name: '编辑', exact: true }).click();
    await expect(page.getByRole('heading', { name: '编辑网站', exact: true })).toBeVisible();
  });
});

