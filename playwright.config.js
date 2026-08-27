/**
 * Playwright 配置 - 引导系统测试
 */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false, // 引导测试需要串行（localStorage 状态依赖）
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'file://' + __dirname + '/src',
    headless: true,
    viewport: { width: 800, height: 600 },
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
