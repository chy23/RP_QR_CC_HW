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
        label.innerHTML = `
            <input type="checkbox" class="report-student-cb rounded text-amber-600 focus:ring-amber-500" value="${s.id}" checked>
            <span class="truncate">${s.id} ${s.name}</span>
        `;
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

    let html = '';
    db.tasks.forEach(t => {
        const typeStr = t.type === 'fixed' ? '[固]' : '[浮]';
        html += `
            <label class="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer border-b last:border-b-0 border-gray-100">
                <input type="checkbox" value="${t.id}" class="report-task-cb w-4 h-4 text-amber-600 rounded focus:ring-amber-500" data-subject="${t.subject}" data-type="${t.type}">
                <span class="text-gray-700">${typeStr} [${t.subject}] ${t.name}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

function selectFixedTasksReport() {
    document.querySelectorAll('.report-task-cb').forEach(cb => {
        if (cb.dataset.type === 'fixed') cb.checked = true;
    });
}

function selectFloatingTasksReport() {
    document.querySelectorAll('.report-task-cb').forEach(cb => {
        if (cb.dataset.type === 'floating') cb.checked = true;
    });
}

function selectSubjectTasksReport(subject) {
    document.querySelectorAll('.report-task-cb').forEach(cb => {
        if (cb.dataset.subject === subject) cb.checked = true;
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

    let selectedTasks = [];
    selectedTaskVals.forEach(tid => {
        const t = db.tasks.find(x => x.id === tid);
        if (!t) return;
        
        let noticeNames = [...new Set(db.records.filter(r => r.taskId === tid).map(r => r.noticeName || ''))];
        // Also check ranges to see if there are instances that have no records yet
        if (db.ranges) {
            const rangeNotices = db.ranges.filter(r => r.taskId === tid).map(r => r.noticeName || '');
            rangeNotices.forEach(rn => {
                if (!noticeNames.includes(rn)) noticeNames.push(rn);
            });
        }
        
        if (noticeNames.length === 0) {
            selectedTasks.push({ taskId: tid, noticeName: '', label: `${t.subject} - ${t.name}` });
        } else {
            // Sort noticeNames alphabetically
            noticeNames.sort();
            noticeNames.forEach(nn => {
                let label = `${t.subject} - ${t.name}`;
                if (nn) label += ` (${nn})`;
                selectedTasks.push({ taskId: tid, noticeName: nn, label: label });
            });
        }
    });

    const taskLabels = selectedTasks.map(k => k.label);

let printHTML = `
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
    `;

    selectedStudentIds.forEach(sId => {
        const student = db.students.find(s => s.id === parseInt(sId));
        if (!student) return;

        let stats = { total: selectedTasks.length, submitted: 0, missing: 0, returned: 0, excused: 0 };
        let tableRows = '';

        selectedTasks.forEach((k, idx) => {
            const record = db.records.find(r => r.studentId === parseInt(sId) && r.taskId === k.taskId && (r.noticeName || "") === (k.noticeName || ""));
            
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

            tableRows += `
                <tr>
                    <td style="width: 10%; text-align: center;">${idx + 1}</td>
                    <td style="width: 60%;">${taskLabels[idx]}</td>
                    <td style="width: 30%; text-align: center;" class="${statusClass}">${displayStatus}</td>
                </tr>
            `;
        });

        // 取得班級資訊
        const school = db.classInfo?.schoolName || '';
        const className = db.classInfo?.className || '';
        const classStr = (school || className) ? `${school} ${className}` : '個人繳交狀況報表';

        printHTML += `
            <div class="page">
                <h1>個人繳交狀況報表</h1>
                <div class="header-info">
                    <span>${classStr}</span>
                    <span>姓名：${student.id} ${student.name}</span>
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
                        ${tableRows}
                    </tbody>
                </table>
                
                <div class="summary-box">
                    <div class="summary-item">
                        <span class="summary-label">列入計算項目</span>
                        <span class="summary-val">${stats.total}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">已交 / 遲交</span>
                        <span class="summary-val" style="color: #15803d;">${stats.submitted} <span style="font-size:12pt; color:#64748b;">(${stats.total>0 ? Math.round(stats.submitted/stats.total*100) : 0}%)</span></span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">退回未補</span>
                        <span class="summary-val" style="color: #b45309;">${stats.returned}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">請假 / 免交</span>
                        <span class="summary-val">${stats.excused}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">缺交 / 未交</span>
                        <span class="summary-val val-missing">${stats.missing} <span style="font-size:12pt; color:#64748b;">(${stats.total>0 ? Math.round(stats.missing/stats.total*100) : 0}%)</span></span>
                    </div>
                </div>
                
                <div class="footer">
                    報表產出時間：${new Date().toLocaleString('zh-TW')}
                </div>
            </div>
        `;
    });

    printHTML += `
        </body>
        </html>
    `;

    // 注入 iframe
    const container = document.getElementById('report-preview-container');
    const iframe = document.getElementById('report-preview-iframe');
    const btn = document.getElementById('btn-print-report');
    
    if(container && iframe && btn) {
        container.classList.remove('hidden');
        btn.classList.remove('hidden');
        
        iframe.srcdoc = printHTML;
    }
}

function printReportIframe() {
    const iframe = document.getElementById('report-preview-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }
}

