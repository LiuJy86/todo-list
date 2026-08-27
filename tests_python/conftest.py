"""
Playwright 验收测试 - 配置和共享 fixtures
"""
import pytest
import os
from playwright.sync_api import sync_playwright, Page, Browser

# 项目根目录和页面路径
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(PROJECT_ROOT, "src")
INDEX_URL = "file:///" + os.path.join(SRC_DIR, "index.html").replace("\\", "/")
SETTINGS_URL = "file:///" + os.path.join(SRC_DIR, "settings.html").replace("\\", "/")


@pytest.fixture(scope="session")
def browser():
    """启动浏览器（有头模式）"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        yield browser
        browser.close()


@pytest.fixture(scope="function")
def page(browser: Browser) -> Page:
    """每个测试用例使用新页面，引导默认已关闭"""
    context = browser.new_context(viewport={"width": 900, "height": 700})
    page = context.new_page()
    # 在页面加载前注入脚本：关闭引导 + 清除数据
    page.add_init_script("""
        localStorage.clear();
        localStorage.setItem('guide_tour_done', '1');
    """)
    page.goto(INDEX_URL)
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(500)
    yield page
    context.close()


@pytest.fixture(scope="function")
def page_no_clear(browser: Browser) -> Page:
    """不清除 localStorage 的页面（用于测试数据持久化）"""
    context = browser.new_context(viewport={"width": 900, "height": 700})
    page = context.new_page()
    page.add_init_script("""
        localStorage.setItem('guide_tour_done', '1');
    """)
    page.goto(INDEX_URL)
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(500)
    yield page
    context.close()


@pytest.fixture(scope="function")
def page_with_guide(browser: Browser) -> Page:
    """保留引导的页面（用于测试引导系统）"""
    context = browser.new_context(viewport={"width": 900, "height": 700})
    page = context.new_page()
    page.add_init_script("localStorage.clear();")
    page.goto(INDEX_URL)
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(800)
    yield page
    context.close()
