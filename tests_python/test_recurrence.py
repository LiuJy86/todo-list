"""
测试模块 8: 循环提醒
覆盖功能：循环待办创建、完成循环、循环次数限制
"""
import pytest
from playwright.sync_api import Page, expect


class TestRecurrenceCreate:
    """创建循环待办"""

    def test_create_daily_recurrence(self, page: Page):
        """创建每天循环"""
        page.fill("#todoInput", "每天8点喝水")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        # 循环徽章
        cycle_badge = page.locator(".todo-item .reminder-badge-cycle")
        expect(cycle_badge).to_be_visible()

    def test_create_hourly_recurrence(self, page: Page):
        """创建每小时循环"""
        page.fill("#todoInput", "每1小时休息")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)
        cycle_badge = page.locator(".todo-item .reminder-badge-cycle")
        expect(cycle_badge).to_be_visible()

    def test_create_recurrence_via_picker(self, page: Page):
        """通过日期选择器创建循环"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        page.evaluate("document.getElementById('dpCycleToggle').click()")
        page.wait_for_timeout(200)

        page.locator("#dpCyclePresets .dp-preset[data-cycle='1d']").click()
        page.wait_for_timeout(200)

        page.fill("#todoInput", "循环待办")
        page.click("#dpConfirmBtn")
        page.wait_for_timeout(400)

        # 点击添加按钮
        page.locator("#addBtn").click()
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)


class TestRecurrenceComplete:
    """循环待办完成"""

    def test_complete_recurrence_advances(self, page: Page):
        """完成循环待办后推进到下一周期"""
        page.fill("#todoInput", "每30分钟休息")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)

        # 完成
        page.evaluate("document.querySelector('.todo-item .todo-checkbox').click()")
        page.wait_for_timeout(500)

        # 循环待办应保持未完成状态（推进到下一周期）
        expect(page.locator(".todo-item")).to_have_count(1)
        # 验证循环徽章仍在
        cycle_badge = page.locator(".todo-item .reminder-badge-cycle")
        expect(cycle_badge).to_be_visible()

    def test_recurrence_with_target_count(self, page: Page):
        """带目标次数的循环"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        page.evaluate("document.getElementById('dpCycleToggle').click()")
        page.wait_for_timeout(200)

        page.locator("#dpCyclePresets .dp-preset[data-cycle='1d']").click()
        page.wait_for_timeout(200)

        page.fill("#dpCycleCount", "3")
        page.wait_for_timeout(200)

        page.fill("#todoInput", "循环3次")
        page.click("#dpConfirmBtn")
        page.wait_for_timeout(300)

        # 点击添加
        page.locator("#addBtn").click()
        page.wait_for_timeout(400)

        expect(page.locator(".todo-item")).to_have_count(1)

        # 验证 tooltip 显示次数进度
        tooltip_el = page.locator(".todo-item").first
        tooltip = tooltip_el.get_attribute("data-tooltip") or ""
        assert "循环" in tooltip, f"Tooltip 应包含循环: {tooltip}"
