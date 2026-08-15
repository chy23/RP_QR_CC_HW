
        // ==========================================
        // 系統核心與資料層
        // ==========================================
        let db = { students: [], tasks: [], records: [], ranges: [], subjects: [] };
        const IS_BETA = window.location.pathname.includes('/beta/');
        const STORAGE_PREFIX = IS_BETA ? 'BETA_' : '';
        const STORAGE_KEY = STORAGE_PREFIX + 'doc_productivity_db';

        function generateSalt() { return Math.random().toString(36).substring(2, 8); }

        function getQRText(student, task, noticeName = '') {
            // 為了提升掃描速度，取消 Base64 編碼，直接使用純文字組合。
            // 格式: token|taskId|noticeName|salt
            return `${student.token}|${task.id}|${noticeName}|${student.salt}`;
        }

        function parseQRText(qrText) {
            if (qrText.startsWith('enc_')) {
                // 舊版 Base64 格式支援
                try {
                    const raw = decodeURIComponent(escape(atob(qrText.substring(4))));
                    const parts = raw.split('|');
                    return { token: parts[0], taskId: parts[1], noticeName: parts[2], salt: parts[3] };
                } catch(e) { return null; }
            } else if (qrText.includes('|')) {
                // 新版純文字格式 (速度最快)
                const parts = qrText.split('|');
                return { token: parts[0], taskId: parts[1], noticeName: parts[2], salt: parts[3] };
            } else if (qrText.includes('-')) {
                // 最早期的舊版格式支援
                const parts = qrText.split('-');
                if(parts.length < 2) return null;
                const token = parts[0];
                const rest = parts.slice(1).join('-');
                let taskName = rest; let noticeName = '';
                if(rest.includes('_')) {
                    const splitIndex = rest.indexOf('_');
                    taskName = rest.substring(0, splitIndex);
                    noticeName = rest.substring(splitIndex + 1);
                }
                const task = db.tasks.find(t => t.name === taskName);
                return { token, taskId: task ? task.id : null, noticeName, salt: null };
            }
            return null;
        }

        const DEFAULT_TASKS = [
            // 固定簿冊
            { id: 't_fixed_1', subject: '國語', name: '國習', type: 'fixed' },
            { id: 't_fixed_2', subject: '國語', name: '甲本', type: 'fixed' },
            { id: 't_fixed_3', subject: '國語', name: '乙本', type: 'fixed' },
            { id: 't_fixed_8', subject: '國語', name: '考試本', type: 'fixed' },
            { id: 't_fixed_4', subject: '數學', name: '數習', type: 'fixed' },
            { id: 't_fixed_5', subject: '數學', name: '數練', type: 'fixed' },
            { id: 't_fixed_6', subject: '社會', name: '社作', type: 'fixed' },
            { id: 't_fixed_7', subject: '社會', name: '社習', type: 'fixed' },
            // 浮動卷單
            { id: 't_float_1', subject: '國語', name: '國卷', type: 'floating' },
            { id: 't_float_2', subject: '國語', name: '國學單', type: 'floating' },
            { id: 't_float_3', subject: '國語', name: '作文', type: 'floating' },
            { id: 't_float_4', subject: '數學', name: '數卷', type: 'floating' },
            { id: 't_float_5', subject: '社會', name: '社卷', type: 'floating' },
            { id: 't_float_6', subject: '聯絡簿', name: '通知單', type: 'floating' },
            { id: 't_fixed_9', subject: '聯絡簿', name: '聯絡簿', type: 'fixed' }
        ];

        
        // Camera Scanner Logic
        let html5QrcodeScanner = null;
        let lastScanCode = "";
        let lastScanTime = 0;



        // --- Unified Custom Scanner Logic ---
        let customVideoStream = null;
        let customScanInterval = null;
        let barcodeDetector = null;
        let zxingReader = null;
        const scanCooldowns = new Map(); // Store cooldowns per code
        
        async function startCustomScanner() {
            const container = document.getElementById('camera-container');
            container.classList.remove('hidden');
            
            const videoEl = document.getElementById('native-video');
            const canvasEl = document.getElementById('native-canvas');
            const overlayEl = document.getElementById('overlay-canvas');
            const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
            
            const debugEl = document.getElementById('scanner-debug');
            const logDebug = (msg) => {
                if(debugEl) debugEl.innerHTML = msg + "<br>" + debugEl.innerHTML;
                console.log(msg);
            };
            
            // Initializer hardware detectors
            if (!barcodeDetector && 'BarcodeDetector' in window) {
                try {
                    barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
                    logDebug("✅ Native BarcodeDetector API enabled");
                } catch(e) { logDebug("❌ BarcodeDetector error: " + e.message); }
            } else if (!barcodeDetector) {
                logDebug("⚠️ BarcodeDetector API not supported on this device/browser.");
            }
            
            if (!barcodeDetector && typeof jsQR !== 'undefined') {
                logDebug("⚠️ Using jsQR Grid Fallback (Emulated Multi-Scan)");
            }
            
            try {
                // 嘗試最佳畫質與連續對焦
                try {
                    customVideoStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" }] }
                    });
                } catch (e) {
                    console.warn("High quality camera request failed, falling back to basic...", e);
                    try {
                        customVideoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                    } catch (e2) {
                        console.warn("Environment camera request failed, falling back to ANY camera...", e2);
                        customVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    }
                }
                
                videoEl.srcObject = customVideoStream;
                // iOS 必須加入 autoplay, playsinline，並且使用 play()
                videoEl.setAttribute('autoplay', '');
                videoEl.setAttribute('playsinline', '');
                videoEl.setAttribute('muted', '');
                await videoEl.play();
                
                customScanInterval = setInterval(async () => {
                    if (videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) return;
                    
                    if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) {
                        canvasEl.width = videoEl.videoWidth;
                        canvasEl.height = videoEl.videoHeight;
                        overlayEl.width = videoEl.videoWidth;
                        overlayEl.height = videoEl.videoHeight;
                    }
                    if (canvasEl.width === 0 || canvasEl.height === 0) return;
                    
                    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
                        
                        let foundCodes = [];
                        
                        // 1. Try Native BarcodeDetector (Supports Multiple)
                        if (barcodeDetector) {
                            try {
                                const barcodes = await barcodeDetector.detect(canvasEl);
                                foundCodes = barcodes.map(b => b.rawValue);
                            } catch(e) {
                                // logDebug("detect error: " + e.message);
                            }
                        } 
                        // 2. Fallback to jsQR (Emulated Multi-Scan via Grid Slicing)
                        else if (typeof jsQR !== 'undefined') {
                            const w = canvasEl.width;
                            const h = canvasEl.height;
                            const hw = Math.floor(w / 2);
                            const hh = Math.floor(h / 2);
                            
                            // 定義掃描區域: 1.全圖, 2.左上, 3.右上, 4.左下, 5.右下, 6.中央 (增加中央命中率)
                            const regions = [
                                { x: 0, y: 0, width: w, height: h }, // Full
                                { x: 0, y: 0, width: hw, height: hh }, // TL
                                { x: hw, y: 0, width: hw, height: hh }, // TR
                                { x: 0, y: hh, width: hw, height: hh }, // BL
                                { x: hw, y: hh, width: hw, height: hh }, // BR
                                { x: Math.floor(w/4), y: Math.floor(h/4), width: hw, height: hh } // Center
                            ];
                            
                            for (const r of regions) {
                                try {
                                    const imageData = ctx.getImageData(r.x, r.y, r.width, r.height);
                                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                                        inversionAttempts: "dontInvert"
                                    });
                                    if (code && code.data && !foundCodes.includes(code.data)) {
                                        foundCodes.push(code.data);
                                    }
                                } catch (e) {
                                    // Ignore imageData errors
                                }
                            }
                        }
                        
                        // Process unique codes in this frame
                        const now = Date.now();
                        let newScan = false;
                        
                        for (const code of foundCodes) {
                            if (!code) continue;
                            const lastTime = scanCooldowns.get(code) || 0;
                            if (now - lastTime > 3000) { // 3 seconds cooldown per code
                                scanCooldowns.set(code, now);
                                processScan(code);
                                newScan = true;
                            }
                        }
                        
                        if (newScan) playBeep();
                        
                        // Clear old cooldowns
                        for (const [code, time] of scanCooldowns.entries()) {
                            if (now - time > 5000) scanCooldowns.delete(code);
                        }
                        
                    }, 200); // 5 FPS to balance performance
            } catch (err) {
                alert("無法啟動相機，請允許權限：" + err);
                container.classList.add('hidden');
            }
        }
        
        function stopCustomScanner() {
            const container = document.getElementById('camera-container');
            container.classList.add('hidden');
            if (customScanInterval) {
                clearInterval(customScanInterval);
                customScanInterval = null;
            }
            if (customVideoStream) {
                customVideoStream.getTracks().forEach(t => t.stop());
                customVideoStream = null;
            }
            const videoEl = document.getElementById('native-video');
            if(videoEl) videoEl.srcObject = null;
        }

        function toggleCameraScanner() {
            const container = document.getElementById('camera-container');
            if (container.classList.contains('hidden')) {
                startCustomScanner();
            } else {
                stopCustomScanner();
            }
        }

        function loadData() {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                db = JSON.parse(data);
            }
            
            // 如果 tasks 為空，載入預設的作業清單
            if (db.tasks.length === 0) {
                db.tasks = [...DEFAULT_TASKS];
                saveData();
            }
            
            // Migration: 確保現有使用者也會新增「考試本」
            if (!db.tasks.find(t => t.id === 't_fixed_8')) {
                db.tasks.push({ id: 't_fixed_8', subject: '國語', name: '考試本', type: 'fixed' });
            }
            if (!db.tasks.find(t => t.id === 't_fixed_9')) {
                db.tasks.push({ id: 't_fixed_9', subject: '聯絡簿', name: '聯絡簿', type: 'fixed' });
            }
            sortTasks();
            saveData();

            updateHeaderClassInfo();
            renderStudents();
            renderTasks();
            initAllSelects();
            renderStatistics();
            renderSheetIframe();
            
            // 第一次使用教學彈出邏輯
            if (localStorage.getItem('hasSeenOnboarding') !== 'true') {
                setTimeout(openOnboardingModal, 500);
            }
        }

        function saveData(skipUI = false) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
            backupToIndexedDB(); // 自動備份到 IndexedDB
            if (!skipUI) {
                initAllSelects();
            }
            renderStatistics();
        }

        // ==========================================


// ==========================================
// 復原機制 (Undo System)
// ==========================================
window.actionHistory = [];

function saveStateForUndo() {
    const snapshot = JSON.stringify(db);
    window.actionHistory.push(snapshot);
    if (window.actionHistory.length > 5) {
        window.actionHistory.shift();
    }
}

function undoLastAction() {
    if (window.actionHistory.length > 0) {
        const lastSnapshot = window.actionHistory.pop();
        db = JSON.parse(lastSnapshot);
        saveData();
        if (typeof renderAll === 'function') renderAll();
        if (typeof renderStudentList === 'function') renderStudentList();
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderSubjects === 'function') renderSubjects();
        if (typeof renderStatistics === 'function') renderStatistics();
        if (typeof renderGradingTab === 'function') renderGradingTab();
        if (typeof renderReminderStats === 'function') renderReminderStats();
        hideUndoToast();
        if (typeof playBeep === 'function') playBeep('success');
    }
}

function showUndoToast(message) {
    let toast = document.getElementById('undo-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-3 rounded shadow-lg flex items-center space-x-4 z-50 transition-all duration-300 transform translate-y-0 opacity-100';
        toast.innerHTML = `
            <span id="undo-message"></span>
            <button onclick="undoLastAction()" class="text-blue-300 font-bold hover:text-blue-100 uppercase tracking-wide cursor-pointer ml-4">復原</button>
            <button onclick="hideUndoToast()" class="text-gray-400 hover:text-white cursor-pointer ml-2">&times;</button>
        `;
        document.body.appendChild(toast);
    }
    document.getElementById('undo-message').textContent = message;
    toast.style.display = 'flex';
    
    if (window.undoTimeout) clearTimeout(window.undoTimeout);
    window.undoTimeout = setTimeout(() => {
        hideUndoToast();
    }, 5000); // 5秒後消失
}

function hideUndoToast() {
    const toast = document.getElementById('undo-toast');
    if (toast) toast.style.display = 'none';
}


// ==========================================
// IndexedDB 備份機制 (IndexedDB Backup)
// ==========================================
const IDB_NAME = 'DocProductivityBackups';
const IDB_VERSION = 1;
const STORE_NAME = 'backups';

function openBackupDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db_instance = e.target.result;
            if (!db_instance.objectStoreNames.contains(STORE_NAME)) {
                db_instance.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
            }
        };
    });
}

async function backupToIndexedDB() {
    try {
        const idb = await openBackupDB();
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const backupData = {
            timestamp: Date.now(),
            dateString: new Date().toLocaleString(),
            data: JSON.stringify(db)
        };
        
        store.put(backupData);
        
        // 只保留最近 10 筆備份
        const countReq = store.count();
        countReq.onsuccess = () => {
            if (countReq.result > 10) {
                const cursorReq = store.openCursor();
                let toDelete = countReq.result - 10;
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && toDelete > 0) {
                        cursor.delete();
                        toDelete--;
                        cursor.continue();
                    }
                };
            }
        };
    } catch (err) {
        console.error("IndexedDB Backup failed", err);
    }
}

async function getBackups() {
    try {
        const idb = await openBackupDB();
        return new Promise((resolve) => {
            const tx = idb.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result.sort((a,b) => b.timestamp - a.timestamp));
        });
    } catch(err) {
        return [];
    }
}

async function restoreBackup(timestamp) {
    if(!confirm('警告：還原備份將會覆寫目前的資料！確定要繼續嗎？')) return;
    try {
        const idb = await openBackupDB();
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(timestamp);
        req.onsuccess = () => {
            if (req.result) {
                saveStateForUndo(); // 允許復原此次還原
                db = JSON.parse(req.result.data);
                saveData();
                renderAll();
                alert('備份已成功還原！');
                hideBackupModal();
            }
        };
    } catch (err) {
        alert('還原失敗：' + err.message);
    }
}
