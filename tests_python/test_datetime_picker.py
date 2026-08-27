"""
测试模块 2: 日期时间选择器
覆盖功能：打开/关闭、开始时间、结束时间、结束前提醒、循环提醒、清除/确定
"""
import pytest
from playwright.sync_api import Page, expect


def has_class(locator, class_name):
    """检查元素是否包含某个 class"""
    classes = locator.get_attribute("class") or ""
    return class_name in classes.split()


def check_toggle(page: Page, toggle_id: str):
    """点击切换开关（通过 JS 触发，因为 input 被 CSS 隐藏）"""
    page.evaluate(f"""
        var cb = document.getElementById('{toggle_id}');
        if (!cb.checked) cb.click();
    """)


class TestDatetimePickerOpenClose:
    """选择器打开/关闭"""

    def test_open_picker(self, page: Page):
        """点击触发器打开选择器"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(300)
        expect(page.locator("#datetimePopover")).to_be_visible()

    def test_close_by_click_outside(self, page: Page):
        """点击外部关闭选择器"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(300)
        page.click("header")
        page.wait_for_timeout(300)
        expect(page.locator("#datetimePopover")).not_to_be_visible()


class TestDatetimePickerStart:
    """开始时间设置"""

    def test_toggle_start_section(self, page: Page):
        """展开开始时间区"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpStartToggle")
        page.wait_for_timeout(200)
        expect(page.locator("#dpStartOptions")).to_be_visible()

    def test_date_presets(self, page: Page):
        """日期预设按钮"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpStartToggle")
        page.wait_for_timeout(200)

        page.locator("#dpDatePresets .dp-preset[data-date='today']").click()
        page.wait_for_timeout(200)

        expect(page.locator("#dpMonthInput")).not_to_have_value("")

    def test_time_presets(self, page: Page):
        """时间预设按钮"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpStartToggle")
        page.wait_for_timeout(200)

        page.locator("#dpTimePresets .dp-preset[data-time='morning']").click()
        page.wait_for_timeout(200)

        expect(page.locator("#dpHourInput")).to_have_value("08")

    def test_manual_time_input(self, page: Page):
        """手动输入时间"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpStartToggle")
        page.wait_for_timeout(200)

        page.fill("#dpHourInput", "14")
        page.fill("#dpMinuteInput", "30")
        page.wait_for_timeout(200)

        expect(page.locator("#dpHourInput")).to_have_value("14")
        expect(page.locator("#dpMinuteInput")).to_have_value("30")


class TestDatetimePickerEnd:
    """结束时间设置"""

    def test_toggle_end_section(self, page: Page):
        """展开结束时间区"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpEndToggle")
        page.wait_for_timeout(200)
        expect(page.locator("#dpEndOptions")).to_be_visible()

    def test_end_time_presets(self, page: Page):
        """结束时间快捷预设"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpEndToggle")
        page.wait_for_timeout(200)

        page.locator("#dpEndTimePresets .dp-preset[data-end-time='1h']").click()
        page.wait_for_timeout(200)

        expect(page.locator("#dpEndHourInput")).not_to_have_value("")


class TestDatetimePickerBefore:
    """结束前提醒"""

    def test_toggle_before_section(self, page: Page):
        """展开结束前提醒区"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpBeforeToggle")
        page.wait_for_timeout(200)
        expect(page.locator("#dpBeforeOptions")).to_be_visible()

    def test_before_presets(self, page: Page):
        """结束前提醒预设"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpBeforeToggle")
        page.wait_for_timeout(200)

        page.locator(".dp-before-presets .dp-preset[data-before='10']").click()
        page.wait_for_timeout(200)

        expect(page.locator("#dpBeforeInput")).to_have_value("10")


class TestDatetimePickerCycle:
    """循环提醒"""

    def test_toggle_cycle_section(self, page: Page):
        """展开循环提醒区"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpCycleToggle")
        page.wait_for_timeout(200)
        expect(page.locator("#dpCycleOptions")).to_be_visible()

    def test_cycle_presets(self, page: Page):
        """循环预设"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpCycleToggle")
        page.wait_for_timeout(200)

        preset = page.locator("#dpCyclePresets .dp-preset[data-cycle='1d']")
        preset.click()
        page.wait_for_timeout(200)

        assert has_class(preset, "active"), "预设应有 active class"

    def test_custom_cycle(self, page: Page):
        """自定义循环"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpCycleToggle")
        page.wait_for_timeout(200)

        page.locator("#dpCyclePresets .dp-preset[data-cycle='custom']").click()
        page.wait_for_timeout(200)

        expect(page.locator("#dpCustomCycle")).to_be_visible()

        page.fill("#dpCycleValue", "3")
        page.select_option("#dpCycleUnit", "hour")
        page.wait_for_timeout(200)

        expect(page.locator("#dpCycleValue")).to_have_value("3")


class TestDatetimePickerActions:
    """操作按钮"""

    def test_clear_button(self, page: Page):
        """清除按钮"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpStartToggle")
        page.wait_for_timeout(200)
        page.locator("#dpDatePresets .dp-preset[data-date='today']").click()
        page.wait_for_timeout(200)

        page.click("#dpClearBtn")
        page.wait_for_timeout(200)

        expect(page.locator("#dpMonthInput")).to_have_value("")

    def test_confirm_saves_datetime(self, page: Page):
        """确定按钮 - 保存日期时间到选择器"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        check_toggle(page, "dpStartToggle")
        page.wait_for_timeout(200)
        page.locator("#dpDatePresets .dp-preset[data-date='today']").click()
        page.wait_for_timeout(200)
        page.locator("#dpTimePresets .dp-preset[data-time='morning']").click()
        page.wait_for_timeout(200)

        # 验证选择器显示已设置的日期时间
        display = page.locator("#datetimeDisplay")
        expect(display).not_to_have_text("任务管理（可选）")

        # 点击确定关闭弹窗
        page.click("#dpConfirmBtn")
        page.wait_for_timeout(300)

        # 验证弹窗关闭
        expect(page.locator("#datetimePopover")).not_to_be_visible()

        # 验证选择器保存了时间戳
        ts = page.evaluate("window.datetimePickerModule ? window.datetimePickerModule.getTimestamp() : null")
        assert ts is not None, "选择器应保存时间戳"

    def test_confirm_closes_popover(self, page: Page):
        """确定后关闭浮层"""
        page.click("#datetimeTrigger")
        page.wait_for_timeout(200)
        page.fill("#todoInput", "普通待办")
        page.click("#dpConfirmBtn")
        page.wait_for_timeout(300)

        expect(page.locator("#datetimePopover")).not_to_be_visible()
