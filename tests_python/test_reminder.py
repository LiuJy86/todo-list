"""
测试模块 3: 提醒功能
覆盖功能：自然语言解析、提醒徽章、tooltip 显示
"""
import pytest
from playwright.sync_api import Page, expect


class TestNaturalLanguageParsing:
    """自然语言解析提醒时间"""

    def test_parse_chinese_time(self, page: Page):
        """解析中文时间表达"""
        page.fill("#todoInput", "九点半提醒我开会")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        badge = page.locator(".todo-item .reminder-badge")
        expect(badge).to_be_visible()

    def test_parse_colon_time(self, page: Page):
        """解析数字时间 8:00"""
        page.fill("#todoInput", "8:00 吃早饭")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        badge = page.locator(".todo-item .reminder-badge")
        expect(badge).to_be_visible()

    def test_parse_tomorrow(self, page: Page):
        """解析"明天" """
        page.fill("#todoInput", "明天9点面试")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        badge = page.locator(".todo-item .reminder-badge")
        expect(badge).to_be_visible()

    def test_parse_every_day(self, page: Page):
        """解析"每天"循环"""
        page.fill("#todoInput", "每天8点喝水")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        # 循环徽章
        cycle_badge = page.locator(".todo-item .reminder-badge-cycle")
        expect(cycle_badge).to_be_visible()

    def test_parse_every_30_minutes(self, page: Page):
        """解析"每30分钟"循环"""
        page.fill("#todoInput", "每30分钟休息一下")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        cycle_badge = page.locator(".todo-item .reminder-badge-cycle")
        expect(cycle_badge).to_be_visible()

    def test_parse_relative_time(self, page: Page):
        """解析"半小时后" """
        page.fill("#todoInput", "半小时后关火")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        badge = page.locator(".todo-item .reminder-badge")
        expect(badge).to_be_visible()


class TestReminderTooltip:
    """提醒 Tooltip 显示"""

    def test_tooltip_visible_on_hover(self, page: Page):
        """悬停显示 tooltip"""
        page.fill("#todoInput", "明天10点开会")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        tooltip_el = page.locator(".todo-item").first
        tooltip = tooltip_el.get_attribute("data-tooltip") or ""
        assert len(tooltip) > 0, "应有 tooltip 内容"

    def test_cycle_tooltip(self, page: Page):
        """循环事项 tooltip 显示循环信息"""
        page.fill("#todoInput", "每1小时喝水")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        tooltip_el = page.locator(".todo-item").first
        tooltip = tooltip_el.get_attribute("data-tooltip") or ""
        assert "循环" in tooltip, f"Tooltip 应包含循环: {tooltip}"


class TestReminderBadge:
    """提醒徽章"""

    def test_badge_shows_time(self, page: Page):
        """徽章显示时间"""
        page.fill("#todoInput", "14:30 开会")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        badge = page.locator(".todo-item .reminder-badge")
        expect(badge).to_be_visible()

    def test_no_badge_without_reminder(self, page: Page):
        """无提醒时不显示徽章"""
        page.fill("#todoInput", "普通待办无提醒")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        badge = page.locator(".todo-item .reminder-badge")
        expect(badge).not_to_be_visible()


class TestSoundTest:
    """音效测试"""

    def test_sound_test_button(self, page: Page):
        """音效测试按钮可点击"""
        btn = page.locator("#soundTestBtn")
        expect(btn).to_be_visible()
        btn.click()
        page.wait_for_timeout(500)
