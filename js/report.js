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
        label.className = 'w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5 flex items-center gap-2 p-1 hover:bg-gray-100 rounded cursor-pointer';
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

    const grouped = {};
    db.tasks.forEach(t => {
        if (!grouped[t.subject]) grouped[t.subject] = [];
        grouped[t.subject].push(t);
    });

    let html = '';
    for (const [subject, tasks] of Object.entries(grouped)) {
        const accId = 'report-acc-' + subject;
        html += `
            <div class="border rounded mb-2 overflow-hidden">
                <button type="button" onclick="toggleAccordion('${accId}')" class="w-full text-left px-4 py-2 bg-amber-50 hover:bg-amber-100 font-bold text-amber-800 flex justify-between items-center border-b border-amber-200">
                    <span>${subject} <span class="text-xs font-normal text-amber-600">(${tasks.length})</span></span>
                    <svg id="${accId}-icon" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div id="${accId}" class="hidden flex-col bg-white">
                    ${tasks.map(t => {
                        const typeStr = t.type === 'fixed' ? '[固]' : '[浮]';
                        return `
                        <label class="flex items-center space-x-2 px-4 py-2 hover:bg-gray-50 rounded-none cursor-pointer border-b last:border-b-0 border-gray-100">
                            <input type="checkbox" value="${t.id}" class="report-task-cb w-4 h-4 text-amber-600 rounded focus:ring-amber-500" data-subject="${t.subject}" data-type="${t.type}">
                            <span class="text-sm text-gray-700">${typeStr} ${t.name}</span>
                        </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function selectFixedTasksReport() {
    const cbs = Array.from(document.querySelectorAll('.report-task-cb')).filter(cb => cb.dataset.type === 'fixed');
    if(cbs.length === 0) return;
    const allChecked = cbs.every(cb => cb.checked);
    cbs.forEach(cb => cb.checked = !allChecked);
}

function selectFloatingTasksReport() {
    const cbs = Array.from(document.querySelectorAll('.report-task-cb')).filter(cb => cb.dataset.type === 'floating');
    if(cbs.length === 0) return;
    const allChecked = cbs.every(cb => cb.checked);
    cbs.forEach(cb => cb.checked = !allChecked);
}

function selectSubjectTasksReport(subject) {
    const cbs = Array.from(document.querySelectorAll('.report-task-cb')).filter(cb => cb.dataset.subject === subject);
    if(cbs.length === 0) return;
    const allChecked = cbs.every(cb => cb.checked);
    cbs.forEach(cb => cb.checked = !allChecked);
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
        showAlert('提示', "請至少選擇一位學生！");
        return;
    }
    if (selectedTaskVals.length === 0) {
        showAlert('提示', "請至少選擇一項作業！");
        return;
    }


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

        let stats = { total: 0, submitted: 0, missing: 0, returned: 0, excused: 0, late: 0 };
        let tableRows = '';

        selectedTaskVals.forEach((tid, idx) => {
            const t = db.tasks.find(x => x.id === tid);
            if (!t) return;
            
            // Find all noticeNames for this taskId
            let noticeNames = [...new Set(db.records.filter(r => r.taskId === tid).map(r => r.noticeName || ''))];
            if (db.ranges) {
                const rangeNotices = db.ranges.filter(r => r.taskId === tid).map(r => r.noticeName || '');
                rangeNotices.forEach(rn => {
                    if (!noticeNames.includes(rn)) noticeNames.push(rn);
                });
            }
            if (noticeNames.length === 0) noticeNames = [''];
            
            noticeNames.sort();
            
            let rowTotal = noticeNames.length;
            let rowSubmitted = 0;
            let rowLate = 0;
            let rowMissing = 0;
            let rowReturned = 0;
            let rowExcused = 0;
            let missingDetails = [];
            
            noticeNames.forEach(nn => {
                stats.total++;
                const record = db.records.find(r => r.studentId === parseInt(sId) && r.taskId === tid && (r.noticeName || "") === nn);
                
                let isMissing = true;
                
                if (record) {
                    const manual = record.manualStatus;
                    const leaves = ["事假", "病假", "公假", "喪假", "曠課", "遲到", "其他", "免交", "請假"];
                    
                    if (!manual || manual === '已交' || manual === 'ontime') {
                        rowSubmitted++;
                        stats.submitted++;
                        isMissing = false;
                    } else if (manual === '遲交' || manual === 'late') {
                        rowLate++;
                        stats.late++;
                        isMissing = false;
                    } else if (manual === '退回') {
                        rowReturned++;
                        stats.returned++;
                        // Not missing, but returned. Some might consider it missing, but we categorize it differently.
                        isMissing = false; 
                    } else if (leaves.includes(manual)) {
                        rowExcused++;
                        stats.excused++;
                        isMissing = false;
                    } else if (manual === '缺交' || manual === '未交' || manual === 'missing') {
                        rowMissing++;
                        stats.missing++;
                    } else {
                        rowSubmitted++;
                        stats.submitted++;
                        isMissing = false;
                    }
                } else {
                    rowMissing++;
                    stats.missing++;
                }
                
                if (isMissing) {
                    missingDetails.push(nn || '無範圍');
                }
            });
            
            const submitRate = rowTotal > 0 ? Math.round(((rowSubmitted + rowLate) / rowTotal) * 100) : 0;
            const missingRate = rowTotal > 0 ? Math.round((rowMissing / rowTotal) * 100) : 0;
            
            const missingText = missingDetails.length > 0 ? missingDetails.join(', ') : '-';
            
            tableRows += `
                <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td>${t.subject} - ${t.name}</td>
                    <td class="text-center">${rowTotal}</td>
                    <td class="text-center text-green-700 font-bold">${rowSubmitted}</td>
                    <td class="text-center text-yellow-600">${rowLate}</td>
                    <td class="text-center text-red-700 font-bold">${rowMissing}</td>
                    <td class="text-center font-bold">${submitRate}%</td>
                    <td class="text-red-600 text-sm">${missingText}</td>
                </tr>
            `;
        });

        printHTML += `
            <div class="page">
                <h1>個人繳交狀況報表</h1>
                <div class="header-info">
                    <span>${(db.classInfo && db.classInfo.schoolName) || ""} ${(db.classInfo && db.classInfo.academicYear) ? db.classInfo.academicYear + "學年" : ""} ${(db.classInfo && db.classInfo.semester) || ""} ${(db.classInfo && db.classInfo.className) || ""}</span>
                    <span>姓名：${student.id} ${student.name}</span>
                </div>
                
                <table style="text-align: center;">
                    <thead>
                        <tr>
                            <th class="text-center">項次</th>
                            <th class="text-center">作業項目</th>
                            <th class="text-center">應交</th>
                            <th class="text-center">已交</th>
                            <th class="text-center">遲交</th>
                            <th class="text-center">缺交</th>
                            <th class="text-center">繳交率</th>
                            <th class="text-left">缺交明細</th>
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
                        <span class="summary-val" style="color: #15803d;">${stats.submitted + stats.late} <span style="font-size:12pt; color:#64748b;">(${stats.total>0 ? Math.round((stats.submitted+stats.late)/stats.total*100) : 0}%)</span></span>
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

