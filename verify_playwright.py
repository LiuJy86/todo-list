# -*- coding: utf-8 -*-
"""
待办事项清单 - Playwright 自动化验证脚本
验证需求：输入添加、标记完成（自动沉底）、删除、sessionStorage 刷新持久化、session 语义
测试截图保存至项目下的 screenshots/ 目录

v1.3.0 更新：选择器从 #todoList li 改为 #todoList .todo-item，适配收纳功能的新 DOM 结构
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8000/index.html"

# 截图保存目录（项目根目录下的 screenshots/）
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"


def get_todos(page):
    """从页面 sessionStorage 读取 todos 数组（None 表示无数据）"""
    raw = page.evaluate("sessionStorage.getItem('todos')")
    return None if raw is None else json.loads(raw)


def shot(page, name: str):
    """保存截图到 screenshots/ 目录，文件名形如 01_initial.png"""
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    file_path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(file_path), full_page=True)


def main():
    results = []

    def log(name, ok, detail=""):
        results.append((name, ok, detail))
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}")
        print(f"       {detail}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # ---------- 1. 打开页面，验证初始状态 ----------
        page.goto(URL)
        page.wait_for_load_state("networkidle")

        initial_ss = get_todos(page)
        initial_count = page.locator("#todoList .todo-item").count()
        shot(page, "01_initial")
        log(
            "1. 初始状态为空",
            initial_ss == [] and initial_count == 0,
            f"sessionStorage={initial_ss}, listCount={initial_count}",
        )

        # ---------- 2. 添加 3 条事项 ----------
        items = ["学习 HTML", "学习 CSS", "学习 JavaScript"]
        for text in items:
            page.locator("#todoInput").fill(text)
            page.locator("#todoInput").press("Enter")
        page.wait_for_timeout(500)

        count_after_add = page.locator("#todoList .todo-item").count()
        ss_after_add = get_todos(page)
        shot(page, "02_after_add")
        log(
            "2. 添加3条事项",
            count_after_add == 3
            and len(ss_after_add) == 3
            and [t["text"] for t in ss_after_add] == items,
            f"listCount={count_after_add}, ss={ss_after_add}",
        )

        # ---------- 3. 勾选「学习 CSS」，验证其自动沉到底部 ----------
        # 注意：必须通过文本定位，避免重排后 nth(index) 漂移导致误勾选
        page.locator("#todoList .todo-item", has_text="学习 CSS").locator(".todo-checkbox").check()
        page.wait_for_timeout(500)

        ss_after_check = get_todos(page)
        completed_count = page.locator("#todoList .todo-item.completed").count()
        decoration = page.evaluate(
            "getComputedStyle(document.querySelector('#todoList .todo-item.completed .todo-text')).textDecoration"
        )
        # 列表显示顺序：学习 HTML / 学习 JavaScript / 学习 CSS(已完成)
        list_order_after_check = page.evaluate(
            "Array.from(document.querySelectorAll('#todoList .todo-item .todo-text')).map(el=>el.textContent)"
        )
        shot(page, "03_after_complete")
        log(
            "3. 标记完成（删除线+置灰+自动沉底）",
            ss_after_check[2]["done"] is True
            and ss_after_check[2]["text"] == "学习 CSS"
            and completed_count == 1
            and "line-through" in decoration
            and list_order_after_check == ["学习 HTML", "学习 JavaScript", "学习 CSS"],
            f"ss={ss_after_check}, order={list_order_after_check}, decoration={decoration}",
        )

        # ---------- 3.1 再勾选「学习 HTML」，验证已完成区顺序 ----------
        page.locator("#todoList .todo-item", has_text="学习 HTML").locator(".todo-checkbox").check()
        page.wait_for_timeout(500)

        ss_after_check2 = get_todos(page)
        # 此时数组顺序：学习 JavaScript(未完成) / 学习 CSS(已完成) / 学习 HTML(已完成)
        # 新勾选的事项追加到已完成区末尾，即所有已有完成项之后
        list_order_after_check2 = page.evaluate(
            "Array.from(document.querySelectorAll('#todoList .todo-item')).map(li=>({"
            "text: li.querySelector('.todo-text').textContent, "
            "done: li.classList.contains('completed')}))"
        )
        shot(page, "04_two_completed")
        log(
            "3.1 第二条完成项追加到已完成区末尾",
            [t["text"] for t in ss_after_check2] == ["学习 JavaScript", "学习 CSS", "学习 HTML"]
            and list_order_after_check2[0]["done"] is False
            and list_order_after_check2[1]["done"] is True
            and list_order_after_check2[2]["done"] is True,
            f"ss={ss_after_check2}, order={list_order_after_check2}",
        )

        # ---------- 3.2 取消勾选「学习 HTML」，验证其冒泡到未完成区末尾 ----------
        page.locator("#todoList .todo-item", has_text="学习 HTML").locator(".todo-checkbox").uncheck()
        page.wait_for_timeout(500)

        ss_after_uncheck = get_todos(page)
        # 取消勾选后：学习 JavaScript(未完成) / 学习 HTML(未完成) / 学习 CSS(已完成)
        list_order_after_uncheck = page.evaluate(
            "Array.from(document.querySelectorAll('#todoList .todo-item')).map(li=>({"
            "text: li.querySelector('.todo-text').textContent, "
            "done: li.classList.contains('completed')}))"
        )
        shot(page, "05_after_uncheck")
        log(
            "3.2 取消勾选后冒泡到未完成区末尾",
            [t["text"] for t in ss_after_uncheck] == ["学习 JavaScript", "学习 HTML", "学习 CSS"]
            and list_order_after_uncheck[0]["done"] is False
            and list_order_after_uncheck[1]["done"] is False
            and list_order_after_uncheck[2]["done"] is True,
            f"ss={ss_after_uncheck}, order={list_order_after_uncheck}",
        )

        # ---------- 4. 删除「学习 JavaScript」（当前未完成区第 1 条）----------
        page.locator("#todoList .todo-item", has_text="学习 JavaScript").locator(".delete-btn").click()
        page.wait_for_timeout(500)

        count_after_del = page.locator("#todoList .todo-item").count()
        ss_after_del = get_todos(page)
        shot(page, "06_after_delete")
        log(
            "4. 删除未完成区第1条（学习 JavaScript）",
            count_after_del == 2
            and ss_after_del[0]["text"] == "学习 HTML"
            and ss_after_del[1]["text"] == "学习 CSS",
            f"listCount={count_after_del}, ss={ss_after_del}",
        )

        # ---------- 5. 刷新页面，验证 sessionStorage 数据保留（含顺序）----------
        before_reload = get_todos(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        after_reload_ss = get_todos(page)
        after_reload_count = page.locator("#todoList .todo-item").count()
        after_reload_completed = page.locator("#todoList .todo-item.completed").count()
        after_reload_items = page.evaluate(
            "Array.from(document.querySelectorAll('#todoList .todo-item')).map(li=>({"
            "text: li.querySelector('.todo-text').textContent, "
            "done: li.classList.contains('completed'), "
            "checked: li.querySelector('.todo-checkbox').checked}))"
        )
        shot(page, "07_after_reload")
        log(
            "5. 刷新后数据完整保留",
            before_reload == after_reload_ss
            and after_reload_count == 2
            and after_reload_completed == 1
            and after_reload_items[0]["done"] is False
            and after_reload_items[1]["done"] is True
            and after_reload_items[1]["checked"] is True,
            f"before={before_reload}, after={after_reload_ss}, items={after_reload_items}",
        )

        # ---------- 6. session 语义验证：新标签页 sessionStorage 应为空 ----------
        page.close()
        new_page = context.new_page()
        new_page.goto(URL)
        new_page.wait_for_load_state("networkidle")

        new_ss = get_todos(new_page)
        new_count = new_page.locator("#todoList .todo-item").count()
        shot(new_page, "08_new_tab_empty")
        log(
            "6. session语义（新标签页数据清空）",
            new_ss == [] and new_count == 0,
            f"sessionStorage={new_ss}, listCount={new_count}",
        )

        new_page.close()
        browser.close()

    # ---------- 汇总 ----------
    print("\n" + "=" * 50)
    print("验证汇总")
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
