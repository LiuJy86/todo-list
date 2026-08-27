"""
测试模块 1: 待办事项 CRUD 操作
覆盖功能：添加、完成、删除、编辑、空状态、收纳展开
"""
import pytest
from playwright.sync_api import Page, expect


def has_class(locator, class_name):
    """检查元素是否包含某个 class"""
    classes = locator.get_attribute("class") or ""
    return class_name in classes.split()


class TestTodoAdd:
    """添加待办事项"""

    def test_add_todo_by_button(self, page: Page):
        """通过添加按钮添加待办"""
        page.fill("#todoInput", "测试待办1")
        page.click("#addBtn")
        expect(page.locator(".todo-item")).to_have_count(1)
        expect(page.locator(".todo-item").first.locator(".todo-text")).to_have_text("测试待办1")

    def test_add_todo_by_enter(self, page: Page):
        """通过回车键添加待办"""
        page.fill("#todoInput", "回车添加测试")
        page.press("#todoInput", "Enter")
        expect(page.locator(".todo-item")).to_have_count(1)
        expect(page.locator(".todo-item").first.locator(".todo-text")).to_have_text("回车添加测试")

    def test_add_multiple_todos(self, page: Page):
        """添加多个待办，验证倒序排列（最新在上）"""
        for text in ["第一个", "第二个", "第三个"]:
            page.fill("#todoInput", text)
            page.press("#todoInput", "Enter")
            page.wait_for_timeout(100)

        items = page.locator(".todo-item")
        expect(items).to_have_count(3)
        expect(items.nth(0).locator(".todo-text")).to_have_text("第三个")
        expect(items.nth(1).locator(".todo-text")).to_have_text("第二个")
        expect(items.nth(2).locator(".todo-text")).to_have_text("第一个")

    def test_add_empty_todo(self, page: Page):
        """空内容不应添加待办"""
        page.click("#addBtn")
        page.wait_for_timeout(200)
        expect(page.locator(".todo-item")).to_have_count(0)

    def test_add_whitespace_todo(self, page: Page):
        """纯空格不应添加待办"""
        page.fill("#todoInput", "   ")
        page.click("#addBtn")
        page.wait_for_timeout(200)
        expect(page.locator(".todo-item")).to_have_count(0)


class TestTodoComplete:
    """完成/取消完成待办事项"""

    def test_complete_todo(self, page: Page):
        """勾选完成待办"""
        page.fill("#todoInput", "完成目标")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(150)
        page.fill("#todoInput", "未完成保持")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(300)

        expect(page.locator(".todo-item")).to_have_count(2)

        # 完成第一个可见项（使用 JS 点击）
        page.evaluate("document.querySelector('.todo-item .todo-checkbox').click()")
        page.wait_for_timeout(400)

        # 验证收纳按钮出现
        expect(page.locator("#collapseBtn")).to_be_visible()
        # 展开收纳区
        page.locator("#collapseBtn").click()
        page.wait_for_timeout(300)
        # 验证已完成项存在（class 是 completed）
        completed_items = page.locator(".todo-item.completed")
        expect(completed_items).to_have_count(1)
        expect(completed_items.first.locator(".todo-text")).to_have_text("未完成保持")

    def test_uncomplete_todo(self, page: Page):
        """取消完成状态"""
        page.fill("#todoInput", "取消完成测试")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(150)
        page.fill("#todoInput", "保持未完成")
        page.press("#todoInput", "Enter")
        page.wait_for_timeout(300)

        # 完成第一个
        page.evaluate("document.querySelector('.todo-item .todo-checkbox').click()")
        page.wait_for_timeout(400)
        expect(page.locator("#collapseBtn")).to_be_visible()

        # 展开并取消完成
        page.locator("#collapseBtn").click()
        page.wait_for_timeout(300)
        page.evaluate("document.querySelector('.todo-item.completed .todo-checkbox').click()")
        page.wait_for_timeout(400)

        # 收纳按钮应消失（没有已完成项了）
        expect(page.locator("#collapseBtn")).not_to_be_visible()

    def test_complete_move_to_bottom(self, page: Page):
        """完成的事项应移动到底部（收纳区）"""
        for text in ["未完成A", "未完成B", "未完成C"]:
            page.fill("#todoInput", text)
            page.press("#todoInput", "Enter")
            page.wait_for_timeout(100)

        expect(page.locator(".todo-item")).to_have_count(3)
        # 完成第一个可见项（最新添加的未完成C）
        page.evaluate("document.querySelector('.todo-item .todo-checkbox').click()")
        page.wait_for_timeout(400)

        # 验证收纳按钮出现
        expect(page.locator("#collapseBtn")).to_be_visible()
        # 展开
        page.locator("#collapseBtn").click()
        page.wait_for_timeout(300)
        # 未完成C 应在收纳区
        completed_items = page.locator(".todo-item.completed")
        expect(completed_items).to_have_count(1)
        expect(completed_items.first.locator(".todo-text")).to_have_text("未完成C")


class TestTodoDelete:
    """删除待办事项"""

    def test_delete_todo(self, page: Page):
        """删除待办"""
        page.fill("#todoInput", "删除测试")
        page.press("#todoInput", "Enter")
        expect(page.locator(".todo-item")).to_have_count(1)

        page.locator(".todo-item").hover()
        page.wait_for_timeout(200)
        page.locator(".todo-item .delete-btn").click()
        page.wait_for_timeout(500)

        expect(page.locator(".todo-item")).to_have_count(0)

    def test_delete_multiple_todos(self, page: Page):
        """删除多个待办"""
        for i in range(3):
            page.fill("#todoInput", f"待办{i}")
            page.press("#todoInput", "Enter")
            page.wait_for_timeout(100)

        expect(page.locator(".todo-item")).to_have_count(3)
        page.locator(".todo-item").first.hover()
        page.wait_for_timeout(200)
        page.locator(".todo-item").first.locator(".delete-btn").click()
        page.wait_for_timeout(500)

        expect(page.locator(".todo-item")).to_have_count(2)


class TestTodoEdit:
    """编辑待办事项"""

    def test_edit_todo_by_double_click(self, page: Page):
        """双击编辑待办"""
        page.fill("#todoInput", "原始文本")
        page.press("#todoInput", "Enter")
        expect(page.locator(".todo-item")).to_have_count(1)

        page.locator(".todo-text").dblclick()
        expect(page.locator(".todo-edit-input")).to_be_visible()

        page.locator(".todo-edit-input").fill("修改后的文本")
        page.locator(".todo-edit-input").press("Enter")
        page.wait_for_timeout(300)

        expect(page.locator(".todo-text")).to_have_text("修改后的文本")

    def test_edit_cancel_by_escape(self, page: Page):
        """按 Esc 取消编辑"""
        page.fill("#todoInput", "原始内容")
        page.press("#todoInput", "Enter")
        expect(page.locator(".todo-item")).to_have_count(1)

        page.locator(".todo-text").dblclick()
        expect(page.locator(".todo-edit-input")).to_be_visible()

        page.locator(".todo-edit-input").fill("新内容")
        page.locator(".todo-edit-input").press("Escape")
        page.wait_for_timeout(300)

        expect(page.locator(".todo-text")).to_have_text("原始内容")


class TestEmptyState:
    """空状态显示"""

    def test_empty_state_visible(self, page: Page):
        """无待办时显示空状态"""
        expect(page.locator("#emptyState")).to_be_visible()

    def test_empty_state_hidden_when_has_todos(self, page: Page):
        """有待办时隐藏空状态"""
        page.fill("#todoInput", "测试")
        page.press("#todoInput", "Enter")
        expect(page.locator(".todo-item")).to_have_count(1)
        expect(page.locator("#emptyState")).not_to_be_visible()

    def test_empty_example_buttons(self, page: Page):
        """空状态示例按钮可点击添加"""
        expect(page.locator("#emptyState")).to_be_visible()
        page.locator(".empty-example-btn").first.click()
        page.wait_for_timeout(300)
        input_val = page.locator("#todoInput").input_value()
        assert len(input_val) > 0, "示例按钮应填入输入框"


class TestCollapse:
    """收纳展开功能"""

    def test_collapse_completed(self, page: Page):
        """收纳已完成事项"""
        for i in range(4):
            page.fill("#todoInput", f"待办{i}")
            page.press("#todoInput", "Enter")
            page.wait_for_timeout(100)

        expect(page.locator(".todo-item")).to_have_count(4)

        # 完成所有
        page.evaluate("""
            var cbs = document.querySelectorAll('.todo-item .todo-checkbox');
            for (var i = 0; i < cbs.length; i++) cbs[i].click();
        """)
        page.wait_for_timeout(500)

        expect(page.locator("#collapseBtn")).to_be_visible()

    def test_expand_collapsed(self, page: Page):
        """展开已收纳事项"""
        for i in range(3):
            page.fill("#todoInput", f"待办{i}")
            page.press("#todoInput", "Enter")
            page.wait_for_timeout(100)

        expect(page.locator(".todo-item")).to_have_count(3)

        # 完成所有
        page.evaluate("""
            var cbs = document.querySelectorAll('.todo-item .todo-checkbox');
            for (var i = 0; i < cbs.length; i++) cbs[i].click();
        """)
        page.wait_for_timeout(500)

        expect(page.locator("#collapseBtn")).to_be_visible()

        # 展开
        page.locator("#collapseBtn").click()
        page.wait_for_timeout(300)

        items = page.locator(".todo-item")
        expect(items).to_have_count(3)
