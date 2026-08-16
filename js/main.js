// ==========================================
// 全域系統初始化與快捷鍵 (Main & Shortcuts)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 監聽全域快捷鍵
    document.addEventListener('keydown', (e) => {
        // 忽略輸入框內的按鍵
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            return;
        }

        // Space 鍵：在掃描頁面 (tabIndex === 1) 暫停/繼續相機
        if (e.code === 'Space') {
            const scanTab = document.getElementById('tab-1');
            if (scanTab && !scanTab.classList.contains('hidden') && scanTab.classList.contains('active')) {
                e.preventDefault(); // 防止網頁捲動
                const toggleBtn = document.getElementById('toggle-scan-btn');
                if (toggleBtn && typeof toggleScanner === 'function') {
                    toggleScanner();
                } else if (typeof toggleCustomScanner === 'function') {
                    toggleCustomScanner();
                }
            }
        }

        // Ctrl + S (或 Cmd + S)：觸發雲端同步
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault(); // 阻擋瀏覽器預設存檔
            if (typeof syncToCloud === 'function') {
                syncToCloud();
            } else {
                alert('雲端同步尚未設定。');
            }
        }
    });

    console.log("System initialized with shortcuts.");
});
