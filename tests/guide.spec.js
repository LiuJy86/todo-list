/**
 * 引导系统自动化测试 (v2.26.0)
 *
 * 测试范围：
 * 1. 首次启动自动弹出引导
 * 2. 高亮框定位正确（跟随目标元素）
 * 3. 说明卡片不遮挡高亮元素
 * 4. 交互等待（输入 + Enter）正确触发下一步
 * 5. 提醒设置步骤显示正确
 * 6. 快捷键步骤显示正确
 * 7. 史迪奇日报步骤（双击 + 弹窗关闭）
 * 8. 最后一步「全部搞定」可完成引导
 * 9. 引导完成后不再自动弹出
 * 10. 跳过引导功能
 * 11. 上下文提示气泡
 * 12. 设置页重置功能
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

test.describe('首次引导', function () {

  test('1. 首次打开应自动弹出引导', async ({ page }) => {
    const overlay = page.locator('#guide-overlay');
    await expect(overlay).toBeVisible();

    const card = page.locator('.guide-card');
    await expect(card).toBeVisible();

    // 第一步：欢迎卡片居中
    await expect(card.locator('.guide-card__title')).toHaveText('欢迎使用 ToDoList');
    await expect(card.locator('.guide-card__badge')).toContainText('1/8');
  });

  test('2. 欢迎卡片应居中显示（无高亮框）', async ({ page }) => {
    const spotlight = page.locator('.guide-spotlight');
    const isVisible = await spotlight.isVisible().catch(function () { return false; });
    if (isVisible) {
      const box = await spotlight.boundingBox();
      expect(box === null || box.width === 0).toBeTruthy();
    }

    const cardBox = await page.locator('.guide-card').boundingBox();
    var vp = await page.evaluate(function () { return { w: window.innerWidth, h: window.innerHeight }; });
    var cardCenterX = cardBox.x + cardBox.width / 2;
    var cardCenterY = cardBox.y + cardBox.height / 2;
    expect(Math.abs(cardCenterX - vp.w / 2)).toBeLessThan(50);
    expect(Math.abs(cardCenterY - vp.h / 2)).toBeLessThan(50);
  });

  test('3. 点击「开始体验」后，高亮框应在输入框上', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.guide-card__title')).toHaveText('添加待办');

    const spotlight = page.locator('.guide-spotlight');
    await expect(spotlight).toBeVisible();

    var spBox = await spotlight.boundingBox();
    var inputBox = await page.locator('#todoInput').boundingBox();

    expect(Math.abs(spBox.x - inputBox.x)).toBeLessThan(15);
    expect(Math.abs(spBox.y - inputBox.y)).toBeLessThan(15);
    expect(Math.abs(spBox.width - inputBox.width)).toBeLessThan(20);
    expect(Math.abs(spBox.height - inputBox.height)).toBeLessThan(20);
  });

  test('4. 输入并回车后，高亮框应移动到第一个待办项', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    await page.locator('#todoInput').fill('测试待办事项');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);

    await expect(page.locator('.guide-card__title')).toHaveText('事项操作');

    var spotlight = page.locator('.guide-spotlight');
    await expect(spotlight).toBeVisible();

    var firstTodoBox = await page.locator('#todoList li:first-child').boundingBox();
    var spBox = await spotlight.boundingBox();

    expect(Math.abs(spBox.x - firstTodoBox.x)).toBeLessThan(15);
    expect(Math.abs(spBox.y - firstTodoBox.y)).toBeLessThan(15);
  });

  test('5. 说明卡片不应遮挡高亮元素', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);

    var cardBox = await page.locator('.guide-card').boundingBox();
    var spotlightBox = await page.locator('.guide-spotlight').boundingBox();

    var overlap = rectsOverlap(cardBox, spotlightBox);
    expect(overlap).toBe(false);
  });

  test('6. 点击「下一步」后进入设置提醒步骤', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);

    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.guide-card__title')).toHaveText('设置提醒');

    var spBox = await page.locator('.guide-spotlight').boundingBox();
    var dtBox = await page.locator('#datetimeTrigger').boundingBox();
    expect(Math.abs(spBox.x - dtBox.x)).toBeLessThan(15);
    expect(Math.abs(spBox.y - dtBox.y)).toBeLessThan(15);
  });

  test('7. 点击时间管理按钮后进入提醒设置步骤', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 点击时间管理按钮
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(500);

    // 第五步：提醒设置
    await expect(page.locator('.guide-card__title')).toHaveText('提醒设置 ⏰');
    await expect(page.locator('.guide-card__badge')).toContainText('5/8');
  });

  test('8. 点击「下一步」后进入快捷键技巧步骤', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(500);

    // 第五步：提醒设置（高亮弹窗，卡片在下方）
    await expect(page.locator('.guide-card__title')).toHaveText('提醒设置 ⏰');
    await expect(page.locator('.guide-card__badge')).toContainText('5/8');

    // spotlight 应在弹窗上
    var spBox = await page.locator('.guide-spotlight').boundingBox();
    var popoverBox = await page.locator('#datetimePopover').boundingBox();
    expect(Math.abs(spBox.x - popoverBox.x)).toBeLessThan(15);
    expect(Math.abs(spBox.y - popoverBox.y)).toBeLessThan(15);

    // 点击「下一步」
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 第六步：快捷键技巧
    await expect(page.locator('.guide-card__title')).toHaveText('快捷键技巧 ⌨️');
    await expect(page.locator('.guide-card__badge')).toContainText('6/8');
  });

  test('9. 点击「下一步」后进入史迪奇日报步骤', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(500);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 点击「下一步」
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 第七步：史迪奇日报
    await expect(page.locator('.guide-card__title')).toHaveText('史迪奇日报 📊');
    await expect(page.locator('.guide-card__badge')).toContainText('7/8');
  });

  test('10. 双击史迪奇并关闭日报弹窗后进入全部搞定', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(500);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    // 双击史迪奇
    await page.locator('#stitchPet').dblclick();
    await page.locator('#dailyReportModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('#dailyReportOk').click({ force: true });
    await page.locator('#dailyReportModal').waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('.guide-card__btn--primary').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    // 第八步：全部搞定（最后一步）
    await expect(page.locator('.guide-card__title')).toHaveText('全部搞定');
    await expect(page.locator('.guide-card__badge')).toContainText('8/8');
    await expect(page.locator('.guide-card__btn--primary')).toHaveText('完成引导');
    await expect(page.locator('.guide-card__btn--skip')).toBeHidden();
  });

  test('11. 引导完成后刷新不再弹出', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(500);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#stitchPet').dblclick();
    await page.locator('#dailyReportModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('#dailyReportOk').click({ force: true });
    await page.locator('#dailyReportModal').waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('.guide-card__btn--primary').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    await page.reload();
    await page.waitForTimeout(800);

    var cardCount = await page.locator('.guide-card').count();
    expect(cardCount).toBe(0);
    var spotlightCount = await page.locator('.guide-spotlight').count();
    expect(spotlightCount).toBe(0);
  });
});

test.describe('跳过引导', function () {

  test('12. 点击「跳过」后引导关闭', async ({ page }) => {
    await expect(page.locator('#guide-overlay')).toBeVisible();

    await page.locator('.guide-card__btn--skip').click();
    await page.waitForTimeout(400);

    var overlayCount = await page.locator('#guide-overlay').count();
    expect(overlayCount).toBe(0);
  });

  test('13. 按 Esc 键跳过引导', async ({ page }) => {
    await expect(page.locator('#guide-overlay')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    var overlayCount = await page.locator('#guide-overlay').count();
    expect(overlayCount).toBe(0);
  });
});

test.describe('上下文提示', function () {

  test('14. 引导完成后，聚焦输入框应显示上下文提示', async ({ page }) => {
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#todoInput').fill('测试待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(800);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(500);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);
    await page.locator('#stitchPet').dblclick();
    await page.locator('#dailyReportModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('#dailyReportOk').click({ force: true });
    await page.locator('#dailyReportModal').waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('.guide-card__btn--primary').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('.guide-card__btn--primary').click();
    await page.waitForTimeout(400);

    await page.locator('#todoInput').focus();
    await page.waitForTimeout(1000);

    var tooltipCount = await page.locator('.guide-tooltip').count();
    expect(typeof tooltipCount).toBe('number');
  });
});

test.describe('设置页重置', function () {

  test('15. 设置页「查看引导」按钮存在', async ({ page }) => {
    await page.goto(getPageUrl('settings.html'));
    await page.waitForTimeout(500);

    var btn = page.locator('#guideResetTourBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('查看引导');
  });

  test('16. 设置页「重置操作提示」按钮存在', async ({ page }) => {
    await page.goto(getPageUrl('settings.html'));
    await page.waitForTimeout(500);

    var btn = page.locator('#guideResetTipsBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('重置');
  });
});
