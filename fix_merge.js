const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/<<<<<<< HEAD\n\s*<title>QRcode自動清點作業系統 \(Ver\. 1\.5\)<\/title>\n=======\n\s*<title>QRcode自動清點作業系統 \(Beta Ver\. 1\.60\)<\/title>\n>>>>>>> beta/g, '    <title>QRcode自動清點作業系統 (Ver. 1.6)</title>');

const headChangelog = `                <!-- Ver 1.6 -->
                <div class="border-l-4 border-blue-600 pl-4 py-1 mb-4">
                    <div class="flex items-center justify-between font-bold text-gray-900 text-base mb-1">
                        <span>正式版 Ver. 1.6</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">2026/08/16</span>
                    </div>
                    <ul class="list-disc list-inside space-y-1 text-gray-600">
                        <li><strong>新功能：</strong> 浮動套印上傳 PDF 底板時，自動抓取檔名填入通知單主題。</li>
                        <li><strong>UI 優化：</strong> 新增手機端「沉浸式掃描模式」，自動隱藏非必要選單，最大化螢幕掃描空間。</li>
                        <li><strong>UI 優化：</strong> 浮動套印上傳 PDF 時立即顯示處理中動畫，消除畫面停頓感。</li>
                        <li><strong>Bug 修復：</strong> 徹底重寫底層座標映射引擎，精準解決非 A4 或非標準裁切 PDF 匯出時，條碼位置異常偏移的問題。</li>
                        <li><strong>Bug 修復：</strong> 修正條碼框放置於左上角時，會被控制面板遮擋而無法拖曳的問題。</li>
                    </ul>
                </div>

                <!-- Ver 1.5 -->
                <div class="border-l-4 border-blue-600 pl-4 py-1 mb-4">
                    <div class="flex items-center justify-between font-bold text-gray-900 text-base mb-1">
                        <span>正式版 Ver. 1.5</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">2026/08/16</span>
                    </div>
                    <ul class="list-disc list-inside space-y-1 text-gray-600">
                        <li><strong>智慧萬用搜尋：</strong> 【批改與退回】及【缺交提醒單】分頁新增「智慧萬用搜尋框」，可同時搜尋學生姓名、座號、作業名稱或日期。</li>
                        <li><strong>階層式作業選單：</strong> 全面升級為「主作業 + 範圍」的雙層下拉選單，解決作業項目過多的問題，並自動將最新作業置頂。</li>
                        <li><strong>UI 視覺升級：</strong> 將「缺交」標籤改為醒目的紅色，「遲交」標籤改為黃色，提升視覺辨識度。移除掃描紀錄時間的「秒數」，讓版面更簡潔。</li>
                        <li><strong>Line 催繳優化：</strong> 移除產生 Line 催繳訊息時的換行符號，讓訊息在手機上更加緊湊連貫。</li>
                        <li><strong>手機版面優化：</strong> 【缺交提醒單】新增「顯示全勤學生與已交齊作業」的隱藏開關，大幅縮減表格寬度。</li>`;

let betaChangelogRegex = /<<<<<<< HEAD\n\s*<!-- Ver 1\.5 -->[\s\S]*?=======[\s\S]*?<!-- Beta Ver 1\.50 -->/g;

html = html.replace(betaChangelogRegex, headChangelog + '\n\n                <!-- Ver 1.4 -->');

let betaVerRegex = /<<<<<<< HEAD\n\s*QRcode自動清點作業系統 <span class="text-lg text-blue-500 font-bold tracking-wide">Ver\. 1\.5<\/span>\n=======\n\s*QRcode自動清點作業系統 <span class="text-lg text-red-500 font-bold tracking-wide">Beta Ver\. 1\.60<\/span>\n>>>>>>> beta/g;

html = html.replace(betaVerRegex, '                    QRcode自動清點作業系統 <span class="text-lg text-blue-500 font-bold tracking-wide">Ver. 1.6</span>');

// Clean up any stray conflict markers
html = html.replace(/<<<<<<< HEAD\n/g, '');
html = html.replace(/=======\n/g, '');
html = html.replace(/>>>>>>> beta\n/g, '');

fs.writeFileSync('index.html', html, 'utf8');
