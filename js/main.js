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
            
            const newGasCode = doc.getElementById('gas-code-block') ? doc.getElementById('gas-code-block').innerText : '';
            
            Swal.fire({
                title: '🎉 發現新版本！',
                html: `
                    <div style="text-align: left; max-height: 250px; overflow-y: auto; padding: 10px; background: #f8fafc; border-radius: 8px; margin-bottom: 15px;">
                        ${latestChangeHTML}
                    </div>
                    <div style="text-align: left; font-weight: bold; color: #b91c1c; margin-bottom: 10px; font-size: 14px;">
                        ⚠️ 請注意：本次更新可能包含 Google Apps Script (GAS) 程式碼變動。您可以直接在此複製最新程式碼，並至您的 Google 試算表重新部署！
                    </div>
                    <div style="position: relative; text-align: left;">
                        <textarea id="swal-gas-code" readonly style="width: 100%; height: 120px; font-family: monospace; font-size: 12px; padding: 10px; border-radius: 5px; border: 1px solid #ccc; background: #f1f5f9; outline: none; resize: none;">${newGasCode}</textarea>
                        <button onclick="navigator.clipboard.writeText(document.getElementById('swal-gas-code').value); this.innerText='已複製！'; setTimeout(()=>this.innerText='複製程式碼', 2000)" style="position: absolute; top: 10px; right: 20px; background: #2563eb; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: all 0.2s;">複製程式碼</button>
                    </div>
                `,
                icon: 'info',
                width: '700px',
                confirmButtonText: '已複製，立即重新載入系統',
                showCancelButton: true,
                cancelButtonText: '稍後再說',
                confirmButtonColor: '#3085d6',
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

window.addEventListener('focus', () => {
    const lastCheck = sessionStorage.getItem('lastUpdateCheck');
    const now = new Date().getTime();
    if (!lastCheck || now - parseInt(lastCheck) > 5 * 60 * 1000) {
        sessionStorage.setItem('lastUpdateCheck', now);
        checkForUpdates();
    }
});

setTimeout(checkForUpdates, 3000);
