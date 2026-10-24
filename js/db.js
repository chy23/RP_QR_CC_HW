
// ==========================================
        // 全域設定與多班級管理 (Global App Config)
        // ==========================================
        const IS_BETA = window.location.pathname.includes('/beta/');
        const STORAGE_PREFIX = IS_BETA ? 'BETA_' : '';
        
        let appConfig = {
            gasUrl: '',
            sheetUrl: '',
            classes: [], // { id: '...', label: '112上-三年甲班', prefix: '112上-三年甲班' }
            activeClassId: null
        };

        function loadAppConfig() {
            const data = localStorage.getItem(STORAGE_PREFIX + 'app_config');
            if (data) {
                appConfig = JSON.parse(data);
            } else {
                // 向後相容：從舊版遷移
                const oldGasUrl = localStorage.getItem(STORAGE_PREFIX + 'rp_qr_gas_url') || '';
                const oldDbData = localStorage.getItem(STORAGE_PREFIX + 'doc_productivity_db');
                let oldClassInfo = null;
                if (oldDbData) {
                    try {
                        const parsed = JSON.parse(oldDbData);
                        if (parsed.classInfo && (parsed.classInfo.academicYear || parsed.classInfo.className)) {
                            oldClassInfo = parsed.classInfo;
                        }
                    } catch(e) {}
                }
                
                
                appConfig.gasUrl = oldGasUrl;
                
                const oldSheetUrl = localStorage.getItem(STORAGE_PREFIX + 'rp_qr_sheet_url') || '';
                appConfig.sheetUrl = oldSheetUrl;

                
                if (oldClassInfo) {
                    const label = `${oldClassInfo.academicYear || ''}${oldClassInfo.semester || ''}-${oldClassInfo.className || '未命名班級'}`;
                    // 舊版預設班級的 prefix 保持空白，讓後端存取沒有中括號的舊分頁
                    appConfig.classes.push({ id: 'default', label: label, prefix: '' });
                    appConfig.activeClassId = 'default';
                }
                saveAppConfig();
            }
        }

        function saveAppConfig() {
            localStorage.setItem(STORAGE_PREFIX + 'app_config', JSON.stringify(appConfig));
        }

        function getActiveDbKey() {
            if (!appConfig.activeClassId || appConfig.activeClassId === 'default') {
                return STORAGE_PREFIX + 'doc_productivity_db';
            }
            return STORAGE_PREFIX + 'doc_productivity_db_' + appConfig.activeClassId;
        }

        function getActiveClassPrefix() {
            if (!appConfig.activeClassId) return '';
            const cls = appConfig.classes.find(c => c.id === appConfig.activeClassId);
            return cls ? cls.prefix : '';
        }

        function getGasUrl() {
            if (window.appConfig && window.appConfig.gasUrl && window.appConfig.gasUrl.trim()) {
                return window.appConfig.gasUrl.trim();
            }
            const input = document.getElementById('global-gas-url') || document.getElementById('gas-url');
            if (input && input.value && input.value.trim()) {
                const val = input.value.trim();
                if (window.appConfig) {
                    window.appConfig.gasUrl = val;
                    saveAppConfig();
                }
                return val;
            }
            return '';
        }

        function getSheetUrl() {
            if (window.appConfig && window.appConfig.sheetUrl && window.appConfig.sheetUrl.trim()) {
                return window.appConfig.sheetUrl.trim();
            }
            const input = document.getElementById('sheet-url');
            if (input && input.value && input.value.trim()) {
                const val = input.value.trim();
                if (window.appConfig) {
                    window.appConfig.sheetUrl = val;
                    saveAppConfig();
                }
                return val;
            }
            return '';
        }

        window.getGasUrl = getGasUrl;
        window.getSheetUrl = getSheetUrl;

        try {
            Object.defineProperty(window, 'gasUrl', {
                get: function() { return getGasUrl(); },
                set: function(val) {
                    const trimmed = (val || '').trim();
                    if (window.appConfig) {
                        window.appConfig.gasUrl = trimmed;
                        saveAppConfig();
                    }
                    const input = document.getElementById('global-gas-url') || document.getElementById('gas-url');
                    if (input && input.value !== trimmed) {
                        input.value = trimmed;
                    }
                },
                configurable: true,
                enumerable: true
            });

            Object.defineProperty(window, 'sheetUrl', {
                get: function() { return getSheetUrl(); },
                set: function(val) {
                    const trimmed = (val || '').trim();
                    if (window.appConfig) {
                        window.appConfig.sheetUrl = trimmed;
                        saveAppConfig();
                    }
                    const elSheet = document.getElementById('sheet-url');
                    if (elSheet && elSheet.value !== trimmed) {
                        elSheet.value = trimmed;
                    }
                },
                configurable: true,
                enumerable: true
            });
        } catch (e) {
            console.warn('Property definition error on window for gasUrl/sheetUrl:', e);
        }

        // ==========================================
        // 系統核心與資料層
        // ==========================================
        let db = { students: [], tasks: [], records: [], ranges: [], subjects: [] };

        function generateSalt() { return Math.random().toString(36).substring(2, 8); }

        function isSameStudentId(idA, idB) {
            if (idA === idB) return true;
            if (idA === null || idA === undefined || idB === null || idB === undefined) return false;
            if (String(idA).trim() === String(idB).trim()) return true;
            const numA = parseInt(idA, 10);
            const numB = parseInt(idB, 10);
            return !isNaN(numA) && !isNaN(numB) && numA === numB;
        }
        window.isSameStudentId = isSameStudentId;

        function deduplicateStudents(students) {
            if (!Array.isArray(students)) return [];
            const map = new Map();
            students.forEach(s => {
                if (!s) return;
                const idNum = parseInt(s.id, 10);
                // 優先以座號 (數字) 為唯一鍵；若座號無效則依 token 或 姓名
                const key = !isNaN(idNum) ? `id_${idNum}` : (s.token ? `tok_${s.token}` : `name_${s.name}`);
                if (!map.has(key)) {
                    map.set(key, {
                        ...s,
                        id: !isNaN(idNum) ? idNum : s.id,
                        name: (s.name || '').toString().trim(),
                        token: (s.token || '').toString().trim() || generateSalt(),
                        salt: (s.salt || '').toString().trim() || generateSalt()
                    });
                } else {
                    const existing = map.get(key);
                    // 若現有名稱是「座號X」而新項目有真實姓名，則更新為真實姓名
                    if ((!existing.name || existing.name.startsWith('座號')) && s.name && !s.name.startsWith('座號')) {
                        existing.name = s.name.toString().trim();
                    }
                    if (!existing.token && s.token) existing.token = s.token.toString().trim();
                    if (!existing.salt && s.salt) existing.salt = s.salt.toString().trim();
                }
            });
            const result = Array.from(map.values());
            result.sort((a, b) => {
                const idA = parseInt(a.id, 10);
                const idB = parseInt(b.id, 10);
                if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
                return 0;
            });
            return result;
        }
        window.deduplicateStudents = deduplicateStudents;

        loadAppConfig();

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
            { id: 't_float_7', subject: '聯絡簿', name: '學習單', type: 'floating' },
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
                showAlert('提示', "無法啟動相機，請允許權限：" + err);
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
            const data = localStorage.getItem(getActiveDbKey());
            if (data) {
                db = JSON.parse(data);
            }
            if (!db.students) db.students = [];
            // 自動去重與座號資料校正
            db.students = deduplicateStudents(db.students);
            
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
            if (!db.tasks.find(t => t.id === 't_float_7')) {
                db.tasks.push({ id: 't_float_7', subject: '聯絡簿', name: '學習單', type: 'floating' });
            }

            // 自動修復曾遭舊版 1970-01-01T00:00:00 覆寫之聯絡簿請假紀錄
            if (Array.isArray(db.records)) {
                db.records.forEach(r => {
                    if (!r) return;
                    const ts = (r.timestamp || '').toString().trim();
                    if (/^1970[-\/]/.test(ts)) {
                        const leaveLabel = (r.manualStatus && !['ontime', 'late', 'missing'].includes(r.manualStatus))
                            ? r.manualStatus.replace(/^leave_custom_|^leave_/, '')
                            : '請假';
                        r.manualStatus = leaveLabel;
                        r.timestamp = leaveLabel;
                    }
                });
            }

            sortTasks();
            saveData();

            // 非同步從 IndexedDB 歷史備份建立假別對照表並修復任何被覆寫為 1970 的紀錄
            if (typeof recoverLeaveTypesFromBackups === 'function') {
                recoverLeaveTypesFromBackups();
            }

            renderClassManager();
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
            if (db.students) {
                db.students = deduplicateStudents(db.students);
            }
            localStorage.setItem(getActiveDbKey(), JSON.stringify(db));
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

async function recoverLeaveTypesFromBackups() {
    try {
        if (!(window._recoveredLeaveMap instanceof Map)) {
            window._recoveredLeaveMap = new Map();
        }
        const leavesList = ["事假", "病假", "公假", "喪假", "曠課", "遲到", "其他", "其他假別", "請假", "免交", "請假補交"];
        const backups = await getBackups();
        // 由舊到新或由新到舊掃描，優先保留具體假別（如病假、事假）而非統稱「請假」
        backups.forEach(b => {
            try {
                const parsed = JSON.parse(b.data);
                const bTasks = parsed.tasks || [];
                (parsed.records || []).forEach(r => {
                    if (!r || !r.manualStatus) return;
                    const rawStatus = r.manualStatus.toString();
                    const isLv = rawStatus.startsWith('leave_') || leavesList.includes(rawStatus);
                    if (isLv) {
                        const cleanLv = rawStatus.replace(/^leave_custom_|^leave_/, '');
                        const keyId = `id_${r.studentId}_${r.taskId}_${r.noticeName || ''}`;
                        const existing = window._recoveredLeaveMap.get(keyId);
                        if (!existing || (existing === '請假' && cleanLv !== '請假')) {
                            window._recoveredLeaveMap.set(keyId, cleanLv);
                        }
                        const tObj = bTasks.find(t => t.id === r.taskId);
                        if (tObj) {
                            const keySub = `sub_${r.studentId}_${tObj.subject}_${tObj.name}_${r.noticeName || ''}`;
                            const exSub = window._recoveredLeaveMap.get(keySub);
                            if (!exSub || (exSub === '請假' && cleanLv !== '請假')) {
                                window._recoveredLeaveMap.set(keySub, cleanLv);
                            }
                        }
                    }
                });
            } catch (e) {}
        });

        // 若目前 db.records 中有剛從 1970 還原為「請假」的紀錄，且歷史備份中有具體假別（如病假/事假），自動升級還原
        let updated = false;
        if (Array.isArray(db.records)) {
            db.records.forEach(r => {
                if (!r) return;
                const ts = (r.timestamp || '').toString().trim();
                if (/^1970[-\/]/.test(ts) || r.manualStatus === '請假') {
                    const tObj = (db.tasks || []).find(t => t.id === r.taskId);
                    const exactLeave = window._recoveredLeaveMap.get(`id_${r.studentId}_${r.taskId}_${r.noticeName || ''}`)
                        || (tObj ? window._recoveredLeaveMap.get(`sub_${r.studentId}_${tObj.subject}_${tObj.name}_${r.noticeName || ''}`) : null);
                    if (exactLeave && exactLeave !== r.manualStatus) {
                        r.manualStatus = exactLeave;
                        r.timestamp = exactLeave;
                        updated = true;
                    }
                }
            });
        }
        if (updated) {
            saveData(true);
            if (typeof renderStatistics === 'function') renderStatistics();
        }
    } catch (err) {
        console.warn('recoverLeaveTypesFromBackups error:', err);
    }
}

async function restoreBackup(timestamp) {
    const result = await showConfirm('警告：還原備份將會覆寫目前的資料！', '確定要繼續嗎？', 'warning', '還原', '取消');
    if(!result.isConfirmed) return;
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
                showToast('備份已成功還原！', 'success');
                hideBackupModal();
            }
        };
    } catch (err) {
        showAlert('提示', '還原失敗：' + err.message);
    }
}
