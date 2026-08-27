"""
循环提醒 Tooltip 闭环测试 (Python + Playwright)

测试范围：
1. 正常循环提醒（minute/hour/day/week）悬停显示正确的中文单位
2. 异常单位值（如 month/year）悬停时不会显示 "undefined"
3. 缺失 unit 字段时不会显示 "undefined"
"""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

# 项目路径
SRC_DIR = Path(__file__).parent.parent / "src"
INDEX_URL = f"file://{SRC_DIR / 'index.html'}"


def setup_page(page):
    """每个测试前的设置：清除 localStorage 并禁用引导"""
    page.goto(INDEX_URL)
    page.evaluate("() => { localStorage.clear(); localStorage.setItem('guide_tour_done', '1'); }")
    page.reload()
    page.wait_for_timeout(500)


def create_todo_with_recurrence(page, text, cycle_preset):
    """通过 UI 创建带循环提醒的待办"""
    # 输入待办文本
    page.locator("#todoInput").fill(text)
    page.locator("#todoInput").press("Enter")
    page.wait_for_timeout(300)

    # 打开时间管理弹窗
    page.locator("#datetimeTrigger").click()
    page.wait_for_timeout(400)

    # 启用循环提醒（点击自定义开关的滑块区域）
    toggle = page.locator("#dpCycleToggle")
    # 原生 checkbox 被隐藏，需要点击关联的 label 区域
    if not toggle.is_checked():
        # 点击开关的滑块来触发
        page.locator("label.dp-toggle:has(#dpCycleToggle) .dp-toggle-slider").click()
        page.wait_for_timeout(200)

    # 选择循环预设
    page.locator(f'[data-cycle="{cycle_preset}"]').click()
    page.wait_for_timeout(200)

    # 确认
    page.locator("#dpConfirmBtn").click()
    page.wait_for_timeout(400)


def inject_todo_via_storage(page, todo_data):
    """直接通过 localStorage 注入待办数据（用于测试异常数据）"""
    page.goto(INDEX_URL)
    page.evaluate("() => { localStorage.clear(); localStorage.setItem('guide_tour_done', '1'); }")
    page.evaluate(f"(data) => {{ localStorage.setItem('todos', JSON.stringify(data)); }}", [todo_data])
    page.reload()
    # 等待待办列表渲染
    page.wait_for_selector("#todoList li:first-child", timeout=5000)
    page.wait_for_timeout(300)


def get_tooltip_text(page):
    """获取悬停后显示的 tooltip 文本"""
    tooltip = page.locator(".js-tooltip")
    expect(tooltip).to_be_visible(timeout=5000)
    return tooltip.text_content()


# ========== 测试用例 ==========

def test_normal_recurrence_30min():
    """测试 1：正常循环提醒（每 30 分钟）悬停应显示正确 tooltip"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 800, "height": 600})
        try:
            setup_page(page)
            create_todo_with_recurrence(page, "测试循环待办", "30m")

            # 悬停到待办上
            todo_item = page.locator("#todoList li:first-child")
            todo_item.hover()
            page.wait_for_timeout(500)

            # 验证 tooltip 内容
            text = get_tooltip_text(page)
            assert "循环" in text, f"Tooltip 应包含'循环'，实际: {text}"
            assert "30" in text, f"Tooltip 应包含'30'，实际: {text}"
            assert "分钟" in text, f"Tooltip 应包含'分钟'，实际: {text}"
            assert "undefined" not in text, f"Tooltip 不应包含'undefined'，实际: {text}"
            print(f"  ✓ 测试 1 通过: {text}")
        finally:
            browser.close()


def test_normal_recurrence_1day():
    """测试 2：正常循环提醒（每 1 天）悬停应显示正确 tooltip"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 800, "height": 600})
        try:
            setup_page(page)
            create_todo_with_recurrence(page, "每日循环待办", "1d")

            # 悬停到待办上
            todo_item = page.locator("#todoList li:first-child")
            todo_item.hover()
            page.wait_for_timeout(500)

            # 验证 tooltip 内容
            text = get_tooltip_text(page)
            assert "循环" in text, f"Tooltip 应包含'循环'，实际: {text}"
            assert "天" in text, f"Tooltip 应包含'天'，实际: {text}"
            assert "undefined" not in text, f"Tooltip 不应包含'undefined'，实际: {text}"
            print(f"  ✓ 测试 2 通过: {text}")
        finally:
            browser.close()


def test_invalid_unit_month():
    """测试 3：异常单位值（month）不应显示 undefined"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 800, "height": 600})
        try:
            todo_data = {
                "id": "test-month",
                "text": "异常单位待办",
                "done": False,
                "reminders": [],
                "recurrence": {
                    "enabled": True,
                    "interval": 1,
                    "unit": "month",  # 不支持的单位
                    "targetCount": None
                },
                "completionCount": 0,
                "lastRemindAt": None
            }
            inject_todo_via_storage(page, todo_data)

            # 悬停到待办上
            todo_item = page.locator("#todoList li:first-child")
            todo_item.hover()
            page.wait_for_timeout(500)

            # 验证 tooltip 内容
            text = get_tooltip_text(page)
            assert "循环" in text, f"Tooltip 应包含'循环'，实际: {text}"
            assert "undefined" not in text, f"Tooltip 不应包含'undefined'，实际: {text}"
            print(f"  ✓ 测试 3 通过: {text}")
        finally:
            browser.close()


def test_missing_unit_field():
    """测试 4：缺失 unit 字段不应显示 undefined"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 800, "height": 600})
        try:
            todo_data = {
                "id": "test-missing",
                "text": "缺失单位待办",
                "done": False,
                "reminders": [],
                "recurrence": {
                    "enabled": True,
                    "interval": 5,
                    # unit 字段缺失
                    "targetCount": None
                },
                "completionCount": 0,
                "lastRemindAt": None
            }
            inject_todo_via_storage(page, todo_data)

            # 悬停到待办上
            todo_item = page.locator("#todoList li:first-child")
            todo_item.hover()
            page.wait_for_timeout(500)

            # 验证 tooltip 内容
            text = get_tooltip_text(page)
            assert "循环" in text, f"Tooltip 应包含'循环'，实际: {text}"
            assert "undefined" not in text, f"Tooltip 不应包含'undefined'，实际: {text}"
            print(f"  ✓ 测试 4 通过: {text}")
        finally:
            browser.close()


def test_invalid_unit_year_fallback():
    """测试 5：异常单位值（year）应回退显示原始值"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 800, "height": 600})
        try:
            todo_data = {
                "id": "test-year",
                "text": "年度循环待办",
                "done": False,
                "reminders": [],
                "recurrence": {
                    "enabled": True,
                    "interval": 1,
                    "unit": "year",  # 不支持的单位
                    "targetCount": None
                },
                "completionCount": 0,
                "lastRemindAt": None
            }
            inject_todo_via_storage(page, todo_data)

            # 悬停到待办上
            todo_item = page.locator("#todoList li:first-child")
            todo_item.hover()
            page.wait_for_timeout(500)

            # 验证 tooltip 内容 - 应回退显示原始单位值 "year"
            text = get_tooltip_text(page)
            assert "循环" in text, f"Tooltip 应包含'循环'，实际: {text}"
            assert "year" in text, f"Tooltip 应包含'year'，实际: {text}"
            assert "undefined" not in text, f"Tooltip 不应包含'undefined'，实际: {text}"
            print(f"  ✓ 测试 5 通过: {text}")
        finally:
            browser.close()


# ========== 主运行入口 ==========

if __name__ == "__main__":
    print("\n===== 循环提醒 Tooltip 闭环测试 =====\n")

    tests = [
        ("测试 1 - 正常循环提醒（30 分钟）", test_normal_recurrence_30min),
        ("测试 2 - 正常循环提醒（1 天）", test_normal_recurrence_1day),
        ("测试 3 - 异常单位值（month）", test_invalid_unit_month),
        ("测试 4 - 缺失 unit 字段", test_missing_unit_field),
        ("测试 5 - 异常单位值（year 回退）", test_invalid_unit_year_fallback),
    ]

    passed = 0
    failed = 0
    errors = []

    for name, test_fn in tests:
        print(f"运行: {name}")
        try:
            test_fn()
            passed += 1
        except Exception as e:
            failed += 1
            errors.append((name, str(e)))
            print(f"  ✗ 失败: {e}")

    print(f"\n===== 测试结果 =====")
    print(f"通过: {passed}/{len(tests)}")
    print(f"失败: {failed}/{len(tests)}")

    if errors:
        print(f"\n失败详情:")
        for name, err in errors:
            print(f"  - {name}: {err}")
        exit(1)
    else:
        print("\n✓ 全部测试通过!")
        exit(0)
