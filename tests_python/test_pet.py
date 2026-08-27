"""
测试模块 4: 史迪奇桌宠
覆盖功能：显示/隐藏、拖拽、对话气泡
"""
import pytest
from playwright.sync_api import Page, expect


class TestPetDisplay:
    """桌宠显示"""

    def test_pet_visible_on_load(self, page: Page):
        """页面加载时桌宠可见"""
        pet = page.locator("#stitchPet")
        expect(pet).to_be_visible()

    def test_pet_has_image(self, page: Page):
        """桌宠有图片"""
        pet_img = page.locator("#petImg")
        expect(pet_img).to_be_visible()
        src = pet_img.get_attribute("src")
        assert "史迪奇" in src or "stitch" in src.lower()

    def test_pet_close_button(self, page: Page):
        """关闭按钮可点击"""
        close_btn = page.locator("#petClose")
        expect(close_btn).to_be_visible()

    def test_pet_hide(self, page: Page):
        """点击关闭隐藏桌宠"""
        # 使用 JS 点击避免遮挡问题
        page.evaluate("document.getElementById('petClose').click()")
        page.wait_for_timeout(300)
        pet = page.locator("#stitchPet")
        # 验证桌宠被隐藏（通过 CSS class 或 style）
        is_hidden = page.evaluate("""
            var pet = document.getElementById('stitchPet');
            pet.style.display === 'none' || pet.classList.contains('hidden') ||
            getComputedStyle(pet).display === 'none' || getComputedStyle(pet).visibility === 'hidden';
        """)
        assert is_hidden, "桌宠应被隐藏"


class TestPetBubble:
    """对话气泡"""

    def test_bubble_hidden_initially(self, page: Page):
        """初始状态气泡隐藏"""
        bubble = page.locator("#petBubble")
        expect(bubble).not_to_be_visible()


class TestPetDrag:
    """桌宠拖拽"""

    def test_pet_draggable(self, page: Page):
        """桌宠可拖拽移动"""
        pet = page.locator("#stitchPet")
        initial_box = pet.bounding_box()
        assert initial_box is not None

        # 拖拽
        page.mouse.move(initial_box["x"] + 50, initial_box["y"] + 50)
        page.mouse.down()
        page.mouse.move(initial_box["x"] + 200, initial_box["y"] + 200, steps=10)
        page.mouse.up()
        page.wait_for_timeout(300)

        new_box = pet.bounding_box()
        assert new_box is not None
        assert new_box["x"] != initial_box["x"] or new_box["y"] != initial_box["y"]
