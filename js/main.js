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

    // 系統資訊與建立者致敬彩蛋 (Console Easter Egg)
    if (typeof console !== 'undefined' && console.log) {
        console.log(
            "%c🎒 QRcode自動清點作業系統 %cVer. 3.4.3\n" +
            "%c📍 創立與開發者：新北市林口區麗園國民小學 楊家驊 老師\n" +
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
            "📖 系統開發歷程與時間表：\n" +
            " • 2026/07 (Ver 1.0) 系統誕生：相機掃碼清點、防偽QR生成、GAS雲端試算表雙向同步\n" +
            " • 2026/08 (Ver 1.4~2.0) 自動化溝通：缺交提醒單多情境模板、個人成績報表PDF、聯絡簿專用沒帶優化\n" +
            " • 2026/10 初 (Ver 2.2~3.0) 核心擴充：GAS雲端免手動熱更新引擎、多班級無縫切換、智慧連線診斷\n" +
            " • 2026/10 中 (Ver 3.1~3.3) 原生手感與家長端：Apple HIG原生動效、parent.html家長手札、LINE推播中心\n" +
            " • 2026/10 下 (Ver 3.4~3.4.3) 資安深化：學生姓名去識別化、離線佇列盲掃、雙端專屬Favicon、1970假別自動修復\n" +
            " • 2026/10 底 中樞直連：接入 School LINE Hub 校園推播中樞、請假補繳交視為準時繳交",
            "background: #1d4ed8; color: #ffffff; font-size: 13px; font-weight: bold; padding: 3px 8px; border-radius: 4px;",
            "color: #475569; font-size: 11px; font-weight: bold;",
            "color: #0f172a; font-size: 11px; line-height: 1.6;"
        );
    }
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
                    <div style="text-align: left; max-height: 350px; overflow-y: auto; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        ${latestChangeHTML}
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
