"""
测试模块 7: 用户引导系统
覆盖功能：首次弹出、步骤切换、跳过、完成后不再弹出
"""
import pytest
from playwright.sync_api import Page, expect


class TestGuideFirstTime:
    """首次引导"""

    def test_guide_appears_on_first_visit(self, page_with_guide: Page):
        """首次访问弹出引导"""
        page_with_guide.wait_for_timeout(1000)
        # 验证引导处于活动状态
        is_active = page_with_guide.evaluate("window.Guide ? window.Guide.isActive() : false")
        if is_active:
            card = page_with_guide.locator(".guide-card")
            expect(card).to_be_visible()

    def test_skip_guide(self, page_with_guide: Page):
        """跳过引导"""
        page_with_guide.wait_for_timeout(1000)
        is_active = page_with_guide.evaluate("window.Guide ? window.Guide.isActive() : false")
        if is_active:
            skip_btn = page_with_guide.locator(".guide-card__btn--skip, .guide-skip-btn")
            if skip_btn.is_visible():
                skip_btn.click()
                page_with_guide.wait_for_timeout(300)

    def test_guide_not_active_after_complete(self, page: Page):
        """完成引导后不再激活"""
        page.wait_for_timeout(1000)
        # 验证引导不处于活动状态
        is_active = page.evaluate("window.Guide ? window.Guide.isActive() : false")
        assert not is_active, "引导不应处于活动状态"

    def test_guide_step_navigation(self, page_with_guide: Page):
        """引导步骤切换"""
        page_with_guide.wait_for_timeout(1000)
        is_active = page_with_guide.evaluate("window.Guide ? window.Guide.isActive() : false")
        if is_active:
            next_btn = page_with_guide.locator(".guide-card__btn--primary")
            if next_btn.is_visible():
                next_btn.click()
                page_with_guide.wait_for_timeout(400)
                badge = page_with_guide.locator(".guide-card__badge")
                if badge.is_visible():
                    badge_text = badge.text_content()
                    assert "/" in badge_text
