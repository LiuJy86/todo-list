/**
 * 循环提醒 Tooltip 测试
 *
 * 测试范围：
 * 1. 正常循环提醒（minute/hour/day/week）悬停显示正确的中文单位
 * 2. 异常单位值（如 month/year/undefined）悬停时不会显示 "undefined"
 * 3. 缺失 unit 字段时不会显示 "undefined"
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// 辅助：获取 file:// URL
function getPageUrl(file) {
  return 'file://' + path.resolve(__dirname, '..', 'src', file);
}

// 辅助：生成测试用时间戳（未来 1 小时）
function futureTimestamp(hoursAhead) {
  return Date.now() + hoursAhead * 60 * 60 * 1000;
}

// 每个测试前清除 localStorage 并禁用引导
test.beforeEach(async ({ page }) => {
  await page.goto(getPageUrl('index.html'));
  await page.evaluate(function () {
    localStorage.clear();
    localStorage.setItem('guide_tour_done', '1');
  });
  await page.reload();
  await page.waitForTimeout(300);
});

test.describe('循环提醒 Tooltip 显示测试', function () {

  test('1. 正常循环提醒（每 30 分钟）悬停应显示正确 tooltip', async ({ page }) => {
    // 通过 UI 创建带循环提醒的待办
    await page.locator('#todoInput').fill('测试循环待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(300);

    // 打开时间管理弹窗
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(300);

    // 启用循环提醒
    await page.locator('#dpCycleToggle').check();
    await page.waitForTimeout(200);

    // 选择 30 分钟预设
    await page.locator('[data-cycle="30m"]').click();
    await page.waitForTimeout(200);

    // 确认
    await page.locator('#dpConfirmBtn').click();
    await page.waitForTimeout(300);

    // 悬停到待办上
    const todoItem = page.locator('#todoList li:first-child');
    await todoItem.hover();
    await page.waitForTimeout(500);

    // 检查 tooltip 内容
    const tooltip = page.locator('.js-tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toContain('循环');
    expect(tooltipText).toContain('30');
    expect(tooltipText).toContain('分钟');
    expect(tooltipText).not.toContain('undefined');
  });

  test('2. 正常循环提醒（每 1 天）悬停应显示正确 tooltip', async ({ page }) => {
    // 通过 UI 创建带循环提醒的待办
    await page.locator('#todoInput').fill('每日循环待办');
    await page.locator('#todoInput').press('Enter');
    await page.waitForTimeout(300);

    // 打开时间管理弹窗
    await page.locator('#datetimeTrigger').click();
    await page.waitForTimeout(300);

    // 启用循环提醒
    await page.locator('#dpCycleToggle').check();
    await page.waitForTimeout(200);

    // 选择 1 天预设
    await page.locator('[data-cycle="1d"]').click();
    await page.waitForTimeout(200);

    // 确认
    await page.locator('#dpConfirmBtn').click();
    await page.waitForTimeout(300);

    // 悬停到待办上
    const todoItem = page.locator('#todoList li:first-child');
    await todoItem.hover();
    await page.waitForTimeout(500);

    // 检查 tooltip 内容
    const tooltip = page.locator('.js-tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toContain('循环');
    expect(tooltipText).toContain('天');
    expect(tooltipText).not.toContain('undefined');
  });

  test('3. 异常单位值（month）不应显示 undefined', async ({ page }) => {
    // 直接注入带有异常单位值的待办数据
    await page.evaluate(function () {
      const todos = [{
        id: 'test-1',
        text: '异常单位待办',
        done: false,
        reminders: [],
        recurrence: {
          enabled: true,
          interval: 1,
          unit: 'month',  // 不支持的单位
          targetCount: null
        },
        completionCount: 0,
        lastRemindAt: null
      }];
      localStorage.setItem('todos', JSON.stringify(todos));
    });
    await page.reload();
    await page.waitForTimeout(300);

    // 悬停到待办上
    const todoItem = page.locator('#todoList li:first-child');
    await todoItem.hover();
    await page.waitForTimeout(500);

    // 检查 tooltip 内容 - 不应包含 "undefined"
    const tooltip = page.locator('.js-tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toContain('循环');
    expect(tooltipText).not.toContain('undefined');
  });

  test('4. 缺失 unit 字段不应显示 undefined', async ({ page }) => {
    // 直接注入缺少 unit 字段的待办数据
    await page.evaluate(function () {
      const todos = [{
        id: 'test-2',
        text: '缺失单位待办',
        done: false,
        reminders: [],
        recurrence: {
          enabled: true,
          interval: 5,
          // unit 字段缺失
          targetCount: null
        },
        completionCount: 0,
        lastRemindAt: null
      }];
      localStorage.setItem('todos', JSON.stringify(todos));
    });
    await page.reload();
    await page.waitForTimeout(300);

    // 悬停到待办上
    const todoItem = page.locator('#todoList li:first-child');
    await todoItem.hover();
    await page.waitForTimeout(500);

    // 检查 tooltip 内容 - 不应包含 "undefined"
    const tooltip = page.locator('.js-tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toContain('循环');
    expect(tooltipText).not.toContain('undefined');
  });

  test('5. 异常单位值（year）应回退显示原始值', async ({ page }) => {
    // 直接注入带有异常单位值 year 的待办数据
    await page.evaluate(function () {
      const todos = [{
        id: 'test-3',
        text: '年度循环待办',
        done: false,
        reminders: [],
        recurrence: {
          enabled: true,
          interval: 1,
          unit: 'year',  // 不支持的单位
          targetCount: null
        },
        completionCount: 0,
        lastRemindAt: null
      }];
      localStorage.setItem('todos', JSON.stringify(todos));
    });
    await page.reload();
    await page.waitForTimeout(300);

    // 悬停到待办上
    const todoItem = page.locator('#todoList li:first-child');
    await todoItem.hover();
    await page.waitForTimeout(500);

    // 检查 tooltip 内容 - 应回退显示原始单位值 "year"
    const tooltip = page.locator('.js-tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toContain('循环');
    expect(tooltipText).toContain('year');
    expect(tooltipText).not.toContain('undefined');
  });
});
