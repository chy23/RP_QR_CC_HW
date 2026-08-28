        // ==========================================
        // Tab 1: 掃描與統計 (Session-based)
        // ==========================================
        let currentStatSubject = '國語';

        function initScanner() {
            if(html5QrcodeScanner) return;
            // 提升掃描速度與範圍：
            // 1. 移除 qrbox，讓整個相機畫面都能進行掃描，不需要刻意瞄準中心框框。
            // 2. 請求較高解析度 (720p以上)，讓鏡頭拉高也能清晰辨識，免去一直抬高抬低手機的動作。
            html5QrcodeScanner = new Html5QrcodeScanner("reader", { 
                fps: 15, 
                videoConstraints: {
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    advanced: [{ focusMode: "continuous" }]
                },
                formatsToSupport: (typeof Html5QrcodeSupportedFormats !== 'undefined') ? [Html5QrcodeSupportedFormats.QR_CODE] : undefined,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            }, false);
            html5QrcodeScanner.render((qrText) => {
                processScan(qrText);
            }, (error) => {
                // Ignore errors
            });
            const statusEl = document.getElementById('scan-status');
            if (statusEl) statusEl.innerText = '掃描器啟動中...';
        }

        function stopScanner() {
            if(html5QrcodeScanner) {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
                const statusEl = document.getElementById('scan-status');
                if (statusEl) statusEl.innerText = '掃描器已暫停';
            }
        }
        let scanSession = { active: false, dateStr: '', tasks: [], records: [] };


        function copyGasCode(btn) {
            const code = document.getElementById('gas-code-block').innerText;
            navigator.clipboard.writeText(code).then(() => {
                const originalText = btn.innerText;
                btn.innerText = '✅ 已複製！';
                btn.classList.add('bg-green-500', 'hover:bg-green-600');
                btn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.classList.remove('bg-green-500', 'hover:bg-green-600');
                    btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
                }, 2000);
            });
        }
        
        // --- Google Sheets Sync Logic ---
        let gasUrl = localStorage.getItem(STORAGE_PREFIX + 'rp_qr_gas_url') || '';
        let sheetUrl = localStorage.getItem(STORAGE_PREFIX + 'rp_qr_sheet_url') || '';
        
        // Wait for DOM
        setTimeout(() => {
            const el = document.getElementById('gas-url');
            if(el) el.value = gasUrl;
            const elSheet = document.getElementById('sheet-url');
            if(elSheet) elSheet.value = sheetUrl;
        }, 500);

        
        function saveSheetUrl() {
            let url = document.getElementById('sheet-url').value.trim();
            if (url && url.includes('/edit')) {
                url = url.split('/edit')[0] + '/htmlembed?widget=true&headers=false';
            }
            localStorage.setItem(STORAGE_PREFIX + 'rp_qr_sheet_url', url);
            sheetUrl = url;
            document.getElementById('sheet-status').innerHTML = '<span class="text-green-600">✅ 網址已儲存！</span>';
            setTimeout(() => { document.getElementById('sheet-status').innerHTML = ''; }, 3000);
            renderSheetIframe();
        }
        
        function renderSheetIframe() {
            const container = document.getElementById('sheet-iframe-container');
            if (!container) return;
            if (sheetUrl) {
                container.innerHTML = `<iframe src="${sheetUrl}" class="w-full h-full border-0"></iframe>`;
            } else {
                container.innerHTML = `請先在「0. 資料建置」中設定 Google 試算表共用網址。`;
            }
        }

        function saveGasUrl() {
            const url = document.getElementById('gas-url').value.trim();
            localStorage.setItem(STORAGE_PREFIX + 'rp_qr_gas_url', url);
            gasUrl = url;
            document.getElementById('gas-status').innerHTML = '<span class="text-green-600">✅ 網址已儲存！</span>';
            setTimeout(() => { document.getElementById('gas-status').innerHTML = ''; }, 3000);
        }

        function testGasUrl() {
            const gasInput = document.getElementById('gas-url');
            if (!gasUrl && gasInput && gasInput.value.trim()) {
                saveGasUrl();
            }
            if(!gasUrl) {
                showAlert('提示', '請先填寫並儲存網址！'); return;
            }
            document.getElementById('gas-status').innerHTML = '<span class="text-blue-600">測試連線中...</span>';
            fetch(gasUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'ping' })
            }).then(res => res.json())
              .then(data => {
                  if(data.status === 'success') {
                      document.getElementById('gas-status').innerHTML = '<span class="text-green-600">✅ 連線成功！試算表可正常接收資料。</span>';
                  } else {
                      document.getElementById('gas-status').innerHTML = '<span class="text-red-600">❌ 連線失敗：' + JSON.stringify(data) + '</span>';
                  }
              }).catch(err => {
                  document.getElementById('gas-status').innerHTML = '<span class="text-red-600">❌ 網路錯誤，請確保網址正確且 GAS 權限設為「所有人」。</span>';
              });
        }

        function syncToGoogleSheets(newRecordsArray) {
            const gasInput = document.getElementById('gas-url');
            if (!gasUrl && gasInput && gasInput.value.trim()) saveGasUrl();
            if(!gasUrl) return;
            
            // 1. Prepare delta records
            const deltaPayload = (newRecordsArray || []).map(r => {
                const student = db.students.find(s => s.id === r.studentId);
                const task = db.tasks.find(t => t.id === r.taskId);
                return {
                    timestamp: r.timestamp || r.fullTimestamp,
                    className: db.classInfo ? (db.classInfo.className || '') : '',
                    studentName: student ? student.name : '未知學生',
                    subject: task ? task.subject : '',
                    taskName: task ? task.name : '未知作業',
                    range: r.noticeName || '',
                    status: '已繳交'
                };
            });
            
            // 2. Prepare FULL 2D tables for exactly matching web view
            const fullSyncData = [];
            const allSubjectKeys = {};
            const subjects = getSubjects();
            subjects.forEach(sub => {
                const tasksInSub = db.tasks.filter(t => t.subject === sub);
                let uniqueTaskKeys = []; 
                tasksInSub.forEach(t => {
                    const hasBaseRecords = db.records.some(r => r.taskId === t.id && !r.noticeName);
                    const hasSubRecords = db.records.some(r => r.taskId === t.id && r.noticeName);
                    const hasSubRanges = (db.ranges || []).some(r => r.taskId === t.id && r.noticeName);
                    if (hasBaseRecords || (!hasSubRecords && !hasSubRanges)) {
                        uniqueTaskKeys.push({ taskId: t.id, noticeName: '', label: `${t.name}` });
                    }
                });
                if (db.ranges) {
                    db.ranges.forEach(r => {
                        if (r.noticeName) {
                            const t = tasksInSub.find(t => t.id === r.taskId);
                            if (t) {
                                const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                                if (!exists) {
                                    uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: t.name });
                                }
                            }
                        }
                    });
                }
                db.records.forEach(r => {
                    if(r.noticeName) {
                        const t = tasksInSub.find(t => t.id === r.taskId);
                        if(t) {
                            const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                            if(!exists) {
                                uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: t.name });
                            }
                        }
                    }
                });

                
                // 過濾條件：已經登記過的作業才匯出 (有設定範圍或日期，或者有學生繳交紀錄)
                uniqueTaskKeys = uniqueTaskKeys.filter(k => {
                    const hasRange = (db.ranges || []).some(r => r.taskId === k.taskId && r.noticeName === k.noticeName && (r.range || r.date));
                    const hasRecords = (db.records || []).some(r => r.taskId === k.taskId && r.noticeName === k.noticeName);
                    return hasRange || hasRecords;
                });
                allSubjectKeys[sub] = uniqueTaskKeys;

                if (uniqueTaskKeys.length === 0) return;
                const aoa = [];
                const rowTask = ['作業名稱'];
                const rowDate = ['應繳交日期'];
                const rowRange = ['姓名 \ 範圍'];
                uniqueTaskKeys.forEach(k => {
                    rowTask.push(k.label);
                    rowDate.push(getTaskDate(k.taskId, k.noticeName) || new Date().toISOString().split('T')[0]);
                    rowRange.push(getTaskRange(k.taskId, k.noticeName) || '');
                });
                aoa.push(rowTask);
                aoa.push(rowDate);
                aoa.push(rowRange);
                db.students.forEach(s => {
                    const row = [s.name];
                    uniqueTaskKeys.forEach(k => {
                        const record = db.records.find(r => r.studentId === s.id && r.taskId === k.taskId && r.noticeName === k.noticeName);
                        const loopTaskDef = db.tasks.find(t => t.id === k.taskId);
                        const loopMissingText = (loopTaskDef && loopTaskDef.subject === '聯絡簿') ? '沒帶' : '缺交';
                        let cellValue = loopMissingText;
                        if (record) {
                            cellValue = record.timestamp;
                            if (['事假', '病假', '公假', '喪假', '曠課', '遲到', '其他'].includes(record.manualStatus)) {
                                cellValue = record.manualStatus;
                            } else if (record.manualStatus === 'missing') {
                                cellValue = loopMissingText;
                            }
                            const taskDef = db.tasks.find(t => t.id === k.taskId);
                            const missingText = (taskDef && taskDef.subject === '聯絡簿') ? '沒帶' : '缺交';
                            const deadlineDate = (taskDef && taskDef.deadline) ? new Date(taskDef.deadline + 'T23:59:59') : null;
                            
                            let isLate = false;
                            if (record.manualStatus === 'late') isLate = true;
                            else if (record.manualStatus === 'ontime') isLate = false;
                            else if (deadlineDate) {
                                let scanDate;
                                if (record.timestamp.includes('T') || record.timestamp.includes('-')) scanDate = new Date(record.timestamp);
                                else {
                                    const currentYear = new Date().getFullYear();
                                    scanDate = new Date(`${currentYear}/${record.timestamp}`);
                                }
                                if (scanDate > deadlineDate) isLate = true;
                            }
                            
                            if (isLate) cellValue = `[遲交] ${record.timestamp}`;
                        }
                        row.push(cellValue);
                    });
                    aoa.push(row);
                });
                const sheetName = sub; // 直接使用科目名稱，不再附加上班級後綴
                fullSyncData.push({ name: sheetName, data: aoa });
            });
            
            // ======= 產生統計報表 =======
            const statsAoa = [];
            const statHeaders = ['姓名'];
            const statsFuncs = []; // Array of functions to calculate each column for a student
            const leavesToExempt = ['事假', '病假', '公假', '喪假', '曠課', '其他'];

            subjects.forEach(sub => {
                const keys = allSubjectKeys[sub] || [];
                if (keys.length === 0) return;
                
                // Group keys by taskId for sub-task stats
                const tasksGrouped = {};
                keys.forEach(k => {
                    if(!tasksGrouped[k.taskId]) tasksGrouped[k.taskId] = { label: k.label, keys: [] };
                    tasksGrouped[k.taskId].keys.push(k);
                });

                // Function to generate stats for a set of keys
                const addStatColumns = (prefix, targetKeys, isContactBookDaily = false) => {
                    statHeaders.push(`${prefix}_繳交率`);
                    statHeaders.push(`${prefix}_準時率`);
                    statHeaders.push(`${prefix}_缺交率`);
                    statHeaders.push(`${prefix}_事假率`);
                    statHeaders.push(`${prefix}_病假率`);
                    statHeaders.push(`${prefix}_公假率`);
                    statHeaders.push(`${prefix}_喪假率`);
                    statHeaders.push(`${prefix}_遲到率`);
                    statHeaders.push(`${prefix}_曠課率`);
                    statHeaders.push(`${prefix}_其他率`);

                    statsFuncs.push((studentId) => {
                        const student = db.students.find(s => s.id === studentId);
                        const studentCreatedAt = student ? (student.createdAt || 0) : 0;
                        
                        let totalAssigned = 0;
                        let onTime = 0;
                        let late = 0;
                        let missing = 0;
                        
                        let leaveCounts = {
                            '事假': 0, '病假': 0, '公假': 0, 
                            '喪假': 0, '遲到': 0, '曠課': 0, '其他': 0
                        };
                        let exemptLeaves = 0;

                        targetKeys.forEach(k => {
                            // Find the time this session was recorded
                            const sessionRecords = db.records.filter(r => r.taskId === k.taskId && r.noticeName === k.noticeName);
                            let sessionTime = 0;
                            if (sessionRecords.length > 0) {
                                let minTime = Infinity;
                                for(const r of sessionRecords) {
                                    let t = 0;
                                    if (r.fullTimestamp) {
                                        t = new Date(r.fullTimestamp).getTime();
                                    } else {
                                        let scanDate = (r.timestamp.includes('T') || r.timestamp.includes('-')) ? new Date(r.timestamp) : new Date();
                                        t = scanDate.getTime();
                                    }
                                    if (t && !isNaN(t) && t < minTime) minTime = t;
                                }
                                sessionTime = minTime === Infinity ? 0 : minTime;
                            }
                            
                            // 轉學生防呆：如果這項作業的登記時間「早於」這個學生被加進系統的時間，該生不計入這項作業的應交名單
                            if (sessionTime > 0 && studentCreatedAt > 0 && sessionTime < studentCreatedAt) {
                                return; // Skip this task for this student
                            }
                            
                            totalAssigned++;

                            const r = db.records.find(rec => rec.studentId === studentId && rec.taskId === k.taskId && rec.noticeName === k.noticeName);
                            if (r) {
                                if (isLeaveStatus(r.manualStatus) || r.manualStatus === '其他假別' || leavesToExempt.includes(r.manualStatus)) {
                                    const lName = getLeaveName(r.manualStatus) || r.manualStatus;
                                    if (leaveCounts[lName] === undefined) leaveCounts[lName] = 0;
                                    leaveCounts[lName]++;
                                    
                                    if (lName !== '遲到' && lName !== '曠課') {
                                        exemptLeaves++;
                                    } else if (lName === '遲到') {
                                        onTime++; // 遲到仍算有交
                                    } else if (lName === '曠課') {
                                        missing++;
                                    }
                                } else if (r.manualStatus === 'late') {
                                    late++;
                                } else if (r.manualStatus === 'missing') {
                                    missing++;
                                } else {
                                    const taskDef = db.tasks.find(t => t.id === k.taskId);
                                    const deadlineDate = (taskDef && taskDef.deadline) ? new Date(taskDef.deadline + 'T23:59:59') : null;
                                    let isLate = false;
                                    if (deadlineDate) {
                                        let scanDate = (r.timestamp.includes('T') || r.timestamp.includes('-')) ? new Date(r.timestamp) : new Date(`${new Date().getFullYear()}/${r.timestamp}`);
                                        if (scanDate > deadlineDate) isLate = true;
                                    }
                                    if (isLate) late++;
                                    else onTime++;
                                }
                            } else {
                                missing++;
                            }
                        });

                        const effectiveTotal = Math.max(0, totalAssigned - exemptLeaves);
                        const formatPct = (num, den) => den === 0 ? '-' : (Math.round((num / den) * 1000) / 10) + '%';
                        
                        const submittedRate = formatPct(onTime + late, effectiveTotal);
                        const onTimeRate = formatPct(onTime, effectiveTotal);
                        const missingRate = formatPct(missing, effectiveTotal);
                        
                        const res = [submittedRate, onTimeRate, missingRate];
                        
                        res.push(formatPct(leaveCounts['事假'] || 0, totalAssigned));
                        res.push(formatPct(leaveCounts['病假'] || 0, totalAssigned));
                        res.push(formatPct(leaveCounts['公假'] || 0, totalAssigned));
                        res.push(formatPct(leaveCounts['喪假'] || 0, totalAssigned));
                        res.push(formatPct(leaveCounts['遲到'] || 0, totalAssigned));
                        res.push(formatPct(leaveCounts['曠課'] || 0, totalAssigned));
                        res.push(formatPct(leaveCounts['其他'] || 0, totalAssigned));
                        
                        return res;
                    });
                };

                addStatColumns(`${sub}整體`, keys, false);
                
                for (const tId in tasksGrouped) {
                    const isContactBookDaily = sub === '聯絡簿' && tasksGrouped[tId].label === '聯絡簿';
                    if (Object.keys(tasksGrouped).length > 1 || isContactBookDaily) {
                        addStatColumns(`${sub}_${tasksGrouped[tId].label}`, tasksGrouped[tId].keys, isContactBookDaily);
                    }
                }
            });

            statsAoa.push(statHeaders);
            db.students.forEach(s => {
                let row = [s.name];
                statsFuncs.forEach(func => {
                    row = row.concat(func(s.id));
                });
                statsAoa.push(row);
            });
            
            if (statsAoa.length > 1 && statsAoa[0].length > 1) {
                fullSyncData.push({ name: '統計報表', data: statsAoa });
            }
            // ============================

            fetch(gasUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'full_sync',
                    records: deltaPayload,
                    sheets: fullSyncData
                })
            }).then(res => res.json()).then(data => {
                console.log("GAS Sync Success:", data);
            }).catch(err => {
                console.error("GAS Sync Error:", err);
            });
        }

        
        function updateContactBookRange() {
            const dateVal = document.getElementById('scan-session-date').value;
            if (!dateVal) return;
            const contactTask = db.tasks.find(t => t.name === '聯絡簿' && t.type === 'fixed');
            if (contactTask) {
                const input = document.getElementById(`range-input-${contactTask.id}`);
                const cb = document.querySelector(`.scan-task-checkbox[value="${contactTask.id}"]`);
                if (input && cb && cb.checked) {
                    input.value = dateVal.replace(/-/g, '/');
                }
            }
        }

        function handleTaskCheckboxChange(cb, taskId, taskName, taskType) {
            const input = document.getElementById(`range-input-${taskId}`);
            if (cb.checked) {
                input.style.display = 'block';
                updateContactBookRange();
                

            } else {
                input.style.display = 'none';
                updateContactBookRange();
            }
        }

        function initScanSessionDropdown() {
            const container = document.getElementById('scan-session-tasks');
            if(!container) return;
            container.innerHTML = '';
            db.tasks.forEach(t => {
                const row = document.createElement('div');
                row.className = "flex flex-col md:flex-row md:items-center justify-between hover:bg-blue-50 p-2 rounded w-full border-b last:border-0 transition-colors gap-2";
                row.innerHTML = `
                    <label class="flex items-center space-x-3 cursor-pointer w-full md:w-1/2">
                        <input type="checkbox" value="${t.id}" class="scan-task-checkbox h-5 w-5 cursor-pointer rounded text-blue-600" onchange="handleTaskCheckboxChange(this, '${t.id}', '${t.name}', '${t.type}')"> 
                        <span class="truncate text-base font-semibold text-gray-700 select-none" title="${t.name}">[${t.subject}] ${t.name}</span>
                    </label>
                    <input type="text" id="range-input-${t.id}" class="border p-2 rounded text-sm w-full md:w-1/2 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" style="display: none;" placeholder="範圍/備註 (選填)">
                `;
                container.appendChild(row);
            });
            const dateInput = document.getElementById('scan-session-date');
            if(dateInput && !dateInput.value) {
                const tzoffset = (new Date()).getTimezoneOffset() * 60000; 
                dateInput.value = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
            }
        }

        async function startScanSession() {
            const dateVal = document.getElementById('scan-session-date').value;
            const checkboxes = document.querySelectorAll('.scan-task-checkbox:checked');
            
            if(!dateVal || checkboxes.length === 0) {
                showAlert('提示', '請先選擇日期與【至少一項】作業！');
                return;
            }
            
            const selectedTasks = Array.from(checkboxes).map(cb => {
                const taskDef = db.tasks.find(t => t.id === cb.value);
                const rangeVal = document.getElementById(`range-input-${taskDef.id}`).value.trim();
                return { id: taskDef.id, name: taskDef.name, range: rangeVal, type: taskDef.type };
            });

            // 檢查漏填的固定作業
            const missingTasks = selectedTasks.filter(t => t.type === 'fixed' && t.name !== '聯絡簿' && !t.range);
            
            if (missingTasks.length > 0) {
                const container = document.getElementById('range-prompt-list');
                container.innerHTML = '';
                missingTasks.forEach(t => {
                    container.innerHTML += `
                        <div class="flex flex-col gap-1">
                            <label class="font-bold text-sm text-gray-700">${t.name}</label>
                            <input type="text" id="modal-range-${t.id}" class="border p-2 rounded shadow-sm focus:ring-2 focus:ring-blue-500" placeholder="例如：第一課 (若無可留白)">
                        </div>
                    `;
                });
                document.getElementById('range-prompt-modal').style.display = 'flex';
                window._pendingSelectedTasks = selectedTasks;
                return; // 暫停，等待使用者在 Modal 中確認
            }

            continueStartScanSession(selectedTasks);
        }

        async function confirmRangePrompts() {
            const tasks = window._pendingSelectedTasks;
            if (!tasks) return;
            
            tasks.forEach(t => {
                const input = document.getElementById(`modal-range-${t.id}`);
                if (input) {
                    const val = input.value.trim();
                    t.range = val;
                    const realInput = document.getElementById(`range-input-${t.id}`);
                    if (realInput) realInput.value = val;
                }
            });
            
            document.getElementById('range-prompt-modal').style.display = 'none';
            continueStartScanSession(tasks);
        }

        async function continueStartScanSession(selectedTasks) {
            try {
                if (gasUrl) {
                    showLoading();
                    const loadingTextEl = document.getElementById('loading-text');
                    if (loadingTextEl) {
                        loadingTextEl.innerText = '防呆：正從雲端拉取最新資料...';
                    }
                    // 加入 10 秒 Timeout 防呆，避免 fetch 永遠 hang 住
                    const syncPromise = syncFromGoogleSheets(true);
                    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 10000));
                    await Promise.race([syncPromise, timeoutPromise]);
                }
            } catch (err) {
                console.error("continueStartScanSession Error: ", err);
                showAlert('提示', "拉取資料發生例外錯誤，但仍將繼續啟動掃描。");
            } finally {
                hideLoading();
            }
            
            const dateVal = document.getElementById('scan-session-date').value;
            const existingRecords = (scanSession && scanSession.active) 
                ? scanSession.records.filter(r => selectedTasks.some(t => t.id === r.taskId)) 
                : [];
                
            scanSession = {
                active: true,
                dateStr: dateVal,
                tasks: selectedTasks,
                records: existingRecords
            };
            
            document.getElementById('scan-setup-area').classList.add('hidden');
            document.getElementById('scan-active-area').classList.remove('hidden');
            document.getElementById('scan-active-area').classList.add('flex');
            
            const taskNames = selectedTasks.map(t => `${t.name}${t.range ? '('+t.range+')' : ''}`).join(', ');
            let info = `日期：${dateVal}<br>作業：${taskNames}`;
            document.getElementById('active-session-info').innerHTML = info;
            
            renderSessionBuffer();
            renderStatistics();
            setTimeout(() => document.getElementById('scanner-input').focus(), 100);
        }

        function renderSessionBuffer() {
            document.getElementById('session-buffer-count').innerText = scanSession.records.length;
            const list = document.getElementById('session-buffer-list');
            list.innerHTML = '';
            
            // 排序: 先依照作業種類 (taskId)，再依照學生 ID (座號小到大)
            const sortedRecords = [...scanSession.records].sort((a, b) => {
                if (a.taskId !== b.taskId) {
                    return a.taskId.localeCompare(b.taskId);
                }
                return a.studentId - b.studentId;
            });
            
            let currentTaskContext = null;
            
            sortedRecords.forEach(r => {
                const s = db.students.find(st => st.id === r.studentId);
                const t = db.tasks.find(tsk => tsk.id === r.taskId);
                const sessionTask = scanSession.tasks.find(tsk => tsk.id === r.taskId);
                const rangeText = sessionTask && sessionTask.range ? `(${sessionTask.range})` : '';
                
                const taskLabel = `${t ? t.name : '?'}${rangeText}`;
                
                // 加入群組標題
                if (currentTaskContext !== taskLabel) {
                    list.innerHTML += `<li class="text-sm font-bold text-blue-700 mt-2 border-b border-blue-200">${taskLabel}</li>`;
                    currentTaskContext = taskLabel;
                }
                
                list.innerHTML += `<li class="flex justify-between items-center bg-white p-1 rounded border border-gray-100 shadow-sm ml-2">
                    <span class="font-bold text-gray-700">${s ? s.name : '未知'}</span>
                    <span class="text-xs text-gray-400">${r.timeOnly}</span>
                </li>`;
            });
        }

                function goBackToScanSetup() {
            stopScanner();
            document.getElementById('scan-active-area').classList.add('hidden');
            document.getElementById('scan-active-area').classList.remove('flex');
            document.getElementById('scan-setup-area').classList.remove('hidden');
            if(document.body.classList.contains('immersive-active')) toggleImmersiveMode();
        }

        async function cancelScanSession() {
            if (scanSession.records.length > 0) {
                const result = await showConfirm('確定要取消本次掃描嗎？', '已掃描的紀錄將被清空！', 'warning', '取消掃描', '返回');
                if(!result.isConfirmed) return;
            }
            scanSession = { active: false, dateStr: '', tasks: [], records: [] };
            document.getElementById('session-buffer-list').innerHTML = '';
            document.getElementById('session-buffer-count').innerText = '0';
            
            stopScanner();
            document.getElementById('scan-active-area').classList.add('hidden');
            document.getElementById('scan-active-area').classList.remove('flex');
            document.getElementById('scan-setup-area').classList.remove('hidden');
            if(document.body.classList.contains('immersive-active')) toggleImmersiveMode();
        }

        function endScanSession() {
            const taskNames = scanSession.tasks.map(t => `${t.name}${t.range ? '('+t.range+')' : ''}`).join(', ');
            document.getElementById('session-summary-task').innerText = taskNames;
            document.getElementById('session-summary-date').innerText = scanSession.dateStr;
            
            const resultsContainer = document.getElementById('session-modal-results');
            resultsContainer.innerHTML = '';
            
            scanSession.tasks.forEach(task => {
                // 這次新掃描的學生
                const currentSubmittedIds = scanSession.records.filter(r => r.taskId === task.id).map(r => r.studentId);
                
                // 以前已經繳交過的學生 (避免老師以為沒掃到就會被覆蓋為缺交)
                const taskRange = task.range || '';
                const previouslySubmittedIds = db.records.filter(r => r.taskId === task.id && r.noticeName === taskRange).map(r => r.studentId);
                
                // 總共已繳交的學生
                const allSubmittedIds = [...new Set([...previouslySubmittedIds, ...currentSubmittedIds])];
                
                const missingStudents = db.students.filter(s => !allSubmittedIds.includes(s.id));
                const submittedStudents = db.students.filter(s => allSubmittedIds.includes(s.id));
                
                const taskSection = document.createElement('div');
                taskSection.className = 'border border-gray-200 bg-white p-3 rounded shadow-sm';
                taskSection.innerHTML = `
                    <h4 class="font-bold text-lg mb-2 border-b pb-1 text-indigo-700">📝 ${task.name} ${task.range ? '<span class="text-sm text-gray-500">('+task.range+')</span>' : ''}</h4>
                    <div class="mb-3">
                        <div class="font-bold text-green-700 text-sm mb-1">✅ 已繳交 (${submittedStudents.length})</div>
                        <div class="text-xs flex flex-wrap gap-1">
                            ${submittedStudents.map(s => `<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded border border-green-200">${s.name}</span>`).join('')}
                        </div>
                    </div>
                    <div>
                        <div class="font-bold text-red-600 text-sm mb-1">❌ ${(task.subject === '聯絡簿') ? '沒帶' : '缺交'} (${missingStudents.length})</div>
                        <div class="text-xs flex flex-wrap gap-1">
                            ${missingStudents.map(s => `<span class="bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200">${s.name}</span>`).join('')}
                        </div>
                    </div>
                `;
                resultsContainer.appendChild(taskSection);
            });
            
            document.getElementById('session-modal').style.display = 'flex';
        }

        function closeSessionModal() {
            document.getElementById('session-modal').style.display = 'none';
            setTimeout(() => document.getElementById('scanner-input').focus(), 100);
        }

        function confirmScanSession() {
            try {
            if(!scanSession.active) return;
            
            if (!db.ranges) db.ranges = [];
            scanSession.tasks.forEach(task => {
                if (task.range) {
                    const existingRange = db.ranges.find(r => r.taskId === task.id && r.noticeName === task.range);
                    if (!existingRange) {
                        db.ranges.push({ taskId: task.id, noticeName: task.range, range: task.range, date: scanSession.dateStr });
                    } else {
                        if (!existingRange.range) existingRange.range = task.range;
                        if (!existingRange.date) existingRange.date = scanSession.dateStr;
                    }
                }
            });

            scanSession.records.forEach(r => {
                const taskDef = scanSession.tasks.find(t => t.id === r.taskId);
                // 優先使用 QR code 夾帶的 noticeName，否則才使用介面上輸入的範圍
                const taskRange = (r.noticeName && r.noticeName !== '') ? r.noticeName : (taskDef ? taskDef.range : '');
                
                // 動態註冊這個範圍到 db.ranges，讓系統知道這是一個獨立的欄位
                if (taskRange && taskRange !== '') {
                    const existingRange = db.ranges.find(rg => rg.taskId === r.taskId && rg.noticeName === taskRange);
                    if (!existingRange) {
                        db.ranges.push({ taskId: r.taskId, noticeName: taskRange, range: taskRange, date: scanSession.dateStr });
                    }
                }
                
                const existing = db.records.findIndex(rec => rec.studentId === r.studentId && rec.taskId === r.taskId && rec.noticeName === taskRange);
                if(existing !== -1) {
                    db.records[existing].timestamp = r.fullTimestamp;
                    delete db.records[existing].manualStatus;
                } else {
                    db.records.push({
                        studentId: r.studentId,
                        taskId: r.taskId,
                        noticeName: taskRange,
                        timestamp: r.fullTimestamp
                    });
                }
                
                // 將最終確定的 noticeName 寫回 r，這樣底下的 recordsToSync 也會拿到正確的值
                r.finalNoticeName = taskRange;
            });

            saveData();
            renderStatistics();
            
            // Sync to Google Sheets
            const recordsToSync = scanSession.records.map(r => {
                return {
                    studentId: r.studentId,
                    taskId: r.taskId,
                    noticeName: r.finalNoticeName || '',
                    timestamp: r.fullTimestamp
                };
            });
            syncToGoogleSheets(recordsToSync);
            
            // 儲存剛才掃描的作業清單，供「僅顯示剛才掃描的作業」過濾使用
            db.lastSessionTasks = scanSession.tasks.map(t => ({ taskId: t.id, noticeName: t.range || '' }));
            
            scanSession.active = false;
            document.getElementById('session-modal').style.display = 'none';
            document.getElementById('scan-setup-area').classList.remove('hidden');
            document.getElementById('scan-active-area').classList.add('hidden');
            document.getElementById('scan-active-area').classList.remove('flex');
            
            document.querySelectorAll('input[id^="range-input-"]').forEach(el => el.value = '');
            document.querySelectorAll('.scan-task-checkbox').forEach(el => el.checked = false);
            document.querySelectorAll('input[id^="range-input-"]').forEach(el => el.style.display = 'none');
            } catch (err) {
                showAlert('提示', "confirmScanSession Error: " + err.stack);
                console.error(err);
            }
        }

        function handleManualScan() {
            const input = document.getElementById('manual-scan-input');
            const qrText = input.value.trim();
            if (qrText) {
                processScan(qrText);
                input.value = '';
            }
        }

        function processScan(qrText) {
            const parsed = parseQRText(qrText);
            if (!parsed) return;
            
            const student = db.students.find(s => s.token === parsed.token);
            const task = db.tasks.find(t => t.id === parsed.taskId);

            if (!student || !task) {
                console.warn('Scan failed: student or task not found', qrText);
                playBeep('error');
                showAlert('提示', "❌ 條碼辨識失敗！\n這張條碼對應的學生或作業在目前的系統中找不到。");
                return;
            }

            // 防偽驗證
            if (parsed.salt && student.salt && parsed.salt !== student.salt) {
                console.warn('Scan failed: invalid salt');
                playBeep('error');
                showAlert('提示', '無效的防偽條碼！請確保您印出的條碼是最新的。');
                return;
            }

            if (scanSession.active) {
                // 若這張條碼指定的作業不在批次清單中，則阻擋
                const sessionTask = scanSession.tasks.find(t => t.id === task.id);
                if (!sessionTask) {
                    playBeep('error');
                    showAlert('提示', `錯誤：您現在掃描的是「${task.name}」，但此作業不在您勾選的掃描清單中！`);
                    return;
                }
                
                const existingInSession = scanSession.records.find(r => r.studentId === student.id && r.taskId === task.id);
                if (existingInSession) return; // 已經掃過
                
                const now = new Date();
                const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                
                scanSession.records.unshift({
                    studentId: student.id,
                    taskId: task.id,
                    noticeName: parsed.noticeName || '', // 優先記錄條碼上夾帶的附註範圍
                    timeOnly: timeString,
                    fullTimestamp: `${now.getMonth()+1}/${now.getDate()} ${timeString}`
                });
                
                playBeep('success');
                renderSessionBuffer();
            } else {
                playBeep('error');
                showAlert('提示', '請先選擇日期與作業，點擊「開始掃描」後再進行掃描！');
            }
        }

                
        function setStatSubject(subject) {
            currentStatSubject = subject;
            renderStatistics();
        }
        
        function editSubject(oldSub) {
            const newSub = prompt('請輸入新的分頁(科目)名稱：', oldSub);
            if(newSub && newSub.trim() !== '' && newSub !== oldSub) {
                db.tasks.forEach(t => { if(t.subject === oldSub) t.subject = newSub.trim(); });
                if(currentStatSubject === oldSub) currentStatSubject = newSub.trim();
                saveData();
                renderStatistics();
            }
        }
        
        async function deleteSubject(sub) {
            const result = await showConfirm(`確定要刪除「${sub}」分頁嗎？`, '這會刪除該分頁下的所有作業設定與紀錄！', 'warning', '刪除', '取消');
            if(result.isConfirmed) {
                saveStateForUndo();
                const tasksToDelete = db.tasks.filter(t => t.subject === sub).map(t => t.id);
                db.tasks = db.tasks.filter(t => t.subject !== sub);
                db.records = db.records.filter(r => !tasksToDelete.includes(r.taskId));
                if(db.ranges) db.ranges = db.ranges.filter(r => !tasksToDelete.includes(r.taskId));
                if(currentStatSubject === sub) currentStatSubject = '';
                saveData();
                renderStatistics();
                showUndoToast(`已刪除科目「${sub}」。`);
            }
        }
        
        function addSubject() {
            const newSub = prompt('請輸入新的分頁(科目)名稱：');
            if(newSub && newSub.trim() !== '') {
                const id = 't_dummy_' + Date.now();
                db.tasks.push({ id: id, subject: newSub.trim(), name: '新作業', type: 'fixed' });
                currentStatSubject = newSub.trim();
                saveData();
                renderStatistics();
            }
        }

        function addSubColumn(taskId) {
            const noticeName = prompt('請輸入新欄位的範圍/備註 (例如: 第二課)：');
            if (noticeName && noticeName.trim() !== '') {
                if (!db.ranges) db.ranges = [];
                const existing = db.ranges.find(r => r.taskId === taskId && r.noticeName === noticeName.trim());
                if (!existing) {
                    db.ranges.push({ taskId: taskId, noticeName: noticeName.trim(), range: '' });
                    saveData();
                    renderStatistics();
                } else {
                    showAlert('提示', '這個欄位已經存在了！');
                }
            }
        }


        function updateTaskRange(taskId, noticeName, rangeValue) {
            if (!db.ranges) db.ranges = [];
            const existing = db.ranges.find(r => r.taskId === taskId && r.noticeName === noticeName);
            if (existing) {
                existing.range = rangeValue;
            } else {
                db.ranges.push({ taskId, noticeName, range: rangeValue });
            }
            saveData();
            syncToGoogleSheets([]);
        }

        
        function updateTaskDate(taskId, noticeName, dateValue) {
            if (!db.ranges) db.ranges = [];
            const existing = db.ranges.find(r => r.taskId === taskId && r.noticeName === noticeName);
            if (existing) {
                existing.date = dateValue;
            } else {
                db.ranges.push({ taskId, noticeName, range: '', date: dateValue });
            }
            saveData();
            syncToGoogleSheets([]);
        }

        
        async function removeSubColumn(taskId, noticeName) {
            const result = await showConfirm('確定要刪除這個作業欄位嗎？', '這會刪除其所有繳交紀錄！', 'warning', '刪除', '取消');
            if(!result.isConfirmed) return;
            
            saveStateForUndo();
            
            // Remove related records
            db.records = db.records.filter(r => !(r.taskId === taskId && r.noticeName === noticeName));
            
            // Remove from ranges
            if (db.ranges) {
                db.ranges = db.ranges.filter(r => !(r.taskId === taskId && r.noticeName === noticeName));
            }
            
            // Remove from last session tasks
            if (db.lastSessionTasks) {
                db.lastSessionTasks = db.lastSessionTasks.filter(t => !(t.taskId === taskId && t.noticeName === noticeName));
            }
            
            saveData();
            renderStatistics();
            showUndoToast('已刪除欄位。');
            syncToGoogleSheets([]);
        }
function getTaskDate(taskId, noticeName) {
            if (!db.ranges) return '';
            const existing = db.ranges.find(r => r.taskId === taskId && r.noticeName === noticeName);
            return existing ? (existing.date || '') : '';
        }
function getTaskRange(taskId, noticeName) {
            if (!db.ranges) return noticeName || '';
            const existing = db.ranges.find(r => r.taskId === taskId && r.noticeName === noticeName);
            if (existing && existing.range) return existing.range;
            return noticeName || '';
        }

function getSubjects() {
            const subjects = new Set();
            db.tasks.forEach(t => {
                if (t.subject) subjects.add(t.subject);
            });
            return Array.from(subjects);
        }

function renderStatistics() {
            const thead = document.getElementById('stat-thead');
            const tbody = document.getElementById('stat-tbody');
            if(!thead || !tbody) return;

            // 取得目前有效的 tasks (可能帶有 noticeName)
            const uniqueTaskKeys = []; 
            
            // 先加入所有 db.tasks
            db.tasks.forEach(t => {
                // 只加入 base column (noticeName='') 如果該 task 有不帶 noticeName 的紀錄，或者它是固定作業且沒有任何帶 noticeName 的紀錄
                const hasBaseRecords = db.records.some(r => r.taskId === t.id && !r.noticeName);
                const hasSubRecords = db.records.some(r => r.taskId === t.id && r.noticeName);
                const hasSubRanges = (db.ranges || []).some(r => r.taskId === t.id && r.noticeName);
                if (hasBaseRecords || (!hasSubRecords && !hasSubRanges)) {
                    uniqueTaskKeys.push({ taskId: t.id, noticeName: '', label: `${t.name}` });
                }
            });

            // 補充 ranges 中手動新增的子欄位
            if (db.ranges) {
                db.ranges.forEach(r => {
                    if (r.noticeName) {
                        const t = db.tasks.find(t => t.id === r.taskId);
                        if (t) {
                            const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                            if (!exists) {
                                uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: t.name });
                            }
                        }
                    }
                });
            }

            // 補充 records 中有附帶 noticeName 的
            db.records.forEach(r => {
                if(r.noticeName) {
                    const t = db.tasks.find(t => t.id === r.taskId);
                    if(t) {
                        const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                        if(!exists) {
                            uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: r.noticeName });
                        }
                    }
                }
            });

            // 嚴格過濾：只顯示當次 scanSession 正在掃描的作業
            let finalTaskKeys = uniqueTaskKeys.filter(k => {
                if (!scanSession.active && scanSession.tasks.length === 0) return false;
                return scanSession.tasks.some(st => st.id === k.taskId);
            });
            
            const emptyMsg = document.getElementById('stat-empty-msg');
            const tableContainer = document.getElementById('stat-table-container');
            if (finalTaskKeys.length === 0) {
                if (emptyMsg) emptyMsg.style.display = 'block';
                if (tableContainer) tableContainer.style.display = 'none';
                return;
            } else {
                if (emptyMsg) emptyMsg.style.display = 'none';
                if (tableContainer) tableContainer.style.display = 'block';
            }

            // 生成 Header (包含手動輸入範圍)
            let headHTML = '<tr><th class="p-2 border align-bottom min-w-[80px]">姓名</th>';
            finalTaskKeys.forEach(k => {
                const rangeVal = getTaskRange(k.taskId, k.noticeName);
                headHTML += `<th class="p-2 border text-center max-w-[120px] align-top">
                                <div class="flex items-center justify-center gap-1 mb-1">
                                    <span class="font-bold truncate" title="${k.label}">${k.label}</span>
                                    <button onclick="toggleRecord(null, '${k.taskId}', '${k.noticeName}')" class="text-gray-500 hover:text-blue-600 text-base" title="整欄批次設定">⚙️</button>
                                    <button onclick="addSubColumn('${k.taskId}')" class="text-green-600 hover:text-green-700 text-base font-bold" title="新增同作業的下一個欄位 (如: 第二課)">➕</button>
                                </div>
                                <input type="text" placeholder="輸入範圍..." value="${rangeVal}" 
                                       onchange="updateTaskRange('${k.taskId}', '${k.noticeName}', this.value)" 
                                       class="border text-xs p-1 w-full rounded font-normal bg-gray-50 focus:bg-white text-center">
                             </th>`;
            });
            headHTML += '</tr>';
            thead.innerHTML = headHTML;

            // 生成 Body
            let bodyHTML = '';
            db.students.forEach(s => {
                bodyHTML += `<tr><td class="p-2 border font-semibold whitespace-nowrap">${s.name}</td>`;
                finalTaskKeys.forEach(k => {
                    const taskDef = db.tasks.find(t => t.id === k.taskId);
                    const deadline = taskDef && taskDef.deadline ? new Date(taskDef.deadline + 'T23:59:59') : null;
                    const record = db.records.find(r => r.studentId === s.id && r.taskId === k.taskId && r.noticeName === k.noticeName);
                    const missingText = (taskDef && taskDef.subject === '聯絡簿') ? '沒帶' : '缺交';
                    let mark = `<span class="text-red-700 font-bold text-xs bg-red-50 border border-red-200 px-1 rounded block">${missingText}</span>`;
                    if (record) {
                        // 判斷是否遲交
                        let isLate = false;
                        if (record.manualStatus === 'late') {
                            isLate = true;
                        } else if (record.manualStatus === 'ontime') {
                            isLate = false;
                        } else if (deadline) {
                            // timestamp format: "MM/DD HH:mm" or ISO
                            // To be safe, compare year if possible, but here we just check if it's late based on current year or raw timestamp if ISO
                            let scanDate;
                            if (record.timestamp.includes('T') || record.timestamp.includes('-')) {
                                scanDate = new Date(record.timestamp);
                            } else {
                                // Fallback to current year + MM/DD HH:mm
                                const currentYear = new Date().getFullYear();
                                scanDate = new Date(`${currentYear}/${record.timestamp}`);
                            }
                            if (scanDate > deadline) isLate = true;
                        }
                        
                        if (isLeaveStatus(record.manualStatus)) {
                            const lName = getLeaveName(record.manualStatus);
                            mark = `<span class="text-blue-700 font-bold text-xs bg-blue-100 border border-blue-200 px-1 rounded block truncate" title="${lName}">${lName}</span>`;
                        } else if (isLate) {
                            mark = `<span class="text-yellow-700 font-bold text-xs bg-yellow-100 border border-yellow-200 px-1 rounded block truncate" title="遲交: ${record.timestamp}">遲交:${record.timestamp}</span>`;
                        } else {
                            mark = `<span class="text-green-700 font-bold text-xs bg-green-100 px-1 rounded block truncate" title="準時: ${record.timestamp}">${record.timestamp}</span>`;
                        }
                    }
                    bodyHTML += `<td class="p-2 border text-center align-middle cursor-pointer hover:bg-gray-100" onclick="toggleRecord(${s.id}, '${k.taskId}', '${k.noticeName}')">${mark}</td>`;
                });
                bodyHTML += '</tr>';
            });
            tbody.innerHTML = bodyHTML;
        }

        
function isLeaveStatus(status) {
    if (!status) return false;
    if (status.startsWith('leave_')) return true;
    return ['病假', '事假', '公假', '喪假', '其他假別', '曠課', '遲到', '其他'].includes(status);
}
function getLeaveName(status) {
    if (!status) return '';
    if (status.startsWith('leave_custom_')) return status.replace('leave_custom_', '');
    if (status.startsWith('leave_')) return status.replace('leave_', '');
    return status;
}

// Global handler for leave select
window.handleLeaveSelect = function(selectEl, studentId, taskId, noticeName) {
    if (!selectEl.value) return;
    let val = selectEl.value;
    if (val === '其他假別') {
        const custom = prompt("請輸入自訂假別名稱 (例如: 生理假, 檢定等)：");
        if (custom && custom.trim() !== '') {
            val = 'leave_custom_' + custom.trim();
        } else {
            selectEl.value = '';
            return;
        }
    } else {
        val = 'leave_' + val;
    }
    
    if (studentId === null) {
        setManualStatus(val);
    } else {
        updateStudentTaskStatus(studentId, taskId, noticeName, val);
    }
    selectEl.value = '';
};

let currentTargetRecord = null;
        
        function toggleRecord(studentId, taskId, noticeName) {
            if (studentId === null) {
                currentTargetRecord = { studentId, taskId, noticeName };
                document.getElementById('status-modal-title').innerText = '整欄批次手動設定';
                document.getElementById('status-modal').style.display = 'flex';
                return;
            }
            
            // 單個學生格子的點擊切換邏輯 (順序: 缺交 -> 準時 -> 遲交 -> 缺交)
            const index = db.records.findIndex(r => r.studentId === studentId && r.taskId === taskId && r.noticeName === noticeName);
            const now = new Date();
            const timeString = `${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
            
            if (index === -1) {
                // 缺交 -> 準時
                db.records.push({
                    studentId, taskId, noticeName,
                    timestamp: timeString,
                    manualStatus: 'ontime',
                    fullTimestamp: now.toISOString()
                });
            } else {
                const record = db.records[index];
                const taskDef = db.tasks.find(t => t.id === taskId);
                const deadline = taskDef && taskDef.deadline ? new Date(taskDef.deadline + 'T23:59:59') : null;
                
                let isLate = false;
                if (record.manualStatus === 'late') isLate = true;
                else if (record.manualStatus === 'ontime') isLate = false;
                else if (deadline) {
                    let scanDate;
                    if (record.timestamp.includes('T') || record.timestamp.includes('-')) scanDate = new Date(record.timestamp);
                    else {
                        const currentYear = new Date().getFullYear();
                        scanDate = new Date(`${currentYear}/${record.timestamp}`);
                    }
                    if (scanDate > deadline) isLate = true;
                }

                if (!isLate && record.manualStatus !== 'missing' && (!isLeaveStatus(record.manualStatus))) {
                    // 準時 -> 遲交
                    record.manualStatus = 'late';
                    record.timestamp = timeString;
                    record.fullTimestamp = now.toISOString();
                } else {
                    // 遲交或假別 -> 缺交
                    db.records.splice(index, 1);
                }
            }
            
            saveData();
            renderStatistics();
            // 找出新狀態同步 (即使是刪除也要觸發完整同步，才能將雲端試算表上的格子清空)
            const newRec = db.records.find(r => r.studentId === studentId && r.taskId === taskId && r.noticeName === noticeName);
            syncToGoogleSheets(newRec ? [newRec] : []);
        }

        function openChangelogModal() {
            const m = document.getElementById('changelog-modal');
            if (m) m.classList.remove('hidden');
        }

        function closeChangelogModal() {
            const m = document.getElementById('changelog-modal');
            if (m) m.classList.add('hidden');
        }
        
        function openOnboardingModal() {
            const m = document.getElementById('onboarding-modal');
            if (m) m.classList.remove('hidden');
        }

        function closeOnboardingModal() {
            const m = document.getElementById('onboarding-modal');
            if (m) m.classList.add('hidden');
            localStorage.setItem('hasSeenOnboarding', 'true');
        }

        function closeStatusModal() {
            document.getElementById('status-modal').style.display = 'none';
            currentTargetRecord = null;
        }

        function setManualStatus(statusType) {
            if(!currentTargetRecord) return;
            const { studentId, taskId, noticeName } = currentTargetRecord;
            
            const now = new Date();
            const timeString = `${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

            if (studentId === null) {
                // Batch operation
                db.students.forEach(student => {
                    const index = db.records.findIndex(r => r.studentId === student.id && r.taskId === taskId && r.noticeName === noticeName);
                    if (statusType === 'missing') {
                        if (index !== -1) db.records.splice(index, 1);
                    } else {
                        if (index !== -1) {
                            db.records[index].manualStatus = statusType;
                        } else {
                            db.records.push({ studentId: student.id, taskId, noticeName, timestamp: timeString, manualStatus: statusType });
                        }
                    }
                });
            } else {
                // Individual operation
                const index = db.records.findIndex(r => r.studentId === studentId && r.taskId === taskId && r.noticeName === noticeName);
                if (statusType === 'missing') {
                    if (index !== -1) db.records.splice(index, 1);
                } else {
                    if (index !== -1) {
                        db.records[index].manualStatus = statusType;
                    } else {
                        db.records.push({ studentId, taskId, noticeName, timestamp: timeString, manualStatus: statusType });
                    }
                }
            }
            
            saveData();
            renderStatistics();
            closeStatusModal();
            syncToGoogleSheets([]);
        }

        // ==========================================
        // 批改與退回功能 (Tab 8)
        // ==========================================
        async function loadGradingData() {
            await syncFromGoogleSheets(false);
            renderGradingTab();
            document.getElementById('grading-student-list').innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">已重新載入最新資料，請選擇作業。</td></tr>';
        }

                let activeGradingSubject = null;
        let activeGradingTaskValue = null; // "taskId:::noticeName"
        let gradingTaskGroups = {};

        function renderGradingTab() {
            // 找出所有 uniqueTaskKeys (已登記或有紀錄的作業)
            const subjects = new Set(db.tasks.map(t => t.subject));
            gradingTaskGroups = {};
            
            Array.from(subjects).forEach(sub => {
                let uniqueTaskKeys = [];
                const tasksInSub = db.tasks.filter(t => t.subject === sub);
                tasksInSub.forEach(t => {
                    const hasBaseRecords = db.records.some(r => r.taskId === t.id && !r.noticeName);
                    const hasSubRecords = db.records.some(r => r.taskId === t.id && r.noticeName);
                    const hasSubRanges = (db.ranges || []).some(r => r.taskId === t.id && r.noticeName);
                    if (hasBaseRecords || (!hasSubRecords && !hasSubRanges)) {
                        uniqueTaskKeys.push({ taskId: t.id, noticeName: '', label: `${sub} - ${t.name}` });
                    }
                });
                if (db.ranges) {
                    db.ranges.forEach(r => {
                        if (r.noticeName) {
                            const t = tasksInSub.find(t => t.id === r.taskId);
                            if (t) {
                                const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                                if (!exists) {
                                    uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: `${sub} - ${t.name} (${r.noticeName})` });
                                }
                            }
                        }
                    });
                }
                db.records.forEach(r => {
                    if(r.noticeName) {
                        const t = tasksInSub.find(t => t.id === r.taskId);
                        if(t) {
                            const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                            if(!exists) {
                                uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: `${sub} - ${t.name} (${r.noticeName})` });
                            }
                        }
                    }
                });
                
                // 過濾並排序
                uniqueTaskKeys = uniqueTaskKeys.filter(k => {
                    const hasRange = (db.ranges || []).some(r => r.taskId === k.taskId && r.noticeName === k.noticeName && (r.range || r.date));
                    const hasRecords = (db.records || []).some(r => r.taskId === k.taskId && r.noticeName === k.noticeName);
                    return hasRange || hasRecords;
                });
                
                if (uniqueTaskKeys.length > 0) {
                    gradingTaskGroups[sub] = uniqueTaskKeys;
                }
            });
            
            const validSubjects = Object.keys(gradingTaskGroups);
            if (!validSubjects.includes(activeGradingSubject)) {
                activeGradingSubject = validSubjects.length > 0 ? validSubjects[0] : null;
            }
            
            renderGradingSubjects();
        }

        function renderGradingSubjects() {
            const container = document.getElementById('grading-subject-tabs');
            if (!container) return;
            
            const subjects = Object.keys(gradingTaskGroups);
            if (subjects.length === 0) {
                container.innerHTML = '<span class="text-gray-500 mb-2">目前沒有可批改的作業。</span>';
                document.getElementById('grading-task-buttons').innerHTML = '';
                document.getElementById('grading-student-list').innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">沒有可批改的作業</td></tr>';
                return;
            }

            let html = '';
            subjects.forEach(sub => {
                const isActive = (sub === activeGradingSubject);
                const baseCls = "px-6 py-2 rounded-t-lg font-bold border-t border-l border-r cursor-pointer transition-colors";
                const activeCls = isActive ? "bg-white text-blue-700 border-gray-300 border-b-0 -mb-[1px] shadow-sm relative z-10" : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 border-b";
                html += `<div class="${baseCls} ${activeCls}" onclick="selectGradingSubject('${sub}')">${sub}</div>`;
            });
            container.innerHTML = html;

            renderGradingTasks();
        }

        function selectGradingSubject(sub) {
            activeGradingSubject = sub;
            renderGradingSubjects();
        }

        window.gradingSearchQuery = '';
        function handleGradingSearch() {
            const input = document.getElementById('grading-search-input');
            window.gradingSearchQuery = input ? input.value.trim().toLowerCase() : '';
            renderGradingTasks();
        }

        window.selectGradingTaskBase = function(taskId) {
            activeGradingTaskValue = `${taskId}:::DUMMY_FORCE_RESET`;
            renderGradingTasks();
        }

        function renderGradingTasks() {
            const container = document.getElementById('grading-task-buttons');
            if (!activeGradingSubject || !gradingTaskGroups[activeGradingSubject]) {
                container.innerHTML = '<span class="text-gray-500">請先選擇上方科目</span>';
                renderGradingList();
                return;
            }

            // 反轉順序，讓最新建立的作業排在最上面
            let tasks = [...gradingTaskGroups[activeGradingSubject]].reverse();
            
            // 處理搜尋過濾
            const searchQ = window.gradingSearchQuery || '';
            let tasksMatchingSearch = [];
            if (searchQ) {
                tasksMatchingSearch = tasks.filter(k => {
                    const taskDef = db.tasks.find(t=>t.id===k.taskId);
                    const displayLabel = k.noticeName ? `${taskDef?.name} (${k.noticeName})` : taskDef?.name;
                    const createdDate = taskDef?.created || '';
                    return displayLabel.toLowerCase().includes(searchQ) || createdDate.includes(searchQ);
                });
                if (tasksMatchingSearch.length > 0) {
                    tasks = tasksMatchingSearch;
                }
            }
            
            if (tasks.length === 0) {
                container.innerHTML = '<span class="text-gray-500">沒有符合搜尋的作業</span>';
                activeGradingTaskValue = null;
                renderGradingList();
                return;
            }

            // 群組化 tasks by taskId
            const taskGroups = {};
            const baseTasksOrder = [];
            tasks.forEach(k => {
                if (!taskGroups[k.taskId]) {
                    taskGroups[k.taskId] = [];
                    baseTasksOrder.push(k.taskId);
                }
                taskGroups[k.taskId].push(k);
            });

            let currentTaskId = activeGradingTaskValue ? activeGradingTaskValue.split(':::')[0] : null;
            
            if (currentTaskId && !taskGroups[currentTaskId]) {
                currentTaskId = null;
                activeGradingTaskValue = null;
            }
            
            if (!activeGradingTaskValue && tasks.length > 0) {
                currentTaskId = baseTasksOrder[0];
                const firstTask = taskGroups[currentTaskId][0];
                activeGradingTaskValue = `${firstTask.taskId}:::${firstTask.noticeName}`;
            } else if (currentTaskId && taskGroups[currentTaskId]) {
                // Ensure the specific noticeName is still available
                const stillExists = taskGroups[currentTaskId].some(k => `${k.taskId}:::${k.noticeName}` === activeGradingTaskValue);
                if (!stillExists) {
                    const firstTask = taskGroups[currentTaskId][0];
                    activeGradingTaskValue = `${firstTask.taskId}:::${firstTask.noticeName}`;
                }
            }

            let html = '<div class="flex flex-col sm:flex-row gap-2">';
            
            // 1. Base Task Select
            html += `
                <div class="relative w-full sm:w-48 inline-block flex-shrink-0">
                    <select onchange="selectGradingTaskBase(this.value)" class="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 shadow-sm text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer appearance-none text-base">
            `;
            baseTasksOrder.forEach(tid => {
                const taskDef = db.tasks.find(t=>t.id===tid);
                const isSelected = (tid === currentTaskId) ? 'selected' : '';
                html += `<option value="${tid}" ${isSelected}>${taskDef?.name}</option>`;
            });
            html += `
                    </select>
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            `;
            
            // 2. Range Select (NoticeName)
            const currentGroup = taskGroups[currentTaskId] || [];
            const hasRealRanges = currentGroup.length > 1 || (currentGroup.length === 1 && currentGroup[0].noticeName !== "");
            
            if (hasRealRanges) {
                html += `
                    <div class="relative w-full sm:w-48 inline-block flex-shrink-0">
                        <select onchange="selectGradingTask('${currentTaskId}:::' + this.value)" class="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 shadow-sm text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer appearance-none text-base">
                `;
                currentGroup.forEach(k => {
                    const isSelected = (`${k.taskId}:::${k.noticeName}` === activeGradingTaskValue) ? 'selected' : '';
                    const displayLabel = k.noticeName ? k.noticeName : '全部範圍';
                    html += `<option value="${k.noticeName}" ${isSelected}>${displayLabel}</option>`;
                });
                html += `
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            container.innerHTML = html;
            
            renderGradingList();
        }

        function selectGradingTask(val) {
            activeGradingTaskValue = val;
            renderGradingTasks();
        }

        function renderGradingList() {
            const tbody = document.getElementById('grading-student-list');
            if(!activeGradingTaskValue) {
                tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">請選擇上方作業以進行批改</td></tr>';
                return;
            }
            
            const [taskId, noticeName] = activeGradingTaskValue.split(':::');
            
            const taskDef = db.tasks.find(t => t.id === taskId);
            const deadline = taskDef && taskDef.deadline ? new Date(taskDef.deadline + 'T23:59:59') : null;
            
            let bodyHTML = '';
            
            // 處理學生搜尋過濾
            const searchQ = window.gradingSearchQuery || '';
            let filteredStudents = db.students;
            
            if (searchQ) {
                const studentsMatchingSearch = db.students.filter(s => {
                    const studentIdStr = s.id.toString();
                    const studentName = s.name.toLowerCase();
                    return studentIdStr.includes(searchQ) || studentName.includes(searchQ);
                });
                
                const displayLabel = noticeName ? `${taskDef?.name} (${noticeName})` : taskDef?.name;
                const createdDate = taskDef?.created || '';
                const taskMatchesSearch = (displayLabel && displayLabel.toLowerCase().includes(searchQ)) || createdDate.includes(searchQ);
                
                if (studentsMatchingSearch.length > 0) {
                    // 有匹配的學生，過濾名單
                    filteredStudents = studentsMatchingSearch;
                } else if (taskMatchesSearch) {
                    // 沒有匹配的學生，但匹配目前的作業 (表示使用者是在搜尋這項作業)，所以保留所有學生
                    filteredStudents = db.students;
                } else {
                    // 兩者皆不匹配，找不到資料
                    filteredStudents = [];
                }
            }

            if (filteredStudents.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">找不到符合條件的學生</td></tr>';
                return;
            }

            filteredStudents.forEach(s => {
                const record = db.records.find(r => r.studentId === s.id && r.taskId === taskId && r.noticeName === noticeName);
                
                let missingText = (taskDef?.subject === '聯絡簿') ? '沒帶' : '缺交';
                let statusHTML = `<span class="text-red-700 font-bold bg-red-50 px-2 py-1 rounded border border-red-200 shadow-sm">${missingText}</span>`;
                let currentStatusType = 'missing';
                
                if (record) {
                    let isLate = false;
                    if (record.manualStatus === 'late') isLate = true;
                    else if (record.manualStatus === 'ontime') isLate = false;
                    else if (deadline) {
                        let scanDate;
                        if (record.timestamp.includes('T') || record.timestamp.includes('-')) scanDate = new Date(record.timestamp);
                        else {
                            const currentYear = new Date().getFullYear();
                            scanDate = new Date(`${currentYear}/${record.timestamp}`);
                        }
                        if (scanDate > deadline) isLate = true;
                    }
                    
                    if (isLeaveStatus(record.manualStatus)) {
                            const lName = getLeaveName(record.manualStatus);
                        statusHTML = `<span class="text-blue-700 font-bold bg-blue-100 px-2 py-1 rounded border border-blue-200 shadow-sm">${lName}</span>`;
                        currentStatusType = record.manualStatus;
                    } else if (isLate) {
                        statusHTML = `<span class="text-yellow-700 font-bold bg-yellow-100 px-2 py-1 rounded border border-yellow-200 shadow-sm">遲交 (${record.timestamp})</span>`;
                        currentStatusType = 'late';
                    } else {
                        statusHTML = `<span class="text-green-700 font-bold bg-green-100 px-2 py-1 rounded border border-green-200 shadow-sm">準時 (${record.timestamp})</span>`;
                        currentStatusType = 'ontime';
                    }
                }
                
                bodyHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 border-b font-semibold text-lg">${s.name}</td>
                    <td class="p-3 border-b">${statusHTML}</td>
                    <td class="p-3 border-b flex gap-2 flex-wrap">
                        <button onclick="updateStudentTaskStatus(${s.id}, '${taskId}', '${noticeName}', 'missing')" class="px-4 py-2 rounded font-bold shadow-sm transition-colors ${currentStatusType === 'missing' ? 'bg-gray-200 text-gray-400 cursor-not-allowed border' : 'bg-red-500 hover:bg-red-600 text-white'}" ${currentStatusType === 'missing' ? 'disabled' : ''}>${taskDef?.subject === '聯絡簿' ? '沒帶' : '退回 (缺交)'}</button>
                        <button onclick="updateStudentTaskStatus(${s.id}, '${taskId}', '${noticeName}', 'late')" class="px-4 py-2 rounded font-bold shadow-sm transition-colors ${currentStatusType === 'late' ? 'bg-gray-200 text-gray-400 cursor-not-allowed border' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}" ${currentStatusType === 'late' ? 'disabled' : ''}>改為遲交</button>
                        <button onclick="updateStudentTaskStatus(${s.id}, '${taskId}', '${noticeName}', 'ontime')" class="px-4 py-2 rounded font-bold shadow-sm transition-colors ${currentStatusType === 'ontime' ? 'bg-gray-200 text-gray-400 cursor-not-allowed border' : 'bg-green-500 hover:bg-green-600 text-white'}" ${currentStatusType === 'ontime' ? 'disabled' : ''}>標為準時</button>
                        <div class="relative">
                            <select onchange="handleLeaveSelect(this, ${s.id}, '${taskId}', '${noticeName}')" class="px-4 py-2 rounded font-bold shadow-sm transition-colors text-center cursor-pointer appearance-none outline-none ${isLeaveStatus(currentStatusType) ? 'bg-blue-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}">
                                <option value="" disabled selected>${isLeaveStatus(currentStatusType) ? '變更假別 ▼' : '設定請假 ▼'}</option>
                                <option value="病假" class="text-black bg-white">病假</option>
                                <option value="事假" class="text-black bg-white">事假</option>
                                <option value="公假" class="text-black bg-white">公假</option>
                                <option value="喪假" class="text-black bg-white">喪假</option>
                                <option value="其他假別" class="text-black bg-white">其他假別</option>
                            </select>
                        </div>
                    </td>
                </tr>`;
            });
            
            tbody.innerHTML = bodyHTML;
        }

        function updateStudentTaskStatus(studentId, taskId, noticeName, statusType) {
            const now = new Date();
            const timeString = `${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
            
            const index = db.records.findIndex(r => r.studentId === studentId && r.taskId === taskId && r.noticeName === noticeName);
            
            if (statusType === 'missing') {
                if (index !== -1) db.records.splice(index, 1);
            } else {
                if (index !== -1) {
                    db.records[index].manualStatus = statusType;
                    // 如果原本不是當天掃描的，這裡 timestamp 可以選擇覆寫或保留。
                    // 為了方便老師紀錄，我們將 timestamp 更新為當前時間。
                    db.records[index].timestamp = timeString;
                    db.records[index].fullTimestamp = now.toISOString();
                } else {
                    db.records.push({ studentId, taskId, noticeName, timestamp: timeString, manualStatus: statusType, fullTimestamp: now.toISOString() });
                }
            }
            
            saveData();
            // 更新本頁面清單
            renderGradingList();
            // 同步更新統計表
            renderStatistics();
            
            // 單向即時寫入雲端
            const newRec = db.records.find(r => r.studentId === studentId && r.taskId === taskId && r.noticeName === noticeName);
            syncToGoogleSheets(newRec ? [newRec] : []);
        }

