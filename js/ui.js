        // UI 工具
        // ==========================================
// 多班級管理 UI 邏輯
// ==========================================
function renderClassManager() {
    // 渲染設定頁面的 GAS URL
    const gasInput = document.getElementById('global-gas-url');
    if (gasInput) gasInput.value = appConfig.gasUrl || '';

    // 渲染設定頁面的班級清單 (下拉選單版本)
    const container = document.getElementById('class-list-container');
    if (container) {
        if (appConfig.classes.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 text-sm py-4">目前還沒有設定任何班級。請在下方新增。</div>';
        } else {
            let optionsHtml = '';
            appConfig.classes.forEach(c => {
                const selected = c.id === appConfig.activeClassId ? 'selected' : '';
                optionsHtml += `<option value="${c.id}" ${selected}>${c.label}</option>`;
            });
            
            const activeIndex = appConfig.classes.findIndex(c => c.id === appConfig.activeClassId);
            const canUp = activeIndex > 0;
            const canDown = activeIndex < appConfig.classes.length - 1;
            
            container.innerHTML = `
                <div class="flex flex-col gap-3 pb-2">
                    <div class="flex items-center gap-2">
                        <select id="class-dropdown" class="border-2 border-blue-400 p-2.5 rounded-lg flex-grow font-bold text-gray-800 bg-blue-50 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onchange="switchGlobalClass(this.value)">
                            ${optionsHtml}
                        </select>
                        <div class="flex flex-col bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
                            <button onclick="moveSelectedClassUp()" class="px-3 py-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 font-bold border-b transition-colors" title="往上移" ${canUp ? '' : 'disabled style="opacity:0.3"'}>▲</button>
                            <button onclick="moveSelectedClassDown()" class="px-3 py-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 font-bold transition-colors" title="往下移" ${canDown ? '' : 'disabled style="opacity:0.3"'}>▼</button>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 justify-between shadow-inner">
                        <div class="flex gap-2">
                            <button onclick="hideSelectedClassTabs()" class="text-sm bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded shadow flex items-center gap-1 transition-colors" title="在雲端試算表中隱藏這個班級的所有分頁">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                                隱藏分頁
                            </button>
                            <button onclick="showSelectedClassTabs()" class="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded shadow flex items-center gap-1 transition-colors" title="在雲端試算表中顯示這個班級的所有分頁">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                顯示分頁
                            </button>
                        </div>
                        <button onclick="deleteSelectedClass()" class="text-sm bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded border border-red-100 transition-colors font-bold shadow-sm">刪除此班</button>
                    </div>
                </div>
            `;
        }
    }

    // 渲染上方的下拉選單
    const globalSelect = document.getElementById('global-class-select');
    if (globalSelect) {
        globalSelect.innerHTML = '';
        if (appConfig.classes.length === 0) {
            globalSelect.innerHTML = '<option value="">(尚未設定)</option>';
        } else {
            appConfig.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.label;
                if (c.id === appConfig.activeClassId) {
                    opt.selected = true;
                }
                globalSelect.appendChild(opt);
            });
        }
    }
}

function switchGlobalClass(classId) {
    if (!classId) return;
    if (classId === appConfig.activeClassId) return;
    
    appConfig.activeClassId = classId;
    saveAppConfig();
    
    // 切換班級時，直接重新載入網頁是最乾淨安全的做法，能確保所有的變數與資料庫實體都被重新初始化
    showToast('正在切換班級...', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

async function saveGlobalGasUrl(testConnection = false) {
    const input = document.getElementById('global-gas-url');
    if (!input) return;
    const url = input.value.trim();
    appConfig.gasUrl = url;
    saveAppConfig();
    
    if (testConnection) {
        if (!url) {
            showAlert('錯誤', '請先輸入網址！', 'error');
            return;
        }
        
        Swal.fire({
            title: '連線診斷中...',
            html: '<div id="diag-steps" class="text-left text-sm space-y-2 font-mono bg-gray-50 p-4 rounded h-48 overflow-y-auto border"></div>',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: async () => {
                const addStep = (msg, status = 'loading') => {
                    const el = document.getElementById('diag-steps');
                    if(el) {
                        const icon = status === 'loading' ? '⏳' : status === 'ok' ? '✅' : '❌';
                        const color = status === 'error' ? 'text-red-600 font-bold' : 'text-gray-700';
                        el.innerHTML += `<div class="${color}">${icon} ${msg}</div>`;
                        el.scrollTop = el.scrollHeight;
                    }
                };
                
                try {
                    addStep('正在解析 URL 格式...');
                    if (!url.includes('script.google.com/macros/s/')) {
                        throw new Error('URL 格式不正確 (ERR-01)');
                    }
                    if (!url.endsWith('/exec')) {
                        throw new Error('URL 必須以 /exec 結尾 (ERR-02)');
                    }
                    addStep('URL 格式檢查通過', 'ok');
                    
                    addStep('正在發送連線請求 (Ping)...');
                    const timestamp = new Date().getTime();
                    let response;
                    try {
                        response = await fetch(url + '?t=' + timestamp, {
                            method: 'POST',
                            body: JSON.stringify({ action: 'ping', classPrefix: getActiveClassPrefix() }),
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                        });
                    } catch(netErr) {
                        throw new Error('網路請求被拒絕，請確認您部署時「誰可以存取」是否有選擇「所有人」 (ERR-03)');
                    }
                    addStep('伺服器已成功回應', 'ok');
                    
                    addStep('正在解析伺服器回應...');
                    let data;
                    try {
                        const text = await response.text();
                        try {
                            data = JSON.parse(text);
                        } catch(jsonErr) {
                            console.error("Raw response:", text);
                            if (text.includes("<html") || text.includes("<body")) {
                                throw new Error('伺服器回傳了網頁而非資料，權限設定錯誤 (ERR-04)');
                            } else {
                                throw new Error('伺服器回傳了無法辨識的格式 (ERR-05)');
                            }
                        }
                    } catch(parseErr) {
                        throw parseErr;
                    }
                    addStep('資料解析成功', 'ok');
                    
                    if (data.status === 'success') {
                        addStep('連線測試成功！', 'ok');
                        if (data.sheetUrl) {
                            addStep('已自動取得綁定之試算表...', 'ok');
                            appConfig.sheetUrl = data.sheetUrl;
                            saveAppConfig();
                            if (typeof loadSheetIframe === 'function') loadSheetIframe();
                        }
                        
                        setTimeout(() => {
                            Swal.fire({
                                title: '連線成功',
                                icon: 'success',
                                text: '系統已成功與您的雲端引擎建立連線，並自動綁定試算表！'
                            });
                        }, 500);
                    } else {
                        throw new Error(`雲端引擎回報異常狀態: ${data.message || '未知錯誤'} (ERR-06)`);
                    }
                } catch (err) {
                    addStep(err.message, 'error');
                    setTimeout(() => {
                        Swal.fire({
                            title: '連線失敗',
                            icon: 'error',
                            html: `<div class="text-left text-sm text-red-600 font-bold mb-4">${err.message}</div>
                                   <div class="text-xs text-gray-700 text-left bg-gray-100 border border-gray-300 p-3 rounded">
                                   <strong class="text-blue-700">💡 常見除錯指南：</strong><br><br>
                                   1. 請確認網址有完整複製，中間不可有空格。<br>
                                   2. 部署 Apps Script 時，請務必選擇<strong>「新增部署作業」</strong>而非測試部署。<br>
                                   3. <strong>「誰可以存取」</strong>請務必選擇<strong>「所有人」</strong>，否則會出現 CORS (ERR-03/04) 阻擋。<br>
                                   4. 修改程式碼後，請再次點擊「新增部署作業」並選擇<strong>「建立新版本」</strong>，舊版本不會自動更新。
                                   </div>`
                        });
                    }, 800);
                }
            }
        });
    } else {
        showToast('網址已儲存', 'success');
    }
}

function addNewClass() {
    const year = document.getElementById('new-class-year').value.trim();
    const semester = document.getElementById('new-class-semester').value;
    const name = document.getElementById('new-class-name').value.trim();
    
    if (!name) {
        showAlert('錯誤', '班級名稱為必填項目！', 'error');
        return;
    }
    
    const label = `${year}${semester}-${name}`;
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    appConfig.classes.push({
        id: id,
        label: label,
        prefix: label
    });
    
    if (!appConfig.activeClassId) {
        appConfig.activeClassId = id;
    }
    
    saveAppConfig();
    
    document.getElementById('new-class-year').value = '';
    document.getElementById('new-class-name').value = '';
    
    renderClassManager();
    
    // 如果是第一個新增的班級，自動切換過去
    if (appConfig.classes.length === 1) {
        switchGlobalClass(id);
    } else {
        // 背景同步全域設定到雲端 (可選，這裡我們可以呼叫 sync_students 順便把 config 寫上去)
        syncStudentsToGas();
    }
}


function moveClassUp(index) {
    if (index <= 0) return;
    const temp = appConfig.classes[index - 1];
    appConfig.classes[index - 1] = appConfig.classes[index];
    appConfig.classes[index] = temp;
    saveAppConfig();
    renderClassManager();
    updateActiveClassName();
}

function moveClassDown(index) {
    if (index >= appConfig.classes.length - 1) return;
    const temp = appConfig.classes[index + 1];
    appConfig.classes[index + 1] = appConfig.classes[index];
    appConfig.classes[index] = temp;
    saveAppConfig();
    renderClassManager();
    updateActiveClassName();
}

function deleteClass(id) {
    if (id === appConfig.activeClassId) {
        showAlert('錯誤', '無法刪除目前正在瀏覽的班級！請先從上方選單切換到其他班級後再刪除。', 'error');
        return;
    }
    showConfirm('確定要刪除嗎？', '刪除後，您將無法在本地查看該班級資料（但雲端資料仍保留）。', 'warning', '刪除', '取消').then(res => {
        if (res.isConfirmed) {
            appConfig.classes = appConfig.classes.filter(c => c.id !== id);
            saveAppConfig();
            renderClassManager();
            syncStudentsToGas(); // 更新雲端 Config
        }
    });
}

// ==========================================
        function switchTab(tabIndex) {
            try {

            document.querySelectorAll('.tab-content').forEach(el => {
                el.classList.toggle('active', el.id === 'tab-' + tabIndex);
            });
            document.querySelectorAll('.tab-btn').forEach(el => {
                const onClickAttr = el.getAttribute('onclick');
                el.classList.toggle('active', onClickAttr && onClickAttr.includes(`switchTab(${tabIndex})`));
            });
            if(tabIndex === 1) {
                initScanner();
                document.body.classList.add('scanning-mode');
            } else {
                stopScanner();
                document.body.classList.remove('scanning-mode');
            }
            
            if(tabIndex === 5) {
                renderGradingTab();
                document.body.classList.add('scanning-mode');
            }
            if(tabIndex === 6) {
                if(typeof renderReminderStats === 'function') renderReminderStats();
            }
            if(tabIndex === 7) {
                if(typeof renderReportTab === 'function') renderReportTab();
            }
            } catch (err) {
                showAlert('提示', "switchTab Error: " + err.message + "\n" + err.stack);
            }
        }

        function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
        function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

        // ==========================================
        // Tab 0: 資料建置
        // ==========================================
        
        async function addStudent() {
            const idInput = document.getElementById('new-student-id');
            const nameInput = document.getElementById('new-student-name');
            const name = nameInput.value.trim();
            if (!name) return;
            
            let newId;
            if (idInput && idInput.value.trim() !== '') {
                newId = parseInt(idInput.value, 10);
                if (isNaN(newId) || newId <= 0) {
                    showAlert('提示', '請輸入有效的座號！');
                    return;
                }
                const existingIdx = db.students.findIndex(s => s.id === newId);
                if (existingIdx !== -1) {
                    const result = await showConfirm(`座號 ${newId} 已經存在（${db.students[existingIdx].name}）`, "是否要覆蓋該學生資料？", "warning", "覆蓋", "取消");
                    if (!result.isConfirmed) return;
                    db.students.splice(existingIdx, 1);
                }
            } else {
                newId = db.students.length > 0 ? Math.max(...db.students.map(s => s.id)) + 1 : 1;
            }

            const token = `STU${String(newId).padStart(3, '0')}`;
            db.students.push({ id: newId, name, token, salt: generateSalt(), createdAt: Date.now() });
            db.students.sort((a, b) => a.id - b.id);
            
            nameInput.value = '';
            if(idInput) idInput.value = '';
            
            saveData();
            renderStudents();
            
            setTimeout(() => {
                showToast("新增成功！\n\n若您有設定 Google 雲端同步，請記得點選右方「備份至雲端」按鈕，以確保最新名單同步至試算表中。", 'success');
            }, 100);
        }

        function batchAddStudents() {
            const startId = db.students.length > 0 ? Math.max(...db.students.map(s => s.id)) + 1 : 1;
            for(let i=0; i<25; i++) {
                const newId = startId + i;
                const token = `STU${String(newId).padStart(3, '0')}`;
                db.students.push({ id: newId, name: `座號${i+1}`, token, salt: generateSalt(), createdAt: Date.now() });
            }
            saveData();
            renderStudents();
        }



        async function pushStudentsToGas() {
            if(!gasUrl) {
                showAlert('提示', '請先到「0. 資料建置」分頁設定並儲存您的 Google Apps Script 網址！');
                return;
            }
            if (!appConfig.activeClassId) {
                showAlert('提示', '請先新增並選擇一個班級！');
                return;
            }
            
            const result = await showConfirm("確定要備份到雲端嗎？", "這將覆蓋雲端的舊設定，以便其他裝置匯入。");
            if(!result.isConfirmed) return;

            showLoading();
            
            try {
                const configPayload = appConfig;
            fetch(gasUrl, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ classPrefix: getActiveClassPrefix(), action: 'sync_students', students: db.students.map(s => {
                    if (!s.salt) s.salt = generateSalt();
                    return s;
                }), config: configPayload })
                }).then(res => res.json())
                  .then(data => {
                      hideLoading();
                      if(data.status === 'success') {
                          showToast("成功將全系統設定檔與學生名單備份至 Google 試算表！\n現在您可以在手機上點擊「從雲端匯入」瞬間完成所有設定。", 'success');
                      } else {
                          showAlert('提示', "備份失敗：" + (data.message || JSON.stringify(data)));
                      }
                  })
                  .catch(err => {
                      hideLoading();
                      console.error(err);
                      showAlert('提示', "網路連線錯誤，請確認您的 GAS 網址正確且已發布最新版本！\n" + err);
                  });
            } catch (err) {
                hideLoading();
                console.error("Synchronous error during fetch setup:", err);
                showAlert('提示', "發生未預期的系統錯誤 (例如資料格式異常)：\n" + err.message);
            }
        }

        async function fetchStudentsFromGas() {
            const gasInput = document.getElementById('gas-url');
            if (!gasUrl && gasInput && gasInput.value.trim()) {
                saveGasUrl();
            }
            if(!gasUrl) {
                showAlert('提示', '請先到「0. 資料建置」分頁設定並儲存您的 Google Apps Script 網址！');
                return;
            }
            
            

            const result = await showConfirm("確定要從雲端還原嗎？", "這將會覆蓋您裝置上目前的班級資訊、作業設定與學生名單。");
            if(!result.isConfirmed) return;

            showLoading();
            fetch(gasUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ classPrefix: getActiveClassPrefix(), action: 'get_students' })
            }).then(res => res.json())
              .then(data => {
                  hideLoading();
                  if(data.status === 'success') {
                      let msg = '';
                      // 處理 config 復原
                      if (data.config) {
                          if (data.config.classes) {
                              // 新版多班級架構的設定 (智慧合併，避免覆寫本地剛建立的新班級)
                              if (!appConfig.classes) appConfig.classes = [];
                              data.config.classes.forEach(cloudClass => {
                                  const localClass = appConfig.classes.find(c => c.id === cloudClass.id);
                                  if (!localClass) {
                                      appConfig.classes.push(cloudClass);
                                  }
                              });
                              // 保留本地其他的 appConfig 設定
                              if (data.config.gasUrl && !appConfig.gasUrl) appConfig.gasUrl = data.config.gasUrl;
                              if (data.config.sheetUrl && !appConfig.sheetUrl) appConfig.sheetUrl = data.config.sheetUrl;
                              
                              saveAppConfig();
                              renderClassManager();
                              
                              if (!appConfig.classes.find(c => c.id === appConfig.activeClassId)) {
                                  appConfig.activeClassId = appConfig.classes[0] ? appConfig.classes[0].id : null;
                                  saveAppConfig();
                                  window.location.reload();
                                  return;
                              }
                          } else if (data.config.classInfo) {
                              // 舊版單一班級相容
                              db.classInfo = data.config.classInfo;
                          }
                          if (data.config.tasks) {
                              db.tasks = data.config.tasks;
                              renderTasks();
                              renderStatistics();
                          }
                          if (data.config.sheetUrl) {
                              sheetUrl = data.config.sheetUrl;
                              localStorage.setItem(STORAGE_PREFIX + 'rp_qr_sheet_url', sheetUrl);
                              const elSheet = document.getElementById('sheet-url');
                              if(elSheet) elSheet.value = sheetUrl;
                              renderSheetIframe();
                          }
                          msg += '✅ 系統設定檔還原成功！\n';
                          saveData();
                      }

                      if (data.students && data.students.length > 0) {
                          let addedCount = 0;
                          data.students.forEach(s => {
                              const idNum = parseInt(s.id, 10);
                              if (isNaN(idNum)) return;
                              const existingIdx = db.students.findIndex(ex => ex.id === idNum);
                              if (existingIdx >= 0) {
                                  db.students[existingIdx].name = s.name;
                                  db.students[existingIdx].token = (s.token && s.token.trim() !== '') ? s.token : (db.students[existingIdx].token || generateSalt());
                              } else {
                                  db.students.push({
                                      id: idNum,
                                      name: s.name,
                                      token: (s.token && s.token.trim() !== '') ? s.token : generateSalt()
                                  });
                              }
                              addedCount++;
                          });
                          db.students.sort((a, b) => a.id - b.id);
                          saveData();
                          renderStudents();
                          msg += `✅ 成功匯入/更新 ${addedCount} 位學生！`;
                      } else {
                          msg += '⚠️ 連線成功，但雲端「學生名單」沒有有效資料。';
                      }
                      showAlert('提示', msg);
                  } else {
                      showAlert('提示', "匯入失敗：" + (data.message || JSON.stringify(data)));
                  }
              })
              .catch(err => {
                  hideLoading();
                  console.error(err);
                  showAlert('提示', "網路連線錯誤，請確認您的 GAS 網址正確且已發布最新版本 (包含 get_students 邏輯)！");
              });
        }


        async function syncFromGoogleSheets(silent = false) {
            if(!gasUrl) {
                if(!silent) showAlert('提示', '請先至「0. 資料建置」填寫您的 Google Apps Script 網址，才能進行雲端同步！');
                return;
            }
            
            if(!silent) {
                showLoading();
                document.getElementById('loading-text').innerText = '正在從雲端拉取最新資料...';
            }
            
            try {
                const response = await fetch(gasUrl, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ classPrefix: getActiveClassPrefix(), action: 'pull_sync' })
                });
                const data = await response.json();
                
                if(data.status === 'success' && data.sheetsData) {
                    parseCloudDataToRecords(data.sheetsData, silent);
                    if(!silent) showToast('雲端資料拉取成功！', 'success');
                } else {
                    if(!silent) showAlert('提示', '拉取失敗：' + (data.message || '未知錯誤'));
                }
            } catch (err) {
                console.error(err);
                if(!silent) showAlert('提示', '網路連線錯誤，請確認您的 GAS 網址正確且已發布最新版本 (包含 pull_sync 邏輯)！');
            } finally {
                if(!silent) hideLoading();
            }
        }

        function parseCloudDataToRecords(sheetsData, silent = false) {
            // 解析前不完全清空，而是基於現有的 tasks / students 更新
            // 但如果雲端有最新的手動狀態，我們要覆寫本機的 manualStatus。
            // 比較暴力但安全的做法是：清空現有記錄，完全重新建立
            db.records = [];
            db.ranges = []; // 清空並從雲端表頭重建，避免遺失舊的子欄位
            
            sheetsData.forEach(sheetObj => {
                const subject = sheetObj.name; // 回歸單純：一個 GAS URL 就是一個獨立班級
                const data = sheetObj.data;
                
                if(data.length < 4) return;
                
                const taskRow = data[0];
                const dateRow = data[1];
                const rangeRow = data[2];
                
                const tasksInSub = db.tasks.filter(t => t.subject === subject);
                
                // 先重建 db.ranges
                for (let c = 1; c < taskRow.length; c++) {
                    const taskName = taskRow[c] ? taskRow[c].toString().trim() : '';
                    const noticeName = rangeRow[c] ? rangeRow[c].toString().trim() : '';
                    const dateStr = dateRow[c] ? dateRow[c].toString().trim() : '';
                    
                    if (!taskName || !noticeName) continue;
                    
                    let task = tasksInSub.find(t => t.name === taskName);
                    if (!task) {
                        task = { id: 't_fixed_' + Date.now() + '_' + Math.floor(Math.random()*1000), subject: subject, name: taskName, type: 'fixed' };
                        db.tasks.push(task);
                        tasksInSub.push(task);
                    }
                    if (task) {
                        const existingRange = db.ranges.find(rg => rg.taskId === task.id && rg.noticeName === noticeName);
                        if (!existingRange) {
                            db.ranges.push({ taskId: task.id, noticeName: noticeName, range: noticeName, date: dateStr });
                        }
                    }
                }
                
                // 處理每一個學生
                for (let r = 3; r < data.length; r++) {
                    const studentName = data[r][0];
                    const student = db.students.find(s => s.name === studentName);
                    if (!student) continue; // 如果該學生不存在於本機名單，跳過
                    
                    for (let c = 1; c < data[r].length; c++) {
                        const cellValue = data[r][c] ? data[r][c].toString().trim() : '';
                        const taskName = taskRow[c] ? taskRow[c].toString().trim() : '';
                        const noticeName = rangeRow[c] ? rangeRow[c].toString().trim() : '';
                        
                        if (!taskName) continue;
                        
                        // 在本機尋找對應的 taskId
                        let task = tasksInSub.find(t => t.name === taskName);
                        if (!task) {
                            task = { id: 't_fixed_' + Date.now() + '_' + Math.floor(Math.random()*1000), subject: subject, name: taskName, type: 'fixed' };
                            db.tasks.push(task);
                            tasksInSub.push(task);
                        }
                        
                        // 忽略空白
                        if (!cellValue) continue;
                        if (cellValue === '缺交' || cellValue === '沒帶') {
                            // If they typed missing, we don't save a record, so it defaults to missing
                            continue;
                        }
                        
                        let record = {
                            studentId: student.id,
                            taskId: task.id,
                            noticeName: noticeName,
                            timestamp: ''
                        };
                        
                        const leaves = ["事假", "病假", "公假", "喪假", "曠課", "遲到", "其他", "其他假別"];
                        if (cellValue.startsWith('[遲交]')) {
                            record.manualStatus = 'late';
                            record.timestamp = cellValue.replace('[遲交]', '').trim();
                        } else if (leaves.includes(cellValue)) {
                            record.manualStatus = cellValue;
                            record.timestamp = '1970-01-01T00:00:00';
                        } else if (/^\d{1,2}\/\d{1,2} \d{1,2}:\d{1,2}/.test(cellValue) || /^20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}/.test(cellValue)) {
                            // Valid timestamp
                            record.timestamp = cellValue;
                        } else {
                            // User typed custom string like "沒帶", "生理假"
                            record.manualStatus = 'leave_custom_' + cellValue;
                            record.timestamp = '1970-01-01T00:00:00';
                        }
                        
                        db.records.push(record);
                    }
                }
            });
            
            saveData(silent);
            renderStatistics();
        }

        function importStudents(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            showLoading();
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, {header: 1}); // 轉為 2D 陣列
                    
                    if(json.length === 0) {
                        showAlert('提示', "檔案內容為空");
                        hideLoading();
                        return;
                    }

                    // 尋找姓名與座號欄位索引
                    let nameColIndex = -1;
                    let seatColIndex = -1;
                    let startIndex = 0;
                    
                    const headerRow = json[0];
                    const nameHeaderIndex = headerRow.findIndex(cell => typeof cell === 'string' && cell.includes('姓名'));
                    const seatHeaderIndex = headerRow.findIndex(cell => typeof cell === 'string' && cell.includes('座號'));

                    if (nameHeaderIndex !== -1 || seatHeaderIndex !== -1) {
                        // 有明確表頭
                        if (nameHeaderIndex !== -1) nameColIndex = nameHeaderIndex;
                        if (seatHeaderIndex !== -1) seatColIndex = seatHeaderIndex;
                        startIndex = 1; // 跳過表頭
                    } else {
                        // 無明確表頭，用第一筆資料推測
                        const firstDataRow = json[0];
                        if (firstDataRow && firstDataRow.length > 0) {
                            // 如果第一欄是數字，則認為第一欄是座號，第二欄是姓名
                            if (!isNaN(parseInt(firstDataRow[0]))) {
                                seatColIndex = 0;
                                nameColIndex = firstDataRow.length > 1 ? 1 : 0;
                            } else {
                                // 否則認為第一欄是姓名
                                nameColIndex = 0;
                            }
                        }
                    }

                    if (nameColIndex === -1) nameColIndex = 0; // 最終防呆

                    let addedCount = 0;
                    let startId = db.students.length > 0 ? Math.max(...db.students.map(s => s.id)) + 1 : 1;

                    for(let i = startIndex; i < json.length; i++) {
                        const row = json[i];
                        if (!row || row.length === 0) continue;
                        const name = row[nameColIndex];
                        
                        let newId;
                        if (seatColIndex !== -1 && row[seatColIndex] !== undefined) {
                            newId = parseInt(row[seatColIndex]);
                            if (isNaN(newId)) continue; // skip invalid or empty seat numbers
                        } else {
                            newId = startId++;
                        }

                        if (name && String(name).trim() !== "") {
                            const existingIdx = db.students.findIndex(s => s.id === newId);
                            if (existingIdx !== -1) {
                                db.students[existingIdx].name = String(name).trim();
                            } else {
                                const token = `STU${String(newId).padStart(3, '0')}`;
                                db.students.push({ id: newId, name: String(name).trim(), token, salt: generateSalt(), createdAt: Date.now() });
                            }
                            addedCount++;
                        }
                    }
                    db.students.sort((a, b) => a.id - b.id);

                    saveData();
                    renderStudents();
                    showToast(`成功匯入 ${addedCount} 位學生！(系統已自動識別${seatColIndex !== -1 ? '座號與姓名並處理跳號' : '姓名'}, 'success')`);
                } catch(err) {
                    console.error(err);
                    showAlert('提示', "讀取檔案失敗，請確定格式正確。");
                }
                // 清空 input 讓下次選同一個檔案也能觸發
                event.target.value = '';
                hideLoading();
            };
            reader.readAsArrayBuffer(file);
        }

        async function removeStudent(id) {
            const result = await showConfirm('確定要刪除這名學生嗎？', '這也會刪除他所有的繳交紀錄！', 'warning', '刪除', '取消');
            if(result.isConfirmed) {
                saveStateForUndo();
                db.students = db.students.filter(s => s.id !== id);
                db.records = db.records.filter(r => r.studentId !== id);
                saveData();
                renderStudents();
                showUndoToast('已刪除學生資料。');
            }
        }

        function renderStudents() {
            const list = document.getElementById('student-list');
            list.innerHTML = '';
            db.students.forEach(s => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center py-1 border-b last:border-0 hover:bg-gray-50';
                li.innerHTML = `<span class="font-mono text-gray-500 w-12 text-right pr-2">${s.id}.</span>
                                <span class="font-mono text-blue-600 w-24">${s.token}</span>
                                <span class="flex-grow font-medium text-gray-800">${s.name}</span>
                                <button onclick="removeStudent(${s.id})" class="text-red-500 hover:text-red-700 text-sm px-2">刪除</button>`;
                list.appendChild(li);
            });
        }

        
        function sortTasks() {
            const subjectOrder = ['國語', '數學', '社會', '自然', '聯絡簿', '學習單', '其他'];
            db.tasks.sort((a, b) => {
                let idxA = subjectOrder.indexOf(a.subject);
                let idxB = subjectOrder.indexOf(b.subject);
                if (idxA === -1) idxA = 999;
                if (idxB === -1) idxB = 999;
                if (idxA !== idxB) return idxA - idxB;
                if (a.type !== b.type) return a.type === 'fixed' ? -1 : 1;
                return 0;
            });
        }
function addTask() {
            const subject = document.getElementById('new-task-subject').value;
            const name = document.getElementById('new-task-name').value.trim();
            const type = document.getElementById('new-task-type').value;
            if (!name) return;
            const id = 't' + Date.now();
            db.tasks.push({ id, subject, name, type });
            sortTasks();
            document.getElementById('new-task-name').value = '';
            saveData();
            renderTasks();
        }

        async function removeTask(id) {
            const result = await showConfirm('確定要刪除這個作業嗎？', '這也會刪除所有相關的繳交紀錄！', 'warning', '刪除', '取消');
            if(result.isConfirmed) {
                saveStateForUndo();
                db.tasks = db.tasks.filter(t => t.id !== id);
                db.records = db.records.filter(r => r.taskId !== id);
                if(db.ranges) db.ranges = db.ranges.filter(r => r.taskId !== id);
                saveData();
                renderTasks();
                renderSubjects();
                showUndoToast('已刪除作業。');
            }
        }

        function editTask(id) {
            const task = db.tasks.find(t => t.id === id);
            if(!task) return;
            const newName = prompt("請輸入新的作業名稱：", task.name);
            if(newName && newName.trim() !== "") {
                task.name = newName.trim();
                saveData();
                renderTasks();
                initAllSelects();
                if(typeof renderStatistics === 'function') renderStatistics();
            }
        }

                
        window.toggleAllAccordions = function(containerId, expand) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const icons = container.querySelectorAll('svg[id$="-icon"]');
            icons.forEach(icon => {
                const accId = icon.id.replace('-icon', '');
                const el = document.getElementById(accId);
                if (el) {
                    if (expand) {
                        el.classList.remove('hidden');
                        icon.style.transform = 'rotate(180deg)';
                    } else {
                        el.classList.add('hidden');
                        icon.style.transform = 'rotate(0deg)';
                    }
                }
            });
        };

        window.toggleAccordion = function(id) {
            const el = document.getElementById(id);
            const icon = document.getElementById(id + '-icon');
            if (el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                if(icon) icon.style.transform = 'rotate(180deg)';
            } else {
                el.classList.add('hidden');
                if(icon) icon.style.transform = 'rotate(0deg)';
            }
        };

        function renderTasks() {
            const list = document.getElementById('task-list');
            list.innerHTML = '';
            
            const grouped = {};
            db.tasks.forEach(t => {
                if (!grouped[t.subject]) grouped[t.subject] = [];
                grouped[t.subject].push(t);
            });
            
            for (const [subject, tasks] of Object.entries(grouped)) {
                const accId = 'acc-task-' + subject;
                const html = `
                    <div class="border rounded mb-2 overflow-hidden">
                        <button onclick="toggleAccordion('${accId}')" class="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 font-bold text-gray-700 flex justify-between items-center">
                            <span>${subject} <span class="text-xs font-normal text-gray-500">(${tasks.length})</span></span>
                            <svg id="${accId}-icon" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div id="${accId}" class="hidden flex-col">
                            <ul class="px-4 py-2 bg-white">
                                ${tasks.map(t => `
                                    <li class="flex justify-between items-center py-2 border-b last:border-0">
                                        <span class="flex-grow">${t.name} <span class="text-xs bg-gray-200 px-1 rounded ml-1">${t.type === 'fixed' ? '固' : '浮'}</span></span>
                                        <div>
                                            <button onclick="editTask('${t.id}')" class="text-blue-500 hover:text-blue-700 text-sm px-2 border-r">改名</button>
                                            <button onclick="removeTask('${t.id}')" class="text-red-500 hover:text-red-700 text-sm px-2">刪除</button>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
                list.innerHTML += html;
            }
        }


        async function exportRawCodes() {
            if(db.students.length === 0) { showAlert('提示', '尚未建立學生名單'); return; }
            showLoading();
            setTimeout(async () => {
                try {
                    if (window.ExcelJS) {
                        const workbook = new ExcelJS.Workbook();
                        
                        // Sheet 1: 學生識別代碼
                        const ws1 = workbook.addWorksheet('學生防偽代碼');
                        ws1.columns = [
                            { header: '座號', key: 'id', width: 10 },
                            { header: '姓名', key: 'name', width: 15 },
                            { header: '系統識別Token', key: 'token', width: 25 },
                            { header: '防偽密碼(Salt)', key: 'salt', width: 20 }
                        ];
                        ws1.getRow(1).font = { bold: true };
                        ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                        
                        db.students.forEach(s => {
                            ws1.addRow({ id: s.id, name: s.name, token: s.token, salt: s.salt });
                        });

                        // Sheet 2: 各項作業條碼清單 (圖 + 代碼)
                        const allTasks = db.tasks;
                        if(allTasks.length > 0) {
                            const ws2 = workbook.addWorksheet('作業條碼清單(圖與代碼)');
                            
                            const columns = [
                                { header: '座號', key: 'id', width: 8 },
                                { header: '姓名', key: 'name', width: 14 }
                            ];
                            
                            const wCm = 4;
                            const hCm = 2.0;
                            const cmToPx = 118.11;
                            const wPx = Math.floor(wCm * cmToPx);
                            const hPx = Math.floor(hCm * cmToPx);
                            const colImgWidth = Math.max(16, Math.floor(wCm * 5.5) + 4);
                            
                            allTasks.forEach(t => {
                                columns.push({ header: `[${t.subject}] ${t.name} (圖)`, key: `img_${t.id}`, width: colImgWidth });
                                columns.push({ header: `[${t.subject}] ${t.name} (代碼)`, key: `code_${t.id}`, width: 30 });
                            });
                            ws2.columns = columns;
                            
                            const headerRow = ws2.getRow(1);
                            headerRow.height = 25;
                            headerRow.font = { bold: true };
                            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

                            const rowHeightPt = Math.floor(hCm * 28.35) + 12;
                            const imgDisplayW = Math.floor(wCm * 37.8);
                            const imgDisplayH = Math.floor(hCm * 37.8);

                            for (let sIdx = 0; sIdx < db.students.length; sIdx++) {
                                const student = db.students[sIdx];
                                const rowIndex = sIdx + 2;
                                const row = ws2.getRow(rowIndex);
                                row.height = rowHeightPt;
                                
                                row.getCell(1).value = student.id;
                                row.getCell(2).value = student.name;
                                row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                                row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center', font: { bold: true } };

                                for (let tIdx = 0; tIdx < allTasks.length; tIdx++) {
                                    const task = allTasks[tIdx];
                                    const colImgIndex = 3 + (tIdx * 2);
                                    const colCodeIndex = 4 + (tIdx * 2);
                                    
                                    // 填寫代碼
                                    const codeCell = row.getCell(colCodeIndex);
                                    codeCell.value = getQRText(student, task);
                                    codeCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                                    codeCell.font = { name: 'Courier New', size: 9 };

                                    // 產生並插入圖片
                                    const dataUrl = await createLabelImage(student, task, '', true, wPx, hPx);
                                    const base64Data = dataUrl.split(',')[1];
                                    const imageId = workbook.addImage({ base64: base64Data, extension: 'png' });
                                    
                                    ws2.addImage(imageId, {
                                        tl: { col: colImgIndex - 1 + 0.05, row: rowIndex - 1 + 0.08 },
                                        ext: { width: imgDisplayW, height: imgDisplayH },
                                        editAs: 'oneCell'
                                    });
                                }
                            }
                            
                            // 畫邊框
                            ws2.eachRow((row) => {
                                row.eachCell((cell) => {
                                    cell.border = {
                                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                                    };
                                });
                            });
                        }
                        
                        const buffer = await workbook.xlsx.writeBuffer();
                        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = "學生防偽代碼與作業條碼清單.xlsx";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } else {
                        // Fallback to basic SheetJS without images if ExcelJS fails to load
                        const wb = XLSX.utils.book_new();
                        let tokenData = [['座號', '姓名', '系統識別Token', '防偽密碼(Salt)']];
                        db.students.forEach(s => tokenData.push([s.id, s.name, s.token, s.salt]));
                        const ws1 = XLSX.utils.aoa_to_sheet(tokenData);
                        XLSX.utils.book_append_sheet(wb, ws1, "學生防偽代碼");

                        const allTasks = db.tasks;
                        if(allTasks.length > 0) {
                            const barcodeHeader = ['座號', '姓名'];
                            allTasks.forEach(t => barcodeHeader.push(`[${t.subject}] ${t.name}`));
                            const barcodeData = [barcodeHeader];
                            db.students.forEach(s => {
                                const row = [s.id, s.name];
                                allTasks.forEach(t => row.push(getQRText(s, t)));
                                barcodeData.push(row);
                            });
                            const ws2 = XLSX.utils.aoa_to_sheet(barcodeData);
                            XLSX.utils.book_append_sheet(wb, ws2, "各項作業條碼字串");
                        }
                        XLSX.writeFile(wb, "學生防偽代碼與作業條碼清單.xlsx");
                    }
                } catch(e) {
                    showAlert('提示', "匯出失敗: " + e.message);
                }
                hideLoading();
            }, 100);
        }

        async function resetData() {
            const result = await showConfirm('警告：這將清除所有資料！', '包含學生、作業與掃描紀錄。確定嗎？', 'warning', '清除', '取消');
            if(result.isConfirmed) {
                db = { students: [], tasks: [...DEFAULT_TASKS], records: [], ranges: [], subjects: [] };
                saveData();
                renderStudents();
                renderTasks();
            }
        }

        // ==========================================
        // 動態選單更新 (Tabs 2~6)
        // ==========================================
        function initAllSelects() { initScanSessionDropdown();
            const fixedTasks = db.tasks.filter(t => t.type === 'fixed');
            const floatingTasks = db.tasks.filter(t => t.type === 'floating');
            const allTasks = db.tasks;

            const renderCheckboxes = (containerId, tasks, onChange, showType = false) => {
                const el = document.getElementById(containerId);
                if (!el) return;
                const onChangeStr = onChange ? `onchange="${onChange}"` : '';
                
                const grouped = {};
                tasks.forEach(t => {
                    if (!grouped[t.subject]) grouped[t.subject] = [];
                    grouped[t.subject].push(t);
                });
                
                let html = '';
                for (const [subject, subTasks] of Object.entries(grouped)) {
                    const accId = containerId + '-acc-' + subject;
                    html += `
                        <div class="border rounded mb-2 overflow-hidden">
                            <button type="button" onclick="toggleAccordion('${accId}')" class="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 font-bold text-blue-800 flex justify-between items-center border-b border-blue-200">
                                <span>${subject} <span class="text-xs font-normal text-blue-600">(${subTasks.length})</span></span>
                                <svg id="${accId}-icon" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div id="${accId}" class="hidden flex-col bg-white">
                                ${subTasks.map(t => {
                                    const typeStr = showType ? (t.type === 'fixed' ? '[固] ' : '[浮] ') : '';
                                    return `
                                    <label class="flex items-center space-x-3 py-2 cursor-pointer hover:bg-gray-50 rounded-none px-4 transition-colors border-b last:border-0 border-gray-100">
                                        <input type="checkbox" value="${t.id}" class="form-checkbox text-blue-600 h-5 w-5 cursor-pointer rounded" ${onChangeStr}>
                                        <span class="text-sm font-semibold text-gray-700 select-none">${typeStr}${t.name}</span>
                                    </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }
                el.innerHTML = html;
            };

            const populateSelect = (selectId, tasks) => {
                const el = document.getElementById(selectId);
                if (!el) return;
                el.innerHTML = tasks.map(t => `<option value="${t.id}">[${t.subject}] ${t.name}</option>`).join('');
            };

            renderCheckboxes('tab2-task-checkboxes', fixedTasks);
            
            // Tab 3 select
            const scanTargetTask = document.getElementById('scan-target-task');
            if(scanTargetTask) {
                const currentVal = scanTargetTask.value;
                scanTargetTask.innerHTML = '<option value="">-- 請選擇作業 --</option>' + allTasks.map(t => `<option value="${t.id}">[${t.type==='fixed'?'固':'浮'}] [${t.subject}] ${t.name}</option>`).join('');
                scanTargetTask.value = currentVal;
            }
            populateSelect('tab3-task-select', floatingTasks);
            toggleNoticeInput();
            
            // Tab 4: 條碼匯出與列印
            renderCheckboxes('tab4-task-checkboxes', allTasks, null, true);
            const tab4StudentCheckboxes = document.getElementById('tab4-student-checkboxes');
            if(tab4StudentCheckboxes) {
                tab4StudentCheckboxes.innerHTML = db.students.map(s => `
                    <label class="flex items-center space-x-3 p-2 border-b last:border-0 hover:bg-blue-50 cursor-pointer transition-colors rounded">
                        <input type="checkbox" value="${s.id}" class="h-5 w-5 cursor-pointer rounded text-blue-600" checked>
                        <span class="text-base font-semibold text-gray-700 select-none">${s.name} <span class="text-gray-400 font-normal text-sm">(${s.id}號)</span></span>
                    </label>
                `).join('');
            }
        }

        function getCheckedTaskIds(containerId) {
            const el = document.getElementById(containerId);
            if(!el) return [];
            return Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        }

        function toggleNoticeInput() {
            const select = document.getElementById('tab3-task-select');
            const task = db.tasks.find(t => t.id === select.value);
            const container = document.getElementById('notice-name-container');
            if (task) {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }



// ==========================================
// 備份介面 (Backup UI)
// ==========================================
// ==========================================
// 沉浸式掃描模式
// ==========================================
function toggleImmersiveMode() {
    document.body.classList.toggle('immersive-active');
    const btn = document.getElementById('immersive-toggle-btn');
    if(document.body.classList.contains('immersive-active')) {
        btn.innerHTML = '<span>⬅️</span> 退出沉浸模式';
        btn.classList.remove('bg-gray-800', 'hover:bg-gray-900');
        btn.classList.add('bg-red-600', 'hover:bg-red-700');
        // 自動捲動到最頂端，隱藏不必要的空間
        document.getElementById('tab-1').scrollIntoView({behavior: 'smooth', block: 'start'});
    } else {
        btn.innerHTML = '<span>📱</span> 沉浸掃描';
        btn.classList.remove('bg-red-600', 'hover:bg-red-700');
        btn.classList.add('bg-gray-800', 'hover:bg-gray-900');
    }
}

async function showBackupModal() {
    document.getElementById('backup-modal').style.display = 'flex';
    const list = document.getElementById('backup-list');
    list.innerHTML = '<div class="text-gray-500 text-center py-4">載入中...</div>';
    
    if (typeof getBackups === 'function') {
        const backups = await getBackups();
        if (backups.length === 0) {
            list.innerHTML = '<div class="text-gray-500 text-center py-4">目前沒有備份紀錄。</div>';
            return;
        }
        
        let html = '';
        backups.forEach(b => {
            let dataPreview = '';
            try {
                const parsed = JSON.parse(b.data);
                dataPreview = `學生數: ${parsed.students?.length || 0} / 作業數: ${parsed.tasks?.length || 0} / 紀錄數: ${parsed.records?.length || 0}`;
            } catch(e) {}
            
            html += `
                <div class="border rounded p-3 flex justify-between items-center bg-gray-50 hover:bg-white transition">
                    <div>
                        <div class="font-bold text-gray-800">${b.dateString}</div>
                        <div class="text-xs text-gray-500">${dataPreview}</div>
                    </div>
                    <button onclick="restoreBackup(${b.timestamp})" class="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1 rounded text-sm font-bold shadow-sm cursor-pointer">
                        還原
                    </button>
                </div>
            `;
        });
        list.innerHTML = html;
    } else {
        list.innerHTML = '<div class="text-red-500 text-center py-4">備份模組尚未載入。</div>';
    }
}

function hideBackupModal() {
    document.getElementById('backup-modal').style.display = 'none';
}

async function clearStudents() {
    if (db.students.length === 0) {
        showToast("名單已經是空的了！", "info");
        return;
    }
    const result = await showConfirm("警告：確定要清空學生名單嗎？", "這將會刪除目前班級內的所有學生資料，且無法復原！", "warning", "確定清空", "取消");
    if (!result.isConfirmed) return;
    
    db.students = [];
    saveData();
    renderStudents();
    showToast("名單已清空", "success");
}

        async function hideClassTabs(classId, prefix) {
            if(!appConfig.gasUrl) {
                showAlert('提示', '請先設定雲端引擎網址！');
                return;
            }
            if(!prefix) {
                showToast('此班級無前綴，無法隱藏', 'error');
                return;
            }
            const result = await showConfirm("確定要在雲端隱藏分頁嗎？", "這會將 Google 試算表中所有該班級的分頁隱藏起來，保持畫面清爽。隨時可以從試算表左下角重新顯示。");
            if(!result.isConfirmed) return;
            
            showLoading();
            try {
                const response = await fetch(appConfig.gasUrl, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: 'hide_class_tabs', classPrefix: prefix })
                });
                const data = await response.json();
                hideLoading();
                if (data.status === 'success') {
                    showAlert('成功', `已成功在雲端隱藏 ${data.hiddenCount} 個分頁！`, 'success');
                } else {
                    showAlert('錯誤', data.message || '隱藏分頁失敗。', 'error');
                }
            } catch (err) {
                hideLoading();
                showAlert('錯誤', '無法連線：' + err.message, 'error');
            }
        }

        async function showClassTabs(classId, prefix) {
            if(!appConfig.gasUrl) {
                showAlert('提示', '請先設定雲端引擎網址！');
                return;
            }
            if(!prefix) {
                showToast('此班級無前綴，無法顯示', 'error');
                return;
            }
            showLoading();
            try {
                const response = await fetch(appConfig.gasUrl, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: 'show_class_tabs', classPrefix: prefix })
                });
                const data = await response.json();
                hideLoading();
                if (data.status === 'success') {
                    showToast(`已成功在雲端顯示 ${data.shownCount} 個分頁！`, 'success');
                } else {
                    showAlert('錯誤', data.message || '顯示分頁失敗。', 'error');
                }
            } catch (err) {
                hideLoading();
                showAlert('錯誤', '無法連線：' + err.message, 'error');
            }
        }

window.moveSelectedClassUp = function() {
    const activeIndex = appConfig.classes.findIndex(c => c.id === appConfig.activeClassId);
    if (activeIndex > 0) moveClassUp(activeIndex);
};

window.moveSelectedClassDown = function() {
    const activeIndex = appConfig.classes.findIndex(c => c.id === appConfig.activeClassId);
    if (activeIndex !== -1 && activeIndex < appConfig.classes.length - 1) moveClassDown(activeIndex);
};

window.hideSelectedClassTabs = function() {
    const c = appConfig.classes.find(c => c.id === appConfig.activeClassId);
    if (c) hideClassTabs(c.id, c.prefix);
};

window.showSelectedClassTabs = function() {
    const c = appConfig.classes.find(c => c.id === appConfig.activeClassId);
    if (c) showClassTabs(c.id, c.prefix);
};

window.deleteSelectedClass = function() {
    if (!appConfig.activeClassId) return;
    showConfirm('刪除確認', '確定要刪除目前的班級嗎？這不會刪除雲端試算表上的資料，但會從本機清單中移除。').then(result => {
        if (result.isConfirmed) {
            appConfig.classes = appConfig.classes.filter(c => c.id !== appConfig.activeClassId);
            appConfig.activeClassId = appConfig.classes.length > 0 ? appConfig.classes[0].id : null;
            saveAppConfig();
            window.location.reload();
        }
    });
};
