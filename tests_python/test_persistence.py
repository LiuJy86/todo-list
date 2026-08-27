"""
测试模块 6: 数据持久化
覆盖功能：localStorage 保存、页面刷新恢复、数据迁移
"""
import pytest
from playwright.sync_api import Page, expect


class TestLocalStoragePersistence:
    """localStorage 持久化"""

    def test_todos_saved_to_localstorage(self, page: Page):
        """待办保存到 localStorage"""
        page.fill("#todoInput", "持久化测试")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(400)

        data = page.evaluate("localStorage.getItem('todos')")
        assert data is not None
        assert "持久化测试" in data

    def test_todos_restored_in_new_page(self, browser):
        """新页面能读取持久化的数据"""
        from playwright.sync_api import Browser
        context = browser.new_context(viewport={"width": 900, "height": 700})
        page1 = context.new_page()
        page1.add_init_script("localStorage.clear(); localStorage.setItem('guide_tour_done', '1');")
        page1.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page1.wait_for_load_state("domcontentloaded")
        page1.wait_for_timeout(500)

        page1.fill("#todoInput", "恢复测试1")
        page1.press("#todoInput", "Enter")
        page1.wait_for_timeout(200)
        page1.fill("#todoInput", "恢复测试2")
        page1.press("#todoInput", "Enter")
        page1.wait_for_timeout(400)

        expect(page1.locator(".todo-item")).to_have_count(2)

        # 打开新页面（同一 context，共享 localStorage）
        page2 = context.new_page()
        page2.add_init_script("localStorage.setItem('guide_tour_done', '1');")
        page2.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page2.wait_for_load_state("domcontentloaded")
        page2.wait_for_timeout(500)

        expect(page2.locator(".todo-item")).to_have_count(2)
        context.close()

    def test_completed_state_preserved(self, browser):
        """完成状态持久化"""
        from playwright.sync_api import Browser
        context = browser.new_context(viewport={"width": 900, "height": 700})
        page1 = context.new_page()
        page1.add_init_script("localStorage.clear(); localStorage.setItem('guide_tour_done', '1');")
        page1.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page1.wait_for_load_state("domcontentloaded")
        page1.wait_for_timeout(500)

        page1.fill("#todoInput", "完成状态测试")
        page1.press("#todoInput", "Enter")
        page1.wait_for_timeout(150)
        page1.fill("#todoInput", "保持未完成")
        page1.press("#todoInput", "Enter")
        page1.wait_for_timeout(300)

        page1.evaluate("document.querySelector('.todo-item .todo-checkbox').click()")
        page1.wait_for_timeout(400)

        # 新页面
        page2 = context.new_page()
        page2.add_init_script("localStorage.setItem('guide_tour_done', '1');")
        page2.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page2.wait_for_load_state("domcontentloaded")
        page2.wait_for_timeout(500)

        expect(page2.locator("#collapseBtn")).to_be_visible()
        context.close()

    def test_deleted_todo_not_restored(self, page: Page):
        """删除后刷新不恢复"""
        page.fill("#todoInput", "删除不恢复")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(300)

        page.locator(".todo-item").hover()
        page.wait_for_timeout(200)
        page.locator(".todo-item .delete-btn").click()
        page.wait_for_timeout(500)

        # 验证 localStorage 中已删除
        data = page.evaluate("localStorage.getItem('todos')")
        assert "删除不恢复" not in data

    def test_reminder_preserved(self, browser):
        """提醒时间持久化"""
        from playwright.sync_api import Browser
        context = browser.new_context(viewport={"width": 900, "height": 700})
        page1 = context.new_page()
        page1.add_init_script("localStorage.clear(); localStorage.setItem('guide_tour_done', '1');")
        page1.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page1.wait_for_load_state("domcontentloaded")
        page1.wait_for_timeout(500)

        page1.fill("#todoInput", "明天10点开会")
        page1.press("#todoInput", "Enter")
        page1.wait_for_timeout(400)

        # 新页面
        page2 = context.new_page()
        page2.add_init_script("localStorage.setItem('guide_tour_done', '1');")
        page2.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page2.wait_for_load_state("domcontentloaded")
        page2.wait_for_timeout(500)

        badge = page2.locator(".todo-item .reminder-badge")
        expect(badge).to_be_visible()
        context.close()

    def test_cycle_preserved(self, browser):
        """循环设置持久化"""
        from playwright.sync_api import Browser
        context = browser.new_context(viewport={"width": 900, "height": 700})
        page1 = context.new_page()
        page1.add_init_script("localStorage.clear(); localStorage.setItem('guide_tour_done', '1');")
        page1.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page1.wait_for_load_state("domcontentloaded")
        page1.wait_for_timeout(500)

        page1.fill("#todoInput", "每天8点喝水")
        page1.press("#todoInput", "Enter")
        page1.wait_for_timeout(400)

        # 新页面
        page2 = context.new_page()
        page2.add_init_script("localStorage.setItem('guide_tour_done', '1');")
        page2.goto("file:///" + os.path.join(PROJECT_ROOT, "src", "index.html").replace("\\", "/"))
        page2.wait_for_load_state("domcontentloaded")
        page2.wait_for_timeout(500)

        cycle_badge = page2.locator(".todo-item .reminder-badge-cycle")
        expect(cycle_badge).to_be_visible()
        context.close()


class TestDataMigration:
    """数据迁移"""

    def test_sessionstorage_migration(self, page: Page):
        """sessionStorage 数据迁移到 localStorage"""
        page.evaluate("""
            sessionStorage.setItem('todos', JSON.stringify([
                {id: 1, text: '迁移测试', done: false, reminders: [], recurrence: null, completionCount: 0, lastRemindAt: null}
            ]));
        """)
        page.reload()
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(500)

        expect(page.locator(".todo-item")).to_have_count(1)
        expect(page.locator(".todo-item .todo-text")).to_have_text("迁移测试")

        session_data = page.evaluate("sessionStorage.getItem('todos')")
        assert session_data is None


import os
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
