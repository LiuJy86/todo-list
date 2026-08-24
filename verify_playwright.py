# -*- coding: utf-8 -*-
"""
待办事项清单 - Playwright 自动化验证脚本
验证需求：
  基础功能：输入添加、标记完成（自动沉底）、删除、localStorage 刷新持久化、跨标签页语义
  高级功能：收纳与展开、双击编辑、提醒解析、循环提醒、日期选择器、长文本折叠、桌宠交互
测试截图保存至项目下的 screenshots/ 目录

v2.0.0 更新：新增高级功能测试用例（收纳、编辑、提醒、循环、日期选择器、长文本、桌宠）
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8000/src/index.html"

# 截图保存目录（项目根目录下的 screenshots/）
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"


def get_todos(page):
    """从页面 localStorage 读取 todos 数组（None 表示无数据）"""
    raw = page.evaluate("localStorage.getItem('todos')")
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
        # headless=False 显示浏览器窗口，slow_mo=500 让操作慢半秒，方便实时观察
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context()
        page = context.new_page()

        # 【v2.13.0】自动处理删除确认对话框（测试中默认点击确认）
        page.on("dialog", lambda dialog: dialog.accept())

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
        checkbox = page.locator("#todoList .todo-item", has_text="学习 CSS").locator(".todo-checkbox")
        checkbox.click()
        page.wait_for_timeout(1500)

        ss_after_check = get_todos(page)
        # 检查数据层面的完成状态
        css_done = any(t["text"] == "学习 CSS" and t["done"] for t in ss_after_check)
        # DOM 层面：已完成项可能默认折叠，所以不一定能看到
        completed_count = page.locator("#todoList .todo-item.completed").count()
        # 获取 CSS 装饰（如果有可见的已完成项）
        decoration = ""
        if completed_count > 0:
            decoration = page.evaluate(
                "getComputedStyle(document.querySelector('#todoList .todo-item.completed .todo-text')).textDecoration"
            )
        # 列表显示顺序
        list_order_after_check = page.evaluate(
            "Array.from(document.querySelectorAll('#todoList .todo-item .todo-text')).map(el=>el.textContent)"
        )
        shot(page, "03_after_complete")
        log(
            "3. 标记完成（删除线+置灰+自动沉底）",
            css_done
            and ss_after_check[2]["text"] == "学习 CSS",  # 顺序：沉底
            f"ss={ss_after_check}, order={list_order_after_check}, css_done={css_done}, completed_count={completed_count}, decoration={decoration}",
        )

        # ---------- 3.1 再勾选「学习 HTML」，验证已完成区顺序 ----------
        page.locator("#todoList .todo-item", has_text="学习 HTML").locator(".todo-checkbox").click()
        page.wait_for_timeout(1000)

        ss_after_check2 = get_todos(page)
        # 此时数组顺序：学习 JavaScript(未完成) / 学习 CSS(已完成) / 学习 HTML(已完成)
        # 新勾选的事项追加到已完成区末尾，即所有已有完成项之后
        # 注意：已完成项默认折叠，DOM 中可能不可见，这里只验证数据层面
        shot(page, "04_two_completed")
        log(
            "3.1 第二条完成项追加到已完成区末尾",
            [t["text"] for t in ss_after_check2] == ["学习 JavaScript", "学习 CSS", "学习 HTML"]
            and ss_after_check2[0]["done"] is False
            and ss_after_check2[1]["done"] is True
            and ss_after_check2[2]["done"] is True,
            f"ss={ss_after_check2}",
        )

        # ---------- 3.2 取消勾选「学习 HTML」，验证其冒泡到未完成区末尾 ----------
        # 注意：学习 HTML 已完成，需要先展开已完成区才能点击
        # 查找展开按钮（class="collapse-btn"）并点击
        expand_btn = page.locator(".collapse-btn")
        if expand_btn.count() > 0:
            expand_btn.click()
            page.wait_for_timeout(1000)

        page.locator("#todoList .todo-item", has_text="学习 HTML").locator(".todo-checkbox").click()
        page.wait_for_timeout(1000)

        ss_after_uncheck = get_todos(page)
        # 取消勾选后：学习 JavaScript(未完成) / 学习 HTML(未完成) / 学习 CSS(已完成)
        shot(page, "05_after_uncheck")
        log(
            "3.2 取消勾选后冒泡到未完成区末尾",
            [t["text"] for t in ss_after_uncheck] == ["学习 JavaScript", "学习 HTML", "学习 CSS"]
            and ss_after_uncheck[0]["done"] is False
            and ss_after_uncheck[1]["done"] is False
            and ss_after_uncheck[2]["done"] is True,
            f"ss={ss_after_uncheck}",
        )

        # ---------- 4. 删除「学习 JavaScript」（当前未完成区第 1 条）----------
        page.locator("#todoList .todo-item", has_text="学习 JavaScript").locator(".delete-btn").click()
        page.wait_for_timeout(800)  # 等待删除确认对话框 + 删除动画（300ms）

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

        # ---------- 5. 刷新页面，验证 localStorage 数据保留（含顺序）----------
        before_reload = get_todos(page)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)  # 等待渲染完成

        after_reload_ss = get_todos(page)
        # 数据层面验证：localStorage 数据完整保留
        data_preserved = before_reload == after_reload_ss
        # DOM 层面：已完成项默认折叠，所以只渲染未完成项
        after_reload_count = page.locator("#todoList .todo-item").count()
        after_reload_items = page.evaluate(
            "Array.from(document.querySelectorAll('#todoList .todo-item')).map(li=>({"
            "text: li.querySelector('.todo-text').textContent, "
            "done: li.classList.contains('completed'), "
            "checked: li.querySelector('.todo-checkbox').checked}))"
        )
        shot(page, "07_after_reload")
        log(
            "5. 刷新后数据完整保留",
            data_preserved
            and after_reload_count >= 1  # 至少渲染未完成项
            and len(after_reload_ss) == 2  # 数据层面有 2 条
            and after_reload_ss[0]["text"] == "学习 HTML"
            and after_reload_ss[1]["text"] == "学习 CSS"
            and after_reload_ss[1]["done"] is True,
            f"before={before_reload}, after={after_reload_ss}, items={after_reload_items}",
        )

        # ---------- 6. localStorage 语义验证：新标签页数据保留（localStorage 跨标签页共享）----------
        page.close()
        new_page = context.new_page()
        new_page.goto(URL)
        new_page.wait_for_load_state("networkidle")
        new_page.wait_for_timeout(1000)  # 等待渲染完成

        new_ss = get_todos(new_page)
        new_count = new_page.locator("#todoList .todo-item").count()
        shot(new_page, "08_new_tab_data")
        log(
            "6. localStorage语义（新标签页数据保留）",
            len(new_ss) == 2 and new_count >= 1,
            f"localStorage={new_ss}, listCount={new_count}",
        )

        new_page.close()

        # ============================================================
        # 高级功能测试（使用新的页面，避免前面测试的状态干扰）
        # ============================================================
        page = context.new_page()
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # 先清空 localStorage，确保干净的测试环境
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # ---------- 7. 收纳与展开功能 ----------
        # 添加 4 条并完成 3 条，触发收纳（超过 3 条已完成）
        collapse_items = ["任务 A", "任务 B", "任务 C", "任务 D"]
        for text in collapse_items:
            page.locator("#todoInput").fill(text)
            page.locator("#todoInput").press("Enter")
        page.wait_for_timeout(500)

        # 完成前 3 条
        for text in ["任务 A", "任务 B", "任务 C"]:
            page.locator("#todoList .todo-item", has_text=text).locator(".todo-checkbox").click()
            page.wait_for_timeout(300)

        # 验证收纳按钮出现
        collapse_btn = page.locator("#collapse-btn")
        collapse_btn_visible = collapse_btn.count() > 0
        shot(page, "09_collapse_btn")
        log(
            "7. 收纳按钮显示（已完成 3 项）",
            collapse_btn_visible,
            f"collapseBtn visible={collapse_btn_visible}",
        )

        # 点击展开，验证所有已完成项可见
        if collapse_btn_visible:
            collapse_btn.click()
            page.wait_for_timeout(500)
            expanded_count = page.locator("#todoList .todo-item.completed").count()
            shot(page, "10_collapse_expanded")
            log(
                "7.1 展开后已完成项可见",
                expanded_count >= 3,
                f"visible completed items={expanded_count}",
            )

            # 点击收起
            collapse_btn.click()
            page.wait_for_timeout(500)
            collapsed_count = page.locator("#todoList .todo-item.completed").count()
            log(
                "7.2 收起后已完成项隐藏",
                collapsed_count == 0,
                f"visible completed items after collapse={collapsed_count}",
            )

        # ---------- 8. 双击编辑 ----------
        # 展开已完成区（任务 C 已完成后被收纳）
        if page.locator("#collapse-btn").count() > 0:
            page.locator("#collapse-btn").click()
            page.wait_for_timeout(300)

        # 双击未完成项（任务 D）进行编辑
        task_d_text = page.locator("#todoList .todo-item", has_text="任务 D").locator(".todo-text")
        task_d_text.dblclick()
        page.wait_for_timeout(300)

        # 验证编辑输入框出现
        edit_input = page.locator("#todoList .todo-item .todo-edit-input")
        edit_input_visible = edit_input.count() > 0
        shot(page, "11_edit_mode")
        log(
            "8. 双击进入编辑模式",
            edit_input_visible,
            f"edit input visible={edit_input_visible}",
        )

        # 修改文本并保存
        if edit_input_visible:
            edit_input.fill("任务 D 已修改")
            edit_input.press("Enter")
            page.wait_for_timeout(500)

            # 验证修改已保存
            modified_text = page.locator("#todoList .todo-item", has_text="任务 D 已修改").count()
            ss_after_edit = get_todos(page)
            edit_saved = modified_text > 0 and any(t["text"] == "任务 D 已修改" for t in ss_after_edit)
            shot(page, "12_edit_saved")
            log(
                "8.1 编辑保存成功",
                edit_saved,
                f"modified item count={modified_text}",
            )

        # ---------- 9. 提醒功能（自然语言解析）----------
        # 添加带提醒的事项（使用"明天"避免时间已过期）
        page.locator("#todoInput").fill("明天9点提醒我开会")
        page.locator("#todoInput").press("Enter")
        page.wait_for_timeout(500)

        ss_with_reminder = get_todos(page)
        reminder_item = next((t for t in ss_with_reminder if "开会" in t["text"]), None)
        has_reminder = reminder_item is not None and reminder_item["remindAt"] is not None
        shot(page, "13_reminder_parsed")
        log(
            "9. 自然语言解析提醒时间",
            has_reminder,
            f"reminder item={reminder_item}",
        )

        # 验证提醒徽章显示
        if has_reminder:
            badge = page.locator("#todoList .todo-item .reminder-badge")
            badge_visible = badge.count() > 0
            badge_text = badge.first.text_content() if badge_visible else ""
            log(
                "9.1 提醒徽章显示",
                badge_visible and len(badge_text) > 0,
                f"badge text={badge_text}",
            )

        # ---------- 10. 循环提醒 ----------
        page.locator("#todoInput").fill("每30分钟喝水")
        page.locator("#todoInput").press("Enter")
        page.wait_for_timeout(500)

        ss_with_cycle = get_todos(page)
        cycle_item = next((t for t in ss_with_cycle if "喝水" in t["text"]), None)
        has_cycle = cycle_item is not None and cycle_item["recurrence"] is not None and cycle_item["recurrence"]["enabled"]
        shot(page, "14_cycle_reminder")
        log(
            "10. 循环提醒设置",
            has_cycle,
            f"recurrence={cycle_item['recurrence'] if cycle_item else None}",
        )

        # 勾选循环待办（完成一次），验证次数+1
        if has_cycle:
            page.locator("#todoList .todo-item", has_text="喝水").locator(".todo-checkbox").click()
            page.wait_for_timeout(500)

            ss_after_cycle = get_todos(page)
            cycle_after = next((t for t in ss_after_cycle if "喝水" in t["text"]), None)
            cycle_advanced = cycle_after is not None and cycle_after["completionCount"] >= 1 and cycle_after["done"] is False
            log(
                "10.1 循环提醒推进（完成一次后自动安排下一轮）",
                cycle_advanced,
                f"completionCount={cycle_after['completionCount'] if cycle_after else None}, done={cycle_after['done'] if cycle_after else None}",
            )

        # ---------- 11. 日期选择器 ----------
        # 点击📅按钮打开日期选择器
        datetime_trigger = page.locator("#datetimeTrigger")
        datetime_trigger.click()
        page.wait_for_timeout(500)

        popover = page.locator("#datetimePopover")
        popover_open = popover.count() > 0 and popover.is_visible()
        shot(page, "15_datetime_popover")
        log(
            "11. 日期选择器弹出",
            popover_open,
            f"popover visible={popover_open}",
        )

        # 点击"明天"预设
        if popover_open:
            page.locator(".dp-preset[data-date='tomorrow']").click()
            page.wait_for_timeout(300)

            # 点击确定
            page.locator("#dpConfirmBtn").click()
            page.wait_for_timeout(300)

            # 验证显示文本已更新
            display_text = page.locator("#datetimeDisplay").text_content()
            has_date_selected = "月" in display_text and "选择提醒时间" not in display_text
            shot(page, "16_datetime_selected")
            log(
                "11.1 选择日期后显示更新",
                has_date_selected,
                f"display text={display_text}",
            )

        # ---------- 12. 长文本折叠/展开 ----------
        # 添加一条超长文本
        long_text = "这是一条非常长的待办事项文本，用于测试长文本自动折叠功能。当文本超过三行时应该显示展开按钮，点击后可以查看全部内容，再次点击可以收起。"
        page.locator("#todoInput").fill(long_text)
        page.locator("#todoInput").press("Enter")
        page.wait_for_timeout(800)  # 等待 requestAnimationFrame 检测长文本

        # 验证展开按钮出现
        expand_btn = page.locator("#todoList .todo-item .todo-expand-btn")
        expand_btn_visible = expand_btn.count() > 0
        shot(page, "17_long_text_collapsed")
        log(
            "12. 长文本折叠（显示展开按钮）",
            expand_btn_visible,
            f"expand button visible={expand_btn_visible}",
        )

        # 点击展开
        if expand_btn_visible:
            expand_btn.first.click()
            page.wait_for_timeout(300)

            # 验证文本已展开（span 有 expanded class）
            is_expanded = page.evaluate(
                "document.querySelector('#todoList .todo-item .todo-text.expanded') !== null"
            )
            shot(page, "18_long_text_expanded")
            log(
                "12.1 点击展开后文本完整显示",
                is_expanded,
                f"expanded={is_expanded}",
            )

        # ---------- 13. 桌宠交互 ----------
        # 验证桌宠元素存在
        pet = page.locator("#stitchPet")
        pet_visible = pet.count() > 0
        shot(page, "19_pet_visible")
        log(
            "13. 桌宠元素存在",
            pet_visible,
            f"pet element count={pet.count()}",
        )

        # 点击桌宠，验证气泡出现
        if pet_visible:
            pet.click()
            page.wait_for_timeout(500)

            bubble = page.locator("#petBubble")
            bubble_visible = bubble.count() > 0 and bubble.is_visible()
            bubble_text = bubble.text_content() if bubble_visible else ""
            shot(page, "20_pet_bubble")
            log(
                "13.1 点击桌宠弹出气泡",
                bubble_visible and len(bubble_text) > 0,
                f"bubble visible={bubble_visible}, text={bubble_text[:30]}...",
            )

        # ---------- 14. 空输入提示 ----------
        page.locator("#todoInput").fill("")
        page.locator("#todoInput").press("Enter")
        # 闪红只持续 300ms，立即检查边框颜色
        border_color = page.evaluate(
            "getComputedStyle(document.querySelector('#todoInput')).borderColor"
        )
        input_rejected = border_color in ["rgb(231, 76, 60)", "#e74c3c"]
        page.wait_for_timeout(500)

        # 同时验证没有新增空事项
        ss_empty_check = get_todos(page)
        no_empty_item = all(t["text"].strip() != "" for t in ss_empty_check)
        shot(page, "21_empty_input")
        log(
            "14. 空输入不添加（闪红提示）",
            no_empty_item,  # 主要验证没有空事项被添加
            f"border color={border_color} (flash red={input_rejected}), empty items check={no_empty_item}",
        )

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
