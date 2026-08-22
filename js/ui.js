        // UI 工具
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
                alert("switchTab Error: " + err.message + "\n" + err.stack);
            }
        }

        function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
        function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

        // ==========================================
        // Tab 0: 資料建置
        // ==========================================
        
        function saveClassInfo(e) {
            db.classInfo = {
                schoolName: document.getElementById('info-school').value.trim(),
                academicYear: document.getElementById('info-year').value.trim(),
                semester: document.getElementById('info-semester').value,
                className: document.getElementById('info-class').value.trim()
            };
            saveData();
            updateHeaderClassInfo();
            // Show toast or alert if clicked button
            if(e && e.type === 'click') alert('班級資訊已儲存！');
            else if(typeof event !== 'undefined' && event && event.type === 'click') alert('班級資訊已儲存！');
        }

        function updateHeaderClassInfo() {
            if(!db.classInfo) return;
            const parts = [
                db.classInfo.schoolName, 
                db.classInfo.academicYear ? `${db.classInfo.academicYear}學年` : '', 
                db.classInfo.semester, 
                db.classInfo.className
            ].filter(Boolean);
            
            const headerEl = document.getElementById('header-class-info');
            if (headerEl) {
                if (parts.length > 0) {
                    headerEl.innerText = parts.join(' | ');
                    headerEl.style.display = 'inline-block';
                } else {
                    headerEl.style.display = 'none';
                }
            }
            
            // Populate inputs if they exist
            if(document.getElementById('info-school')) document.getElementById('info-school').value = db.classInfo.schoolName || '';
            if(document.getElementById('info-year')) document.getElementById('info-year').value = db.classInfo.academicYear || '';
            if(document.getElementById('info-semester')) document.getElementById('info-semester').value = db.classInfo.semester || '';
            if(document.getElementById('info-class')) document.getElementById('info-class').value = db.classInfo.className || '';
        }
        
        function getClassPrefix() {
            if(!db.classInfo) return "";
            const parts = [
                db.classInfo.schoolName, 
                db.classInfo.academicYear, 
                db.classInfo.semester, 
                db.classInfo.className
            ].filter(Boolean);
            return parts.length > 0 ? parts.join('_') + "_" : "";
        }
        function addStudent() {
            const idInput = document.getElementById('new-student-id');
            const nameInput = document.getElementById('new-student-name');
            const name = nameInput.value.trim();
            if (!name) return;
            
            let newId;
            if (idInput && idInput.value.trim() !== '') {
                newId = parseInt(idInput.value, 10);
                if (isNaN(newId) || newId <= 0) {
                    alert('請輸入有效的座號！');
                    return;
                }
                const existingIdx = db.students.findIndex(s => s.id === newId);
                if (existingIdx !== -1) {
                    if(!confirm(`座號 ${newId} 已經存在（${db.students[existingIdx].name}），是否要覆蓋該學生資料？`)) {
                        return;
                    }
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
                alert("新增成功！\n\n若您有設定 Google 雲端同步，請記得點選右方「備份至雲端」按鈕，以確保最新名單同步至試算表中。");
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



        function pushStudentsToGas() {
            if(!gasUrl) {
                alert('請先到「0. 資料建置」分頁設定並儲存您的 Google Apps Script 網址！');
                return;
            }
            let elClass = document.getElementById('info-class');
            let currentClass = elClass ? elClass.value.trim() : '';
            if (!currentClass) {
                currentClass = prompt("⚠️ 您尚未設定「班級名稱」，這將導致掃描紀錄無法分類。\n請先輸入班級名稱 (例如: 三年甲班) :");
                if (currentClass) {
                    if(elClass) elClass.value = currentClass;
                    saveClassInfo();
                } else {
                    return; // 放棄備份
                }
            }
            if(!confirm("確定要將目前的「全系統設定檔與學生名單」備份到 Google 試算表嗎？\n這將覆蓋雲端的舊設定，以便其他裝置匯入。")) return;

            showLoading();
            
            try {
                const configPayload = {
                    classInfo: db.classInfo,
                    tasks: db.tasks,
                    sheetUrl: sheetUrl
                };
            fetch(gasUrl, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: 'sync_students', students: db.students, config: configPayload })
                }).then(res => res.json())
                  .then(data => {
                      hideLoading();
                      if(data.status === 'success') {
                          alert("成功將全系統設定檔與學生名單備份至 Google 試算表！\n現在您可以在手機上點擊「從雲端匯入」瞬間完成所有設定。");
                      } else {
                          alert("備份失敗：" + (data.message || JSON.stringify(data)));
                      }
                  })
                  .catch(err => {
                      hideLoading();
                      console.error(err);
                      alert("網路連線錯誤，請確認您的 GAS 網址正確且已發布最新版本！\n" + err);
                  });
            } catch (err) {
                hideLoading();
                console.error("Synchronous error during fetch setup:", err);
                alert("發生未預期的系統錯誤 (例如資料格式異常)：\n" + err.message);
            }
        }

        function fetchStudentsFromGas() {
            const gasInput = document.getElementById('gas-url');
            if (!gasUrl && gasInput && gasInput.value.trim()) {
                saveGasUrl();
            }
            if(!gasUrl) {
                alert('請先到「0. 資料建置」分頁設定並儲存您的 Google Apps Script 網址！');
                return;
            }
            
            

            if(!confirm("確定要從雲端還原「全系統設定與學生名單」嗎？\n這將會覆蓋您裝置上目前的班級資訊、作業設定與學生名單。")) return;

            showLoading();
            fetch(gasUrl, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'get_students' })
            }).then(res => res.json())
              .then(data => {
                  hideLoading();
                  if(data.status === 'success') {
                      let msg = '';
                      // 處理 config 復原
                      if (data.config) {
                          if (data.config.classInfo) {
                              db.classInfo = data.config.classInfo;
                              updateHeaderClassInfo();
                              const elSchool = document.getElementById('info-school');
                              const elYear = document.getElementById('info-year');
                              const elSemester = document.getElementById('info-semester');
                              const elClass = document.getElementById('info-class');
                              if(elSchool) elSchool.value = db.classInfo.schoolName || '';
                              if(elYear) elYear.value = db.classInfo.academicYear || '';
                              if(elSemester) elSemester.value = db.classInfo.semester || '上';
                              if(elClass) elClass.value = db.classInfo.className || '';
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
                      alert(msg);
                  } else {
                      alert("匯入失敗：" + (data.message || JSON.stringify(data)));
                  }
              })
              .catch(err => {
                  hideLoading();
                  console.error(err);
                  alert("網路連線錯誤，請確認您的 GAS 網址正確且已發布最新版本 (包含 get_students 邏輯)！");
              });
        }


        async function syncFromGoogleSheets(silent = false) {
            if(!gasUrl) {
                if(!silent) alert('請先至「0. 資料建置」填寫您的 Google Apps Script 網址，才能進行雲端同步！');
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
                    body: JSON.stringify({ action: 'pull_sync' })
                });
                const data = await response.json();
                
                if(data.status === 'success' && data.sheetsData) {
                    parseCloudDataToRecords(data.sheetsData, silent);
                    if(!silent) alert('雲端資料拉取成功！');
                } else {
                    if(!silent) alert('拉取失敗：' + (data.message || '未知錯誤'));
                }
            } catch (err) {
                console.error(err);
                if(!silent) alert('網路連線錯誤，請確認您的 GAS 網址正確且已發布最新版本 (包含 pull_sync 邏輯)！');
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
                            // 如果沒找到，或許可以嘗試建立（這邊先忽略，要求老師先自雲端匯入設定）
                            continue;
                        }
                        
                        // 忽略缺交與空白
                        if (!cellValue || cellValue === '缺交') continue;
                        
                        let record = {
                            studentId: student.id,
                            taskId: task.id,
                            noticeName: noticeName,
                            timestamp: ''
                        };
                        
                        const leaves = ["事假", "病假", "公假", "喪假", "曠課", "遲到", "其他"];
                        if (cellValue.startsWith('[遲交]')) {
                            record.manualStatus = 'late';
                            record.timestamp = cellValue.replace('[遲交]', '').trim();
                        } else if (leaves.includes(cellValue)) {
                            record.manualStatus = cellValue;
                            record.timestamp = '1970-01-01T00:00:00'; // Dummy timestamp for leaves
                        } else {
                            record.timestamp = cellValue;
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
                        alert("檔案內容為空");
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
                    alert(`成功匯入 ${addedCount} 位學生！(系統已自動識別${seatColIndex !== -1 ? '座號與姓名並處理跳號' : '姓名'})`);
                } catch(err) {
                    console.error(err);
                    alert("讀取檔案失敗，請確定格式正確。");
                }
                // 清空 input 讓下次選同一個檔案也能觸發
                event.target.value = '';
                hideLoading();
            };
            reader.readAsArrayBuffer(file);
        }

        function removeStudent(id) {
            if(confirm('確定要刪除這名學生嗎？這也會刪除他所有的繳交紀錄！')) {
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
            const subjectOrder = ['國語', '數學', '社會', '自然', '聯絡簿', '其他'];
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

        function removeTask(id) {
            if(confirm('確定要刪除這個作業嗎？這也會刪除所有相關的繳交紀錄！')) {
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

        function renderTasks() {
            const list = document.getElementById('task-list');
            list.innerHTML = '';
            db.tasks.forEach(t => {
                const typeName = t.type === 'fixed' ? '固' : '浮';
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center py-1 border-b last:border-0';
                li.innerHTML = `<span class="text-gray-500 w-16">[${t.subject}]</span>
                                <span class="flex-grow">${t.name} <span class="text-xs bg-gray-200 px-1 rounded">${typeName}</span></span>
                                <div>
                                    <button onclick="editTask('${t.id}')" class="text-blue-500 hover:text-blue-700 text-sm px-2 border-r">改名</button>
                                    <button onclick="removeTask('${t.id}')" class="text-red-500 hover:text-red-700 text-sm px-2">刪除</button>
                                </div>`;
                list.appendChild(li);
            });
        }


        async function exportRawCodes() {
            if(db.students.length === 0) { alert('尚未建立學生名單'); return; }
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
                    alert("匯出失敗: " + e.message);
                }
                hideLoading();
            }, 100);
        }

        function resetData() {
            if(confirm("警告：這將清除所有學生、作業與掃描紀錄！確定嗎？")) {
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
                el.innerHTML = tasks.map(t => {
                    const typeStr = showType ? (t.type === 'fixed' ? '[固] ' : '[浮] ') : '';
                    return `
                    <label class="flex items-center space-x-3 py-2 cursor-pointer hover:bg-blue-50 rounded px-2 transition-colors border-b last:border-0 border-gray-100">
                        <input type="checkbox" value="${t.id}" class="form-checkbox text-blue-600 h-5 w-5 cursor-pointer rounded" ${onChangeStr}>
                        <span class="text-base font-semibold text-gray-700 select-none">${typeStr}[${t.subject}] ${t.name}</span>
                    </label>
                    `;
                }).join('');
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
