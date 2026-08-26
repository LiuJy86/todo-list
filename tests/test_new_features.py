# -*- coding: utf-8 -*-
"""
新功能 - Playwright 自动化测试
测试需求：
  1. 双击编辑待办事项
  2. 目标计数功能
  3. 史迪奇交互文字（中二/乐天/暖心）
  4. 日报功能
  5. 自动收纳已完成项（默认折叠）
"""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8000/src/index.html"

# 截图保存目录
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"


def get_todos(page):
    """从页面 localStorage 读取 todos 数组"""
    raw = page.evaluate("localStorage.getItem('todos')")
    return None if raw is None else json.loads(raw)


def shot(page, name: str):
    """保存截图"""
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    file_path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(file_path), full_page=True)


def add_todo(page, text: str, target_count=None):
    """添加待办事项，可选设置目标次数"""
    page.locator("#todoInput").fill(text)
    if target_count:
        page.locator("#targetCountInput").fill(str(target_count))
    page.locator("#todoInput").press("Enter")
    page.wait_for_timeout(500)


def main():
    results = []

    def log(name, ok, detail=""):
        results.append((name, ok, detail))
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}")
        print(f"       {detail}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # ---------- 打开页面并清理 ----------
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("localStorage.removeItem('todos')")
        page.reload()
        page.wait_for_load_state("networkidle")
        shot(page, "01_initial")

        # ---------- 测试 1：双击编辑 ----------
        add_todo(page, "学习 HTML")
        # 双击待办文字
        text_span = page.locator("#todoList .todo-text").first
        text_span.dblclick()
        page.wait_for_timeout(300)
        shot(page, "02_dblclick_edit")

        # 验证是否出现编辑输入框
        edit_input = page.locator("#todoList .todo-edit-input")
        has_edit_input = edit_input.count() > 0
        log("1. 双击编辑：出现输入框", has_edit_input, f"editInputCount={edit_input.count()}")

        if has_edit_input:
            # 修改内容并保存
            edit_input.fill("学习 HTML5")
            edit_input.press("Enter")
            page.wait_for_timeout(500)
            shot(page, "03_edit_saved")

            # 验证内容已更新
            todos = get_todos(page)
            text_updated = todos[0]["text"] == "学习 HTML5"
            log("  双击编辑：内容保存成功", text_updated, f"text={todos[0]['text']}")

        # ---------- 测试 2：目标计数 ----------
        add_todo(page, "喝水", target_count=8)
        page.wait_for_timeout(500)
        shot(page, "04_target_count")

        # 验证计数器 UI 出现
        counter = page.locator("#todoList .todo-counter")
        has_counter = counter.count() > 0
        log("2. 目标计数：UI 显示", has_counter, f"counterCount={counter.count()}")

        if has_counter:
            # 验证初始显示 0/8
            counter_text = page.locator("#todoList .counter-text").first.inner_text()
            text_correct = counter_text == "0/8"
            log("  目标计数：初始显示 0/8", text_correct, f"counterText={counter_text}")

            # 点击 + 按钮 3 次
            plus_btn = page.locator("#todoList .counter-plus-btn").first
            for i in range(3):
                plus_btn.click()
                page.wait_for_timeout(300)

            # 验证计数变为 3/8
            counter_text_after = page.locator("#todoList .counter-text").first.inner_text()
            count_increased = counter_text_after == "3/8"
            log("  目标计数：点击 + 后变为 3/8", count_increased, f"counterText={counter_text_after}")

        # ---------- 测试 3：史迪奇交互文字 ----------
        # 页面加载后 2 秒，史迪奇应该弹出欢迎气泡
        page.wait_for_timeout(3000)
        shot(page, "05_stitch_bubble")

        # 验证气泡是否显示
        bubble = page.locator("#petBubble")
        bubble_visible = bubble.is_visible()
        bubble_text = bubble.inner_text() if bubble_visible else ""
        log("3. 史迪奇交互：气泡显示", bubble_visible and len(bubble_text) > 0, f"bubbleText={bubble_text[:30]}...")

        # 添加待办时史迪奇应该有反馈
        add_todo(page, "测试史迪奇反馈")
        page.wait_for_timeout(1500)
        shot(page, "06_stitch_feedback")
        bubble_text_after_add = page.locator("#petBubble").inner_text()
        has_feedback = len(bubble_text_after_add) > 0
        log("  史迪奇交互：添加时反馈", has_feedback, f"feedbackText={bubble_text_after_add[:30]}...")

        # ---------- 测试 4：日报功能 ----------
        # 等待气泡消失
        page.wait_for_timeout(3000)
        # 通过 JS 直接完成一个待办事项（避免 DOM 交互不稳定）
        page.evaluate("""
          const todos = JSON.parse(localStorage.getItem('todos') || '[]');
          if (todos.length > 0) {
            todos[0].done = true;
            todos[0].completedAt = Date.now();
            localStorage.setItem('todos', JSON.stringify(todos));
          }
        """)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # 调用日报函数
        page.evaluate("window.showDailyReport()")
        page.wait_for_timeout(1000)
        shot(page, "07_daily_report")

        # 验证日报弹窗是否出现
        modal = page.locator("#dailyReportModal")
        modal_visible = modal.count() > 0
        log("4. 日报功能：弹窗显示", modal_visible, f"modalCount={modal.count()}")

        if modal_visible:
            # 验证日报内容
            report_body = page.locator(".daily-report-body")
            report_text = report_body.inner_text()
            has_content = "今日日报" in report_text or "已完成" in report_text
            log("  日报功能：内容正确", has_content, f"reportText={report_text[:50]}...")

            # 关闭弹窗
            page.locator("#dailyReportClose").click()
            page.wait_for_timeout(500)

        # ---------- 测试 5：自动收纳已完成项 ----------
        # 添加更多待办并全部完成，测试默认折叠
        page.evaluate("localStorage.removeItem('todos')")
        page.reload()
        page.wait_for_load_state("networkidle")

        # 添加 4 条待办
        for i in range(4):
            add_todo(page, f"测试事项 {i+1}")
        page.wait_for_timeout(500)

        # 通过 JS 直接将所有事项标记为完成（避免 DOM 交互不稳定）
        page.evaluate("""
          const todos = JSON.parse(localStorage.getItem('todos') || '[]');
          const now = Date.now();
          todos.forEach(function(t) {
            t.done = true;
            t.completedAt = now;
          });
          localStorage.setItem('todos', JSON.stringify(todos));
        """)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        shot(page, "08_collapse_default")

        # 验证收纳按钮出现
        collapse_btn = page.locator("#collapseBtn")
        has_collapse_btn = collapse_btn.count() > 0
        log("5. 自动收纳：按钮显示", has_collapse_btn, f"collapseBtnCount={collapse_btn.count()}")

        if has_collapse_btn:
            # 验证按钮文案显示有 N 项已完成
            btn_text = collapse_btn.inner_text()
            shows_count = "项已完成" in btn_text
            log("  自动收纳：按钮文案正确", shows_count, f"btnText={btn_text}")

            # 验证已完成项默认隐藏（不显示在列表中）
            visible_items = page.locator("#todoList .todo-item")
            visible_count = visible_items.count()
            # 默认折叠时，已完成项不应显示
            log("  自动收纳：已完成项默认隐藏", visible_count == 0, f"visibleItemCount={visible_count}")

            # 点击展开
            collapse_btn.click()
            page.wait_for_timeout(500)
            shot(page, "09_collapse_expanded")

            # 验证展开后已完成项可见
            visible_after_expand = page.locator("#todoList .todo-item").count()
            log("  自动收纳：点击展开后显示", visible_after_expand == 4, f"visibleCount={visible_after_expand}")

        browser.close()

    # ---------- 汇总 ----------
    print("\n" + "=" * 50)
    print("新功能测试汇总")
    print("=" * 50)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, _ in results:
        print(f"  [{'✅ PASS' if ok else '❌ FAIL'}] {name}")
    print(f"\n总计: {passed}/{total} 通过")
    print(f"测试截图已保存至: {SCREENSHOT_DIR}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
