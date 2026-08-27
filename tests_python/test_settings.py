"""
测试模块 5: 设置页面
覆盖功能：页面加载、版本显示、快捷键、引导重置
"""
import pytest
import os
from playwright.sync_api import Page, expect

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(PROJECT_ROOT, "src")
SETTINGS_URL = "file:///" + os.path.join(SRC_DIR, "settings.html").replace("\\", "/")


@pytest.fixture
def settings_page(browser) -> Page:
    """设置页面"""
    context = browser.new_context(viewport={"width": 900, "height": 700})
    page = context.new_page()
    page.goto(SETTINGS_URL)
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(500)
    yield page
    context.close()


class TestSettingsPage:
    """设置页面基础"""

    def test_page_loads(self, settings_page: Page):
        """设置页面正常加载"""
        expect(settings_page.locator("h1")).to_have_text("更多选项")

    def test_sections_visible(self, settings_page: Page):
        """各设置区块可见"""
        expect(settings_page.locator(".section-title").first).to_be_visible()

    def test_auto_start_toggle(self, settings_page: Page):
        """开机自启动开关"""
        # 验证开关存在（可能被 CSS 隐藏但 DOM 中存在）
        exists = settings_page.evaluate("!!document.getElementById('autoStart')")
        assert exists, "自启动开关应存在"
        settings_page.evaluate("document.getElementById('autoStart').click()")
        settings_page.wait_for_timeout(200)

    def test_start_hidden_toggle(self, settings_page: Page):
        """启动时隐藏开关"""
        exists = settings_page.evaluate("!!document.getElementById('startHidden')")
        assert exists, "启动隐藏开关应存在"
        settings_page.evaluate("document.getElementById('startHidden').click()")
        settings_page.wait_for_timeout(200)


class TestSettingsShortcuts:
    """快捷键设置"""

    def test_shortcut_inputs_visible(self, settings_page: Page):
        """快捷键输入框可见"""
        expect(settings_page.locator("#shortcutToggleWindow")).to_be_visible()
        expect(settings_page.locator("#shortcutToggleSticky")).to_be_visible()

    def test_shortcut_edit_buttons(self, settings_page: Page):
        """修改按钮可见"""
        edit_btns = settings_page.locator(".shortcut-edit-btn")
        expect(edit_btns).to_have_count(2)


class TestSettingsUpdate:
    """更新设置"""

    def test_version_display(self, settings_page: Page):
        """版本信息显示"""
        version = settings_page.locator("#versionInfo")
        expect(version).to_be_visible()
        version_text = version.text_content()
        assert "v" in version_text

    def test_check_update_button(self, settings_page: Page):
        """检查更新按钮"""
        btn = settings_page.locator("#checkUpdateBtn")
        expect(btn).to_be_visible()
        btn.click()
        settings_page.wait_for_timeout(1000)
        status = settings_page.locator("#updateStatus")
        expect(status).to_be_visible()


class TestSettingsAbout:
    """关于"""

    def test_github_button(self, settings_page: Page):
        """GitHub 按钮"""
        btn = settings_page.locator("#openGithubBtn")
        expect(btn).to_be_visible()


class TestSettingsGuide:
    """用户引导设置"""

    def test_guide_reset_tour_button(self, settings_page: Page):
        """重新查看引导按钮"""
        btn = settings_page.locator("#guideResetTourBtn")
        expect(btn).to_be_visible()
        btn.click()
        settings_page.wait_for_timeout(300)

    def test_guide_reset_tips_button(self, settings_page: Page):
        """重置操作提示按钮"""
        btn = settings_page.locator("#guideResetTipsBtn")
        expect(btn).to_be_visible()
        btn.click()
        settings_page.wait_for_timeout(300)
