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
                showAlert('提示', '雲端同步尚未設定。');
            }
        }
    });

    console.log("System initialized with shortcuts.");
});
async function checkForUpdates() {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('t', new Date().getTime());
        const response = await fetch(url.toString());
        if (!response.ok) return;
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const newVersionSpan = doc.getElementById('version-display');
        const currentVersionSpan = document.getElementById('version-display');
        
        if (!newVersionSpan || !currentVersionSpan) return;
        
        const newVersion = newVersionSpan.getAttribute('data-version');
        const currentVersion = currentVersionSpan.getAttribute('data-version');
        
        if (newVersion !== currentVersion) {
            const changelogContainer = doc.querySelector('.p-6.overflow-y-auto.space-y-6');
            let latestChangeHTML = '';
            if (changelogContainer) {
                const firstBlock = changelogContainer.querySelector('.border-l-4');
                if (firstBlock) {
                    latestChangeHTML = firstBlock.outerHTML;
                }
            }
            
            Swal.fire({
                title: '🎉 發現新版本！',
                html: `
                    <div style="text-align: left; max-height: 400px; overflow-y: auto; padding: 10px; background: #f8fafc; border-radius: 8px;">
                        ${latestChangeHTML}
                    </div>
                    <div style="font-weight: bold; color: #b91c1c; margin-top: 15px;">
                        👉 步驟：請點擊下方「了解」，系統將引導您進行程式碼更新。
                    </div>
                `,
                icon: 'info',
                width: '600px',
                confirmButtonText: '了解',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({
                        title: '⚠️ 再次確認',
                        text: '系統即將重新載入以套用最新程式碼。如果有尚未同步的資料，建議先按「稍後再說」，手動同步後再手動重新整理網頁。確定要現在更新嗎？',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: '立即更新',
                        cancelButtonText: '稍後再說',
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        allowOutsideClick: false
                    }).then((res) => {
                        if (res.isConfirmed) {
                            window.location.reload(true);
                        }
                    });
                }
            });
        }
    } catch (e) {
        console.error("Failed to check for updates", e);
    }
}

window.addEventListener('focus', () => {
    const lastCheck = sessionStorage.getItem('lastUpdateCheck');
    const now = new Date().getTime();
    if (!lastCheck || now - parseInt(lastCheck) > 5 * 60 * 1000) {
        sessionStorage.setItem('lastUpdateCheck', now);
        checkForUpdates();
    }
});

setTimeout(checkForUpdates, 3000);
