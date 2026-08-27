/**
 * 桌宠交互引导测试 (v2.25.0)
 *
 * 测试范围：
 * 1. 步骤 5→6 衔接：点击「继续探索」后进入桌宠引导
 * 2. 双击桌宠进入步骤 7：日报弹窗展示
 * 3. 关闭日报进入步骤 8：说明拖动和点击交互
 * 4. 完成引导：点击「完成引导」后引导关闭
 * 5. 小窗口桌宠引导：320px 宽度下步骤 6-8 正常
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// 辅助：获取 file:// URL
function getPageUrl(file) {
  return 'file://' + path.resolve(__dirname, '..', 'src', file);
}

// 辅助：检测两个矩形是否重叠
function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    a.x >= b.x + b.width ||
    a.y + a.height <= b.y ||
    a.y >= b.y + b.height
  );
}

// 每个测试前清除 localStorage，模拟首次访问
test.beforeEach(async ({ page }) => {
  await page.goto(getPageUrl('index.html'));
  await page.evaluate(function () {
    localStorage.clear();
  });
  await page.reload();
  // 等待引导启动（延迟 600ms）
  await page.waitForTimeout(800);
});

// 辅助：快速走到步骤 5（全部搞定）
async function goToStep5(page) {
  await page.locator('.guide-card__btn--primary').click();
  await page.waitForTimeout(400);
  await page.locator('#todoInput').fill('测试待办');
  await page.locator('#todoInput').press('Enter');
  await page.waitForTimeout(800);
  await page.locator('.guide-card__btn--primary').click();
  await page.waitForTimeout(400);
  await page.locator('#datetimeTrigger').click();
  await page.waitForTimeout(500);
}

test.describe('桌宠引导流程', function () {

  test('1. 步骤 5→6 衔接：点击「继续探索」进入桌宠引导', async ({ page }) => {
    await goToStep5(page);

    // 第五步：全部搞定
    await expect(page.locator('.guide-card__title')).toHaveText('全部搞定');
    await expect(page.locator('.guide-card__badge')).toContainText('5/8');

    // 点击「继续探索」
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 第六步：你的小伙伴（步骤 6 会隐藏引导层让用户点击桌宠，所以检查标题和徽章）
    await expect(page.locator('.guide-card__title')).toHaveText('你的小伙伴 🐾');
    await expect(page.locator('.guide-card__badge')).toContainText('6/8');

    // 桌宠应可见且可交互
    await expect(page.locator('#stitchPet')).toBeVisible();
  });

  test('2. 双击桌宠后展示日报弹窗并进入步骤 7', async ({ page }) => {
    await goToStep5(page);

    // 进入步骤 6
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.guide-card__title')).toHaveText('你的小伙伴 🐾');

    // 双击桌宠
    await page.locator('#stitchPet').dblclick();
    await page.waitForTimeout(800);

    // 日报弹窗应显示
    await expect(page.locator('#dailyReportModal')).toBeVisible();

    // 步骤 7：每日日报
    await expect(page.locator('.guide-card__title')).toHaveText('每日日报 📊');
    await expect(page.locator('.guide-card__badge')).toContainText('7/8');
  });

  test('3. 关闭日报弹窗后进入步骤 8（和史迪奇玩耍）', async ({ page }) => {
    await goToStep5(page);

    // 进入步骤 6 → 7
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#stitchPet').dblclick();

    // 等待日报弹窗出现（步骤 7 需要先打开弹窗再切换）
    await page.locator('#dailyReportModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500); // 额外等待步骤切换动画

    // 步骤 7：每日日报
    await expect(page.locator('.guide-card__title')).toHaveText('每日日报 📊');

    // 关闭日报弹窗
    await page.locator('#dailyReportOk').click();
    await page.waitForTimeout(800);

    // 步骤 8：和史迪奇玩耍
    await expect(page.locator('.guide-card__title')).toHaveText('和史迪奇玩耍 🎮');
    await expect(page.locator('.guide-card__badge')).toContainText('8/8');

    // spotlight 应在桌宠上
    var spBox = await page.locator('.guide-spotlight').boundingBox();
    var petBox = await page.locator('#stitchPet').boundingBox();
    expect(Math.abs(spBox.x - petBox.x)).toBeLessThan(20);
    expect(Math.abs(spBox.y - petBox.y)).toBeLessThan(20);
  });

  test('4. 点击「完成引导」后引导完全关闭', async ({ page }) => {
    await goToStep5(page);

    // 走完步骤 6-8
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#stitchPet').dblclick();

    // 等待日报弹窗出现
    await page.locator('#dailyReportModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    // 关闭日报弹窗
    await page.locator('#dailyReportOk').click({ force: true });
    await page.locator('#dailyReportModal').waitFor({ state: 'hidden', timeout: 5000 });

    // 等待引导层恢复显示（步骤 8 卡片）
    await page.locator('.guide-card__btn--primary').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    // 点击「完成引导」
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 引导卡片应被移除
    var cardCount = await page.locator('.guide-card').count();
    expect(cardCount).toBe(0);
    // spotlight 也不应存在
    var spotlightCount = await page.locator('.guide-spotlight').count();
    expect(spotlightCount).toBe(0);

    // localStorage 应记录引导完成
    var tourDone = await page.evaluate(function () {
      return localStorage.getItem('guide_tour_done');
    });
    expect(tourDone).toBe('1');
  });

  test('5. 小窗口下桌宠引导步骤可正常进行', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.evaluate(function () { localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(800);

    await goToStep5(page);

    // 进入步骤 6（引导层会隐藏，让用户点击桌宠）
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await expect(page.locator('.guide-card__title')).toHaveText('你的小伙伴 🐾');

    // 桌宠应在视口内
    var petBox = await page.locator('#stitchPet').boundingBox();
    var vp = await page.evaluate(function () { return { w: window.innerWidth, h: window.innerHeight }; });
    expect(petBox.x).toBeGreaterThanOrEqual(-1);
    expect(petBox.x + petBox.width).toBeLessThanOrEqual(vp.w + 1);
    expect(petBox.y).toBeGreaterThanOrEqual(-1);
    expect(petBox.y + petBox.height).toBeLessThanOrEqual(vp.h + 1);

    // 双击桌宠进入步骤 7
    await page.locator('#stitchPet').dblclick();
    await page.locator('#dailyReportModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    // 关闭日报弹窗进入步骤 8
    await page.locator('#dailyReportOk').click({ force: true });
    await page.locator('#dailyReportModal').waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('.guide-card__btn--primary').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    // 步骤 8 卡片应在视口内
    await expect(page.locator('.guide-card__title')).toHaveText('和史迪奇玩耍 🎮');
    var cardBox = await page.locator('.guide-card').boundingBox();
    expect(cardBox.x).toBeGreaterThanOrEqual(-1);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(vp.w + 1);
    expect(cardBox.y).toBeGreaterThanOrEqual(-1);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(vp.h + 1);
  });
});
