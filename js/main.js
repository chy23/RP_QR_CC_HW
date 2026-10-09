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
        
        // If versions differ, prompt update
        if (newVersion !== currentVersion) {
            // Find the changelog block
            const changelogContainer = doc.querySelector('.p-6.overflow-y-auto.space-y-6');
            let latestChangeHTML = '';
            if (changelogContainer) {
                const firstBlock = changelogContainer.querySelector('.border-l-4');
                if (firstBlock) {
                    latestChangeHTML = firstBlock.outerHTML;
                }
            }
            
            const newGasCode = doc.getElementById('gas-code-block') ? doc.getElementById('gas-code-block').innerText : '';
            
            Swal.fire({
                title: '🎉 發現新版本！',
                html: `
                    <div style="text-align: left; max-height: 350px; overflow-y: auto; padding: 15px; background: #f8fafc; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e2e8f0;">
                        ${latestChangeHTML}
                    </div>
                    <div style="text-align: left; font-weight: bold; color: #047857; font-size: 14px; background: #d1fae5; padding: 12px; border-radius: 6px; border: 1px solid #10b981; display: flex; align-items: center; gap: 8px;">
                        <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        系統已透過「自動更新引擎」完成後端無縫升級，您無須重新部署任何程式碼！
                    </div>
                `,
                icon: 'success',
                width: '650px',
                confirmButtonText: '立即重新載入網頁',
                showCancelButton: true,
                cancelButtonText: '稍後再說',
                confirmButtonColor: '#2563eb',
                cancelButtonColor: '#9ca3af',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.reload(true);

                }
            });
        }
    } catch (e) {
        console.error("Failed to check for updates", e);
    }
}

// Global hook to check when window gains focus
window.addEventListener('focus', () => {
    const lastCheck = sessionStorage.getItem('lastUpdateCheck');
    const now = new Date().getTime();
    if (!lastCheck || now - parseInt(lastCheck) > 5 * 60 * 1000) {
        sessionStorage.setItem('lastUpdateCheck', now);
        checkForUpdates();
    }
});

// Check shortly after init
setTimeout(checkForUpdates, 3000);
