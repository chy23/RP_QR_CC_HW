// js/report.js

// 初始化報表頁籤：載入學生清單與作業清單
function renderReportTab() {
    renderReportStudents();
    renderReportTasks();
}

function renderReportStudents() {
    const container = document.getElementById('report-students-container');
    if (!container) return;
    container.innerHTML = '';

    if (!db.students || db.students.length === 0) {
        container.innerHTML = '<div class="text-gray-500 p-2 col-span-full">尚未建立學生名單</div>';
        return;
    }

    db.students.forEach(s => {
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 p-1 hover:bg-gray-100 rounded cursor-pointer';
        label.innerHTML = \`
            <input type="checkbox" class="report-student-cb rounded text-amber-600 focus:ring-amber-500" value="\${s.id}" checked>
            <span class="truncate">\${s.id} \${s.name}</span>
        \`;
        container.appendChild(label);
    });
}

function renderReportTasks() {
    const container = document.getElementById('report-tasks-container');
    if (!container) return;
    container.innerHTML = '';

    if (!db.tasks || db.tasks.length === 0) {
        container.innerHTML = '<div class="text-gray-500 p-2">尚未建立作業項目</div>';
        return;
    }

    // 找出所有獨立的 (taskId, noticeName) 組合
    let uniqueTaskKeys = [];
    db.tasks.forEach(t => {
        // 檢查 records 或 ranges 中是否有這個 task 的不同 noticeName
        const hasBaseRecords = db.records.some(r => r.taskId === t.id && !r.noticeName);
        const hasSubRecords = db.records.some(r => r.taskId === t.id && r.noticeName);
        const hasSubRanges = (db.ranges || []).some(r => r.taskId === t.id && r.noticeName);
        
        if (!hasSubRecords && !hasSubRanges) {
            uniqueTaskKeys.push({ taskId: t.id, noticeName: '', label: \`\${t.subject} - \${t.name}\` });
        } else {
            if (hasBaseRecords) {
                uniqueTaskKeys.push({ taskId: t.id, noticeName: '', label: \`\${t.subject} - \${t.name} (無範圍)\` });
            }
            db.records.filter(r => r.taskId === t.id).forEach(r => {
                if (r.noticeName) {
                    const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                    if (!exists) {
                        uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: \`\${t.subject} - \${t.name} (\${r.noticeName})\` });
                    }
                }
            });
            (db.ranges || []).filter(r => r.taskId === t.id).forEach(r => {
                if (r.noticeName) {
                    const exists = uniqueTaskKeys.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName);
                    if (!exists) {
                        uniqueTaskKeys.push({ taskId: t.id, noticeName: r.noticeName, label: \`\${t.subject} - \${t.name} (\${r.noticeName})\` });
                    }
                }
            });
        }
    });

    if (uniqueTaskKeys.length === 0) {
        container.innerHTML = '<div class="text-gray-500 p-2">尚無作業紀錄</div>';
        return;
    }

    uniqueTaskKeys.forEach((k, index) => {
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 p-1 hover:bg-gray-100 rounded cursor-pointer';
        // 將 taskId 和 noticeName 組合成一個值
        const val = k.taskId + '|||' + k.noticeName;
        // 預設只勾選最近 10 筆，避免一次列印太多
        const isChecked = ''; // Default unselected
        label.innerHTML = \`
            <input type="checkbox" class="report-task-cb rounded text-amber-600 focus:ring-amber-500" value="\${val}" \${isChecked}>
            <span class="truncate" title="\${k.label}">\${k.label}</span>
        \`;
        container.appendChild(label);
    });
}


function selectFixedTasksReport() {
    document.querySelectorAll('.report-task-cb').forEach(cb => {
        const parts = cb.value.split('|||');
        const task = db.tasks.find(t => t.id === parts[0]);
        if (task && task.type === 'fixed') cb.checked = true;
    });
}

function selectFloatingTasksReport() {
    document.querySelectorAll('.report-task-cb').forEach(cb => {
        const parts = cb.value.split('|||');
        const task = db.tasks.find(t => t.id === parts[0]);
        if (task && task.type === 'floating') cb.checked = true;
    });
}

function selectSubjectTasksReport(subject) {
    document.querySelectorAll('.report-task-cb').forEach(cb => {
        const parts = cb.value.split('|||');
        const task = db.tasks.find(t => t.id === parts[0]);
        if (task && task.subject === subject) cb.checked = true;
    });
}

function selectAllReportStudents(check) {
    document.querySelectorAll('.report-student-cb').forEach(cb => cb.checked = check);
}

function selectAllReportTasks(check) {
    document.querySelectorAll('.report-task-cb').forEach(cb => cb.checked = check);
}

function generateReport() {
    const selectedStudentIds = Array.from(document.querySelectorAll('.report-student-cb:checked')).map(cb => cb.value);
    const selectedTaskVals = Array.from(document.querySelectorAll('.report-task-cb:checked')).map(cb => cb.value);

    if (selectedStudentIds.length === 0) {
        alert("請至少選擇一位學生！");
        return;
    }
    if (selectedTaskVals.length === 0) {
        alert("請至少選擇一項作業！");
        return;
    }

    const selectedTasks = selectedTaskVals.map(val => {
        const parts = val.split('|||');
        return { taskId: parts[0], noticeName: parts[1] };
    });
    
    // 取得作業標籤名稱
    const taskLabels = selectedTasks.map(k => {
        const task = db.tasks.find(t => t.id === k.taskId);
        if(!task) return '未知作業';
        let label = \`\${task.subject} - \${task.name}\`;
        if(k.noticeName) label += \` (\${k.noticeName})\`;
        return label;
    });

    let printHTML = \`
        <html>
        <head>
            <title>個人繳交狀況報表</title>
            <style>
                @page { size: A4; margin: 2cm; }
                body { font-family: 'Helvetica Neue', Arial, 'Microsoft JhengHei', sans-serif; margin: 0; padding: 0; color: #333; }
                .page { page-break-after: always; min-height: 25cm; position: relative; }
                .page:last-child { page-break-after: auto; }
                h1 { text-align: center; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
                .header-info { display: flex; justify-content: space-between; font-size: 14pt; font-weight: bold; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12pt; }
                th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
                th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
                .status-ok { color: #15803d; font-weight: bold; }
                .status-missing { color: #b91c1c; font-weight: bold; }
                .status-returned { color: #b45309; font-weight: bold; }
                .status-excused { color: #475569; font-weight: bold; }
                
                .summary-box { 
                    border: 2px solid #1e3a8a; 
                    border-radius: 8px; 
                    padding: 15px; 
                    background-color: #f8fafc;
                    display: flex;
                    justify-content: space-around;
                    text-align: center;
                }
                .summary-item { display: flex; flex-direction: column; }
                .summary-label { font-size: 11pt; color: #64748b; margin-bottom: 5px; }
                .summary-val { font-size: 20pt; font-weight: bold; color: #1e293b; }
                .val-missing { color: #b91c1c; }
                
                .footer { position: absolute; bottom: 0; width: 100%; text-align: center; font-size: 10pt; color: #94a3b8; }
                
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
    \`;

    selectedStudentIds.forEach(sId => {
        const student = db.students.find(s => s.id === sId);
        if (!student) return;

        let stats = { total: selectedTasks.length, submitted: 0, missing: 0, returned: 0, excused: 0 };
        let tableRows = '';

        selectedTasks.forEach((k, idx) => {
            const record = db.records.find(r => r.studentId === sId && r.taskId === k.taskId && r.noticeName === k.noticeName);
            
            // 判斷狀態
            // 預設為缺交 (因為只要勾選了該作業，表示預期要交)
            let displayStatus = '缺交';
            let statusClass = 'status-missing';
            
            if (record) {
                const manual = record.manualStatus;
                const sysStatus = record.status; // '已交' or undefined
                
                if (manual === '已交' || manual === '遲交' || (!manual && sysStatus === '已交')) {
                    displayStatus = manual || sysStatus;
                    statusClass = 'status-ok';
                    stats.submitted++;
                } else if (manual === '缺交' || manual === '未交') {
                    displayStatus = manual;
                    statusClass = 'status-missing';
                    stats.missing++;
                } else if (manual === '退回') {
                    displayStatus = '退回';
                    statusClass = 'status-returned';
                    stats.returned++;
                } else if (manual === '請假' || manual === '免交') {
                    displayStatus = manual;
                    statusClass = 'status-excused';
                    stats.excused++;
                } else {
                    displayStatus = '缺交';
                    statusClass = 'status-missing';
                    stats.missing++;
                }
            } else {
                stats.missing++;
            }

            tableRows += \`
                <tr>
                    <td style="width: 10%; text-align: center;">\${idx + 1}</td>
                    <td style="width: 60%;">\${taskLabels[idx]}</td>
                    <td style="width: 30%; text-align: center;" class="\${statusClass}">\${displayStatus}</td>
                </tr>
            \`;
        });

        // 取得班級資訊
        const school = db.classInfo?.schoolName || '';
        const className = db.classInfo?.className || '';
        const classStr = (school || className) ? \`\${school} \${className}\` : '個人繳交狀況報表';

        printHTML += \`
            <div class="page">
                <h1>個人繳交狀況報表</h1>
                <div class="header-info">
                    <span>\${classStr}</span>
                    <span>姓名：\${student.id} \${student.name}</span>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>項次</th>
                            <th>作業名稱</th>
                            <th style="text-align: center;">繳交狀態</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${tableRows}
                    </tbody>
                </table>
                
                <div class="summary-box">
                    <div class="summary-item">
                        <span class="summary-label">列入計算項目</span>
                        <span class="summary-val">\${stats.total}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">已交 / 遲交</span>
                        <span class="summary-val" style="color: #15803d;">\${stats.submitted}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">退回未補</span>
                        <span class="summary-val" style="color: #b45309;">\${stats.returned}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">請假 / 免交</span>
                        <span class="summary-val">\${stats.excused}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">缺交 / 未交</span>
                        <span class="summary-val val-missing">\${stats.missing}</span>
                    </div>
                </div>
                
                <div class="footer">
                    報表產出時間：\${new Date().toLocaleString('zh-TW')}
                </div>
            </div>
        \`;
    });

    printHTML += \`
        <script>
            window.onload = function() {
                window.print();
            }
        </script>
        </body>
        </html>
    \`;

    // 開啟新視窗
    const printWindow = window.open('', '_blank');
    if(printWindow) {
        printWindow.document.write(printHTML);
        printWindow.document.close();
    } else {
        alert("無法開啟列印視窗，請檢查是否被瀏覽器阻擋彈出視窗。");
    }
}
