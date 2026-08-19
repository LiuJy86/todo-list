# -*- coding: utf-8 -*-
"""
中文日期自然语言解析 - Playwright 自动化测试
测试需求：支持"八月十五号提醒我开会"等中文日期表达

验证点：
  1. "八月十五号提醒我开会" → 事项「开会」，提醒时间 8月15日 09:00
  2. "十二月三十一日提醒我过年" → 事项「过年」，提醒时间 12月31日 09:00
  3. "一月一号提醒我元旦" → 事项「元旦」，提醒时间 1月1日 09:00
  4. "八月十五号 8:00 提醒我开会" → 事项「开会」，提醒时间 8月15日 08:00
  5. 原有数字格式"8月15日 8:00 吃饭" → 依然正常
"""
import json
import os
import sys
from datetime import datetime
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


def add_todo(page, text: str):
    """在输入框输入文本并提交"""
    page.locator("#todoInput").fill(text)
    page.locator("#todoInput").press("Enter")
    page.wait_for_timeout(500)


def format_ts(ts):
    """时间戳格式化为'X月X日 HH:MM'"""
    d = datetime.fromtimestamp(ts / 1000)
    return f"{d.month}月{d.day}日 {d.hour:02d}:{d.minute:02d}"


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

        # ---------- 打开页面 ----------
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        # 清空 localStorage，确保测试环境干净
        page.evaluate("localStorage.removeItem('todos')")
        page.reload()
        page.wait_for_load_state("networkidle")

        # ---------- 测试 1：八月十五号提醒我开会 ----------
        add_todo(page, "八月十五号提醒我开会")
        todos = get_todos(page)
        # 期望：事项文本为"开会"，提醒时间为当年 8月15日 09:00
        t1 = todos[-1]
        expected_month_1 = datetime.now().month
        # 如果今年的 8月15日 已过，解析结果应为明年
        aug15_this_year = datetime(datetime.now().year, 8, 15, 9, 0)
        expected_year_1 = datetime.now().year if datetime.now() <= aug15_this_year else datetime.now().year + 1
        expected_ts_1 = datetime(expected_year_1, 8, 15, 9, 0).timestamp() * 1000

        shot(page, "01_chinese_aug15")
        log(
            "1. '八月十五号提醒我开会' → 8月15日 9:00, 事项'开会'",
            t1["text"] == "开会" and abs(t1["remindAt"] - expected_ts_1) < 60000,
            f"text={t1['text']}, remindAt={format_ts(t1['remindAt']) if t1['remindAt'] else None}, expected={expected_year_1}年8月15日 09:00",
        )

        # ---------- 测试 2：十二月三十一日提醒我过年 ----------
        add_todo(page, "十二月三十一日提醒我过年")
        todos = get_todos(page)
        t2 = todos[-1]
        dec31_this_year = datetime(datetime.now().year, 12, 31, 9, 0)
        expected_year_2 = datetime.now().year if datetime.now() <= dec31_this_year else datetime.now().year + 1
        expected_ts_2 = datetime(expected_year_2, 12, 31, 9, 0).timestamp() * 1000

        shot(page, "02_chinese_dec31")
        log(
            "2. '十二月三十一日提醒我过年' → 12月31日 9:00, 事项'过年'",
            t2["text"] == "过年" and abs(t2["remindAt"] - expected_ts_2) < 60000,
            f"text={t2['text']}, remindAt={format_ts(t2['remindAt']) if t2['remindAt'] else None}",
        )

        # ---------- 测试 3：一月一号提醒我元旦 ----------
        add_todo(page, "一月一号提醒我元旦")
        todos = get_todos(page)
        t3 = todos[-1]
        jan1_next_year = datetime(datetime.now().year + 1, 1, 1, 9, 0)
        expected_ts_3 = jan1_next_year.timestamp() * 1000

        shot(page, "03_chinese_jan01")
        log(
            "3. '一月一号提醒我元旦' → 1月1日 9:00, 事项'元旦'",
            t3["text"] == "元旦" and abs(t3["remindAt"] - expected_ts_3) < 60000,
            f"text={t3['text']}, remindAt={format_ts(t3['remindAt']) if t3['remindAt'] else None}",
        )

        # ---------- 测试 4：中文日期 + 数字时间 ----------
        add_todo(page, "八月十五号 8:00 提醒我开会")
        todos = get_todos(page)
        t4 = todos[-1]
        expected_ts_4 = datetime(expected_year_1, 8, 15, 8, 0).timestamp() * 1000

        shot(page, "04_chinese_date_with_time")
        log(
            "4. '八月十五号 8:00 提醒我开会' → 8月15日 8:00, 事项'开会'",
            t4["text"] == "开会" and abs(t4["remindAt"] - expected_ts_4) < 60000,
            f"text={t4['text']}, remindAt={format_ts(t4['remindAt']) if t4['remindAt'] else None}",
        )

        # ---------- 测试 5：原有数字格式依然正常 ----------
        add_todo(page, "8月15日 8:00 吃饭")
        todos = get_todos(page)
        t5 = todos[-1]
        expected_ts_5 = datetime(expected_year_1, 8, 15, 8, 0).timestamp() * 1000

        shot(page, "05_numeric_date_still_works")
        log(
            "5. 原有数字格式 '8月15日 8:00 吃饭' → 正常",
            t5["text"] == "吃饭" and abs(t5["remindAt"] - expected_ts_5) < 60000,
            f"text={t5['text']}, remindAt={format_ts(t5['remindAt']) if t5['remindAt'] else None}",
        )

        # ---------- 测试 6：UI 上徽章显示正确 ----------
        badge_text = page.locator("#todoList .todo-item .reminder-badge").first.inner_text()
        shot(page, "06_badge_display")
        log(
            "6. 提醒徽章显示日期",
            "月" in badge_text and "日" in badge_text,
            f"badgeText={badge_text}",
        )

        browser.close()

    # ---------- 汇总 ----------
    print("\n" + "=" * 50)
    print("中文日期解析测试汇总")
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
