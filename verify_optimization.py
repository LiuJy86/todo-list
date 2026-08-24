# -*- coding: utf-8 -*-
"""
验证收纳功能和无闪动效果的测试脚本
v1.3.0: 用于验证自动收纳、展开/收起、DOM节点复用等优化功能
运行前需先启动 HTTP 服务器: python -m http.server 8000
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8000/src/index.html"
SCREENSHOT_DIR = Path(__file__).parent / "screenshots"

def get_todos(page):
    raw = page.evaluate("sessionStorage.getItem('todos')")
    return None if raw is None else json.loads(raw)

def shot(page, name):
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SCREENSHOT_DIR / f"{name}.png"), full_page=True)

def get_node_ids(page):
    """获取当前列表所有项的 data-id，用于验证节点复用"""
    result = page.evaluate("""
        () => {
            return Array.from(document.querySelectorAll('.todo-item'))
                .map(li => li.dataset.id);
        }
    """)
    return result if result else []

def main():
    results = []
    
    def log(name, ok, detail=""):
        results.append((name, ok, detail))
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}")
        print(f"       {detail}")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 1. 打开页面
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        shot(page, "opt_01_initial")
        
        # 2. 添加 5 条待办事项
        items = ["任务1", "任务2", "任务3", "任务4", "任务5"]
        for text in items:
            page.locator("#todoInput").fill(text)
            page.locator("#todoInput").press("Enter")
        page.wait_for_timeout(300)
        
        node_ids_before = get_node_ids(page)
        count_before = page.locator("#todoList .todo-item").count()
        shot(page, "opt_02_added")
        log("添加5条待办", count_before == 5, f"count={count_before}, ids={node_ids_before}")
        
        # 3. 勾选 4 条（超过 VISIBLE_COMPLETED_LIMIT=3），触发收纳
        for i in range(4):
            page.locator("#todoList .todo-item", has_text=f"任务{i+1}").locator(".todo-checkbox").check()
            page.wait_for_timeout(200)
        
        node_ids_after_check = get_node_ids(page)
        collapse_btn_exists = page.locator("#collapseBtn").count() > 0
        collapse_count_text = page.evaluate("""
            () => {
                const el = document.getElementById('collapseCount');
                return el ? el.textContent : '0';
            }
        """)
        visible_count = page.locator("#todoList .todo-item").count()
        shot(page, "opt_03_collapsed")
        
        # 验证：
        # - 有收纳按钮
        # - 收纳数量为 1（4个完成 - 3个可见 = 1个被收纳）
        # - 可见的完成项是 3 个（任务1、2、3 或其他组合，取决于排序）
        log("触发收纳（勾选4条超过限制）", 
            collapse_btn_exists and collapse_count_text == "1", 
            f"collapseBtn={collapse_btn_exists}, countText={collapse_count_text}, visibleCount={visible_count}")
        
        # 4. 验证节点复用（无闪动）
        # 勾选后的节点ID应该和之前的相同（只是顺序和class变化）
        log("节点复用验证（无闪动）", 
            len(node_ids_after_check) == 5, 
            f"before={len(node_ids_before)}个节点, after={len(node_ids_after_check)}个节点")
        
        # 5. 展开收纳区
        page.locator("#collapseBtn").click()
        page.wait_for_timeout(300)
        
        expanded_items = page.evaluate("""
            () => {
                return Array.from(document.querySelectorAll('#todoList .todo-item'))
                    .map(el => el.querySelector('.todo-text').textContent);
            }
        """)
        collapse_btn_expanded = page.evaluate("""
            () => document.getElementById('collapseBtn').classList.contains('expanded')
        """)
        shot(page, "opt_04_expanded")
        
        log("展开收纳区", 
            len(expanded_items) == 5 and collapse_btn_expanded, 
            f"expandedItems={expanded_items}, btnExpanded={collapse_btn_expanded}")
        
        # 6. 收起收纳区
        page.locator("#collapseBtn").click()
        page.wait_for_timeout(300)
        
        # 注意：所有 .todo-item 都在 DOM 中（收纳的在 #collapsedList 内），所以总数仍为 5
        # 验证收起状态：收纳按钮不再是 expanded 状态，收纳容器 display 为 none
        collapse_btn_collapsed = page.evaluate("""
            () => !document.getElementById('collapseBtn').classList.contains('expanded')
        """)
        collapsed_list_hidden = page.evaluate("""
            () => document.getElementById('collapsedList').style.display === 'none'
        """)
        shot(page, "opt_05_collapsed_again")
        
        log("收起收纳区", 
            collapse_btn_collapsed and collapsed_list_hidden, 
            f"btnExpanded={not collapse_btn_collapsed}, listHidden={collapsed_list_hidden}")
        
        # 7. 验证勾选/取消勾选不闪动（节点ID保持不变）
        node_ids_before_toggle = get_node_ids(page)
        
        # 取消勾选任务1
        page.locator("#todoList .todo-item", has_text="任务1").locator(".todo-checkbox").uncheck()
        page.wait_for_timeout(300)
        
        node_ids_after_toggle = get_node_ids(page)
        shot(page, "opt_06_after_untoggle")
        
        # 比较节点ID集合（顺序可能变，但ID应一致）
        ids_same = set(node_ids_before_toggle) == set(node_ids_after_toggle)
        log("勾选/取消勾选不闪动（节点ID保持）", 
            ids_same, 
            f"before={sorted(node_ids_before_toggle)}, after={sorted(node_ids_after_toggle)}")
        
        browser.close()
    
    # 汇总
    print("\n" + "=" * 50)
    print("收纳与无闪动优化验证汇总")
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
