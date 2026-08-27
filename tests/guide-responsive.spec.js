/**
 * 引导系统响应式测试 - 小窗口适配
 *
 * 测试范围：
 * 1. 小窗口下卡片不溢出视口
 * 2. 小窗口下高亮框正确显示
 * 3. 卡片定位在视口边界内
 * 4. 窄屏下卡片宽度自适应
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

function getPageUrl(file) {
  return 'file://' + path.resolve(__dirname, '..', 'src', file);
}

// 清除 localStorage，模拟首次访问
async function freshVisit(page, file) {
  await page.goto(getPageUrl(file));
  await page.evaluate(function () { localStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(800);
}

test.describe('小窗口适配', function () {

  test('1. 320px 宽度下卡片应在视口内', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await freshVisit(page, 'index.html');

    const card = page.locator('.guide-card');
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    const vp = await page.evaluate(function () { return { w: window.innerWidth, h: window.innerHeight }; });

    // 卡片右边缘不超出视口
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(vp.w + 1);
    // 卡片左边缘不超出视口
    expect(cardBox.x).toBeGreaterThanOrEqual(-1);
    // 卡片下边缘不超出视口
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(vp.h + 1);
  });

  test('2. 320px 宽度下高亮框应在视口内', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await freshVisit(page, 'index.html');

    // 进入第二步（高亮输入框）
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    const spotlight = page.locator('.guide-spotlight');
    await expect(spotlight).toBeVisible();

    const spBox = await spotlight.boundingBox();
    const vp = await page.evaluate(function () { return { w: window.innerWidth, h: window.innerHeight }; });

    // spotlight 应在视口内（允许部分溢出因为 box-shadow 遮罩）
    expect(spBox.x).toBeGreaterThanOrEqual(-20);
    expect(spBox.y).toBeGreaterThanOrEqual(-20);
    expect(spBox.x + spBox.width).toBeLessThanOrEqual(vp.w + 20);
  });

  test('3. 375px 宽度下步骤 3 卡片应在视口内', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await freshVisit(page, 'index.html');

    // 进入第三步
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);

    const card = page.locator('.guide-card');
    await expect(card).toBeVisible();
    await expect(card.locator('.guide-card__title')).toHaveText('事项操作');

    const cardBox = await card.boundingBox();
    const vp = await page.evaluate(function () { return { w: window.innerWidth, h: window.innerHeight }; });

    // 卡片应在视口边界内
    expect(cardBox.x).toBeGreaterThanOrEqual(-1);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(vp.w + 1);
    expect(cardBox.y).toBeGreaterThanOrEqual(-1);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(vp.h + 1);
  });

  test('4. 卡片宽度应适应窄屏', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await freshVisit(page, 'index.html');

    const card = page.locator('.guide-card');
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    const vp = await page.evaluate(function () { return { w: window.innerWidth }; });

    // 卡片宽度不应超过视口宽度
    expect(cardBox.width).toBeLessThanOrEqual(vp.w);
  });

  test('5. 480px 宽度下全部 8 个步骤可走通', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await freshVisit(page, 'index.html');

    // 步骤 1 → 2
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    // 步骤 2 → 3（输入并回车）
    await page.locator('#todoInput').fill('测试');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);
    // 步骤 3 → 4
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    // 步骤 4 → 5（点击时间管理按钮）
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(500);
    // 步骤 5 → 6（点击「继续探索」）
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    // 步骤 6 → 7（双击桌宠）
    await page.locator('#stitchPet').dblclick();
    await page.locator('#dailyReportModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    // 步骤 7 → 8（关闭日报弹窗）
    await page.locator('#dailyReportOk').click({ force: true });
    await page.locator('#dailyReportModal').waitFor({ state: 'hidden', timeout: 5000 });
    // 等待引导层恢复显示
    await page.locator('.guide-card__btn--primary').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    // 步骤 8：完成引导
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 引导应完成
    const cardCount = await page.locator('.guide-card').count();
    expect(cardCount).toBe(0);
  });
});
