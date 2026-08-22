
// ==========================================
// 缺交提醒單建立系統 (Tab 6)
// ==========================================

// 儲存目前正在操作提醒單的學生與勾選的作業
let currentReminderStudentId = null;
let currentReminderMissingTasks = [];

// 定義文案模組資料庫
const REMINDER_MODULES = {
    "1": {
        name: "模組一：依「缺交件數」提醒",
        states: [
            {
                value: "1-1", label: "狀態 1：缺交 1 項作業",
                sentences: [
                    "可能是孩子一時粗心遺漏了，再麻煩您今晚抽空提醒並陪伴他完成補交。",
                    "為了避免影響明日學習進度，請您今晚協助提醒孩子，並確認他順利完成。",
                    "只要今晚稍作補救就能跟上進度，麻煩您從旁協助，讓他養成負責的態度。",
                    "懇請您今晚撥冗陪孩子看過這項作業，給予適當的督促，協助他盡快完成。",
                    "孩子可能在作業上遇到小困難，請您今晚花幾分鐘關心，陪他一起克服。",
                    "麻煩您今晚提醒孩子將作業補齊，若有不懂的地方，請讓他知道可以問我們。",
                    "請您協助確認孩子今晚的作業進度，一點小提醒能幫助他建立更好的習慣。"
                ]
            },
            {
                value: "1-2", label: "狀態 2：缺交 2 項作業",
                sentences: [
                    "這兩項作業需要花點心思，請您今晚協助孩子分配時間，按部就班地完成。",
                    "缺交兩項作業容易讓孩子累積壓力，麻煩您今晚多陪伴他，一起釐清進度。",
                    "為了不讓作業繼續堆疊，請您今晚陪孩子規劃完成順序，給予他督促與協助。",
                    "兩項作業需要較好的時間管理，請您從旁引導，陪伴孩子逐一克服學習挑戰。",
                    "孩子可能在時間分配上遇到困難，再請您今晚從旁指導，陪他一起補齊作業。",
                    "麻煩您今晚多花點心思陪伴孩子，一步步完成這兩項作業，培養他的責任感。",
                    "請您協助孩子面對這兩項未完成的作業，今晚從旁督導，有問題隨時聯繫我。"
                ]
            },
            {
                value: "1-3", label: "狀態 3：缺交 3 項作業",
                sentences: [
                    "累積三項作業對孩子是不小的負擔，請您務必在旁陪伴，協助他化解焦慮感。",
                    "為了不讓孩子進度嚴重落後，懇請您今晚密切督促，陪著他一項一項慢慢補齊。",
                    "這三項作業需要您的強力支援，請帶著孩子安排順序，給予確實的陪伴與指導。",
                    "孩子面對這些作業可能感到無力，麻煩您今晚給予陪伴與具體的協助，幫他一把。",
                    "學習進度已經出現落後狀況，請您今晚務必撥冗陪伴孩子，幫助他找回步調。"
                ]
            },
            {
                value: "1-4", label: "狀態 4：缺交多項作業",
                sentences: [
                    "缺交情況較嚴重，孩子非常需要我們的幫助，請您今晚務必陪他釐清困難在哪。",
                    "累積的作業量需要我們共同正視，請您耐心陪伴，與孩子討論如何逐步解決。",
                    "為了避免孩子逃避學習，懇請您今晚放下手邊事物，專心陪伴他面對這些作業。",
                    "這是孩子急需引導的時刻，請您給予包容並強力督促，找出原因，我們隨時聯繫。",
                    "缺交多項代表孩子學習上遇到瓶頸，請您今晚務必深入了解，並陪他逐步補救。"
                ]
            }
        ]
    },
    "2": {
        name: "模組二：因「請假」缺交作業",
        states: [
            {
                value: "2-1", label: "狀態 1：請假 1 天 / 少量作業",
                sentences: [
                    "這是孩子請假期間的作業，麻煩您今晚協助提醒，讓他盡快跟上進度。",
                    "孩子因請假而需補交這項作業，請您今晚撥冗陪他完成，明日順利補齊。",
                    "這是昨日請假未完成的作業，只要今晚稍作補救，就能跟上學習腳步。",
                    "為了幫孩子補回請假進度，請您今晚督促他完成這項作業，謝謝協助。",
                    "請假期間的進度需要您的關心，麻煩今晚提醒孩子完成，有問題可提問。",
                    "孩子剛恢復上課，請您協助確認他今晚順利補完請假期間的這項作業。",
                    "這是請假當天的練習，再請您今晚從旁陪伴，協助他確實完成補交。"
                ]
            },
            {
                value: "2-2", label: "狀態 2：請假 2～3 天 / 中量作業",
                sentences: [
                    "請假幾天累積了些作業，請您今晚協助孩子分配時間，按部就班補齊。",
                    "孩子剛康復回校，請您今晚陪他規劃這幾項作業的進度，分段慢慢完成。",
                    "為了不讓請假的進度落後太多，麻煩您今晚陪孩子理清作業，逐一克服。",
                    "這幾項是請假期間的進度，需要您引導他安排時間，幫孩子找回步調。",
                    "懇請您與我合作，今晚先陪孩子處理部分請假作業，減輕他的補交壓力。",
                    "請假累積的作業需要花點心思，麻煩您今晚從旁督導，陪他一起完成。",
                    "孩子請假這幾天的作業都在這，請您協助他一步步完成，有困難隨時說。"
                ]
            },
            {
                value: "2-3", label: "狀態 3：請長假 / 大量作業",
                sentences: [
                    "孩子請長假累積了較多作業，請您務必在旁陪伴，協助他化解補交焦慮。",
                    "為了避免請假造成學習斷層，懇請您近日密切督促，陪他一項一項補。",
                    "這麼多請假作業需要您的支援，請帶著孩子安排優先順序，給予確實陪伴。",
                    "孩子面對大量補交作業可能感到無力，麻煩您今晚給予具體的協助與引導。",
                    "學習進度因請假有所落後，請您這幾天務必撥冗陪伴，幫他慢慢追回來。"
                ]
            },
            {
                value: "2-4", label: "狀態 4：復課後遲遲未補齊",
                sentences: [
                    "孩子復課多日，請假作業仍未補齊，請您今晚務必陪他釐清困難在哪裡。",
                    "這些請假作業已延宕數日，需要我們共同正視，請您耐心陪他逐步解決。",
                    "為了避免孩子對補交作業產生逃避，懇請您今晚專心陪伴他面對這些進度。",
                    "復課後遲未補交代表孩子遇到瓶頸，請您今晚務必深入了解，並陪他補救。"
                ]
            }
        ]
    },
    "3": {
        name: "模組三：漏寫 / 敷衍未完成 / 被退回重寫",
        states: [
            {
                value: "3-1", label: "單一狀態",
                sentences: [
                    "這項作業孩子只完成了一部分，麻煩您今晚協助檢查，督促他將漏寫處補齊。",
                    "孩子作業有部分漏寫，請您今晚撥冗陪他重新檢視，並確實完成剩餘內容。",
                    "作業內容有許多空白未填寫，請您今晚協助了解孩子是否遇到困難，陪同補齊。",
                    "為了確保學習品質，這項作業需要孩子再花時間補寫，麻煩您今晚從旁督導。",
                    "由於作業完成度不足被退回，懇請您今晚花些時間檢查，陪他確實補寫完畢。"
                ]
            }
        ]
    },
    "4": {
        name: "模組四：未訂正 / 漏簽名",
        states: [
            {
                value: "4-1", label: "單一狀態",
                sentences: [
                    "這是昨天發回需要訂正的作業，孩子尚未完成，請您今晚陪同他把錯誤訂正。",
                    "孩子未完成這項作業的錯題訂正，麻煩您今晚協助指導，讓他確實釐清觀念。",
                    "作業中的錯題尚未確實訂正，請您今晚花些時間陪他檢視，確認觀念都已學會。",
                    "為了讓孩子確實了解錯誤，請您今晚督促他完成訂正，並在作業上簽名確認。",
                    "孩子未完成作業訂正便繳回，請您今晚再次陪伴他檢視錯誤，確認後協助簽名。"
                ]
            }
        ]
    },
    "5": {
        name: "模組五：作業弄丟 / 破損遺失",
        states: [
            {
                value: "5-1", label: "單一狀態",
                sentences: [
                    "孩子表示作業不小心弄丟了，我已補發新的一份，請您今晚督促他重寫。",
                    "由於作業遺失，孩子需要重新完成這項進度，麻煩您今晚多給予耐心與陪伴。",
                    "處理作業遺失需要花更多時間，請您今晚協助安撫孩子情緒，陪他重新完成。",
                    "為了讓孩子學會保管個人物品，請您今晚叮嚀他小心收納，並將補發作業寫完。",
                    "孩子找不到這項作業，為避免進度落後已印製新講義，請您今晚陪他補齊進度。"
                ]
            }
        ]
    },
    "6": {
        name: "模組六：有寫但忘記帶 / 放在家裡",
        states: [
            {
                value: "6-1", label: "單一狀態",
                sentences: [
                    "孩子表示作業已寫但放在家裡，麻煩您今晚協助確認，並提醒他明日務必帶來。",
                    "孩子可能將作業遺留在書桌上，請您今晚陪他整理書包，確認明日帶到學校。",
                    "為了培養孩子自我管理的習慣，請您今晚陪他一起檢查書包，確認明日帶齊。",
                    "孩子表示有寫但找不到，請您今晚陪同整理書包與房間，確認作業的去向。",
                    "培養睡前收書包的習慣很重要，請您今晚陪孩子整理，確認明日將作業帶齊。",
                    "孩子說作業放在家裡忘了帶，請您今晚協助檢視，並叮嚀他明日記得繳交。"
                ]
            }
        ]
    },
    "7": {
        name: "模組七：依「無故缺交天數」提醒",
        states: [
            {
                value: "7-1", label: "狀態 A：遲交 2～3 天",
                sentences: [
                    "作業已遲交兩天，請您今晚務必關心孩子的學習狀況，督促他盡快補齊。",
                    "孩子連續幾天忘記帶作業，請您今晚陪他一起整理書包，確認作業完成。",
                    "為了不讓未交的作業越積越多，懇請您今晚務必盯緊孩子，將進度補上。",
                    "遲交幾天會影響孩子的學習記憶，麻煩您今晚督促他完成，把進度補回。",
                    "作業已超過繳交期限，請您協助了解孩子這兩天的狀況，並陪同他完成。",
                    "延遲交作業容易養成壞習慣，請您今晚嚴格督促，協助孩子盡速補齊。"
                ]
            },
            {
                value: "7-2", label: "狀態 B：遲交將近一週",
                sentences: [
                    "作業已缺交好幾天，累積量不少，請您今晚耐心陪孩子分段、逐步完成。",
                    "孩子這週多次未交作業，請您多關注，今晚務必陪他釐清未交原因。",
                    "延遲多日會讓孩子對作業產生逃避心理，請您今晚陪伴他一起面對解決。",
                    "缺交多日對孩子是個警訊，請您今晚務必協助孩子，陪他慢慢補起來。",
                    "作業拖延多日未交，需要我們共同重視，麻煩您今晚督導他按順序補齊。",
                    "孩子這幾天在時間管理上明顯遇到困難，請您從旁協助，督促他完成。"
                ]
            },
            {
                value: "7-3", label: "狀態 C：遲交超過一週",
                sentences: [
                    "作業缺交已達一週，情況堪憂，請您務必在旁強力督促，協助他化解難題。",
                    "孩子長期未交作業，學習恐現斷層，懇請您今晚深入了解並陪同補救。",
                    "已經超過一週未繳交，孩子非常需要您的介入引導，請陪他一起完成。",
                    "多日未交作業代表孩子遇到較大瓶頸，請您今晚耐心溝通，協助他面對。",
                    "長時間缺交會大幅降低學習動機，麻煩您今晚務必陪伴，帶他找回步調。",
                    "為了不讓孩子逃避學習，懇請您今晚放下手邊事物，專心陪他處理作業。"
                ]
            },
            {
                value: "7-4", label: "狀態 D：慣性/長期缺交",
                sentences: [
                    "孩子多日未交作業，情況需要親師深度合作，稍晚我將致電與您詳細討論。",
                    "多日缺交已成慣性，懇請您高度重視，協助檢視孩子在家的作息與時間。",
                    "孩子長期拖延作業，需要嚴格的規範與陪伴，請您今晚務必給予強力督導。",
                    "長期缺交對孩子影響甚鉅，懇請您今晚務必介入了解，我們一起討論對策。"
                ]
            }
        ]
    }
};

let currentSubjectFilter = '全部';

async function handleTab6Sync() {
    if (typeof syncFromGoogleSheets === 'function') {
        await syncFromGoogleSheets(false);
        renderReminderStats();
    } else {
        showAlert('提示', '同步模組尚未載入！');
    }
}

        window.reminderSearchQuery = '';
        function handleReminderSearch() {
            const input = document.getElementById('reminder-search-input');
            window.reminderSearchQuery = input ? input.value.trim().toLowerCase() : '';
            renderReminderStats();
        }

        function renderReminderStats() {
            const thead = document.getElementById('reminder-thead');
            const tbody = document.getElementById('reminder-tbody');
            const filterContainer = document.getElementById('reminder-subject-filters');
            const emptyMsg = document.getElementById('reminder-empty-msg');
            const showAllToggle = document.getElementById('reminder-show-all-toggle');
            const showAll = showAllToggle ? showAllToggle.checked : false;
            
            if(!thead || !tbody) return;

            // 取得並渲染科目篩選器
            const subjects = ['全部', ...new Set(db.tasks.map(t => t.subject).filter(Boolean))];
            
            // 生成篩選器 HTML
            let filterHtml = '';
            subjects.forEach(sub => {
                const activeClass = sub === currentSubjectFilter ? 'bg-purple-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50';
                filterHtml += `<button onclick="setReminderSubjectFilter('${sub}')" class="px-3 py-1 rounded-full border text-sm font-medium transition whitespace-nowrap ${activeClass}">${sub}</button>`;
            });
            filterContainer.innerHTML = filterHtml;

            // 找出符合條件的 Task + NoticeName
            let activeTasks = [];
            db.tasks.forEach(t => {
                if (currentSubjectFilter !== '全部' && t.subject !== currentSubjectFilter) return;
                
                const hasBaseRecords = db.records.some(r => r.taskId === t.id && !r.noticeName);
                const hasBaseRange = (db.ranges || []).some(r => r.taskId === t.id && !r.noticeName);
                if (hasBaseRecords || hasBaseRange) {
                    activeTasks.push({ taskId: t.id, noticeName: '', label: `${t.name}` });
                }
            });

            if (db.ranges) {
                db.ranges.forEach(r => {
                    if (r.noticeName) {
                        const t = db.tasks.find(t => t.id === r.taskId);
                        if (t && (currentSubjectFilter === '全部' || t.subject === currentSubjectFilter)) {
                            if (!activeTasks.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName)) {
                                activeTasks.push({ taskId: t.id, noticeName: r.noticeName, label: t.name + '-' + r.noticeName });
                            }
                        }
                    }
                });
            }

            // 預設將最新作業排序在最左邊 (反轉陣列)
            activeTasks.reverse();

            // 處理搜尋過濾
            const searchQ = window.reminderSearchQuery || '';
            let sortedStudents = [...db.students].sort((a,b) => a.id - b.id);
            
            if (searchQ) {
                // 檢查是否匹配作業
                const tasksMatchingSearch = activeTasks.filter(k => {
                    const taskDef = db.tasks.find(t=>t.id===k.taskId);
                    const createdDate = taskDef?.created || '';
                    return k.label.toLowerCase().includes(searchQ) || createdDate.includes(searchQ);
                });
                
                // 檢查是否匹配學生
                const studentsMatchingSearch = sortedStudents.filter(s => {
                    return s.id.toString().includes(searchQ) || s.name.toLowerCase().includes(searchQ);
                });

                // 智慧判斷邏輯
                if (tasksMatchingSearch.length > 0 && studentsMatchingSearch.length === 0) {
                    // 只匹配到作業：過濾作業欄位，保留所有學生
                    activeTasks = tasksMatchingSearch;
                } else if (tasksMatchingSearch.length === 0 && studentsMatchingSearch.length > 0) {
                    // 只匹配到學生：過濾學生，保留所有作業欄位
                    sortedStudents = studentsMatchingSearch;
                } else if (tasksMatchingSearch.length > 0 && studentsMatchingSearch.length > 0) {
                    // 兩者皆有匹配：雙重過濾
                    activeTasks = tasksMatchingSearch;
                    sortedStudents = studentsMatchingSearch;
                } else {
                    // 兩者皆不匹配：清空
                    activeTasks = [];
                    sortedStudents = [];
                }
            }

            // 預先計算每個 task 的全班缺交數
            const taskMissingCounts = new Map();
            
            activeTasks.forEach(task => {
                let missing = 0;
                sortedStudents.forEach(student => {
                    const range = (db.ranges || []).find(r => r.taskId === task.taskId && r.noticeName === task.noticeName);
                    let shouldSubmit = true;
                    if (range && range.type === 'specific') {
                        shouldSubmit = range.students.includes(student.id);
                    }
                    if (shouldSubmit) {
                        const isSubmitted = db.records.some(r => r.taskId === task.taskId && r.noticeName === task.noticeName && r.studentId === student.id);
                        if (!isSubmitted) missing++;
                    }
                });
                taskMissingCounts.set(task.taskId + ':::' + task.noticeName, missing);
            });

            // 隱藏大家都交齊的作業 (除非開啟顯示)
            if (!showAll) {
                activeTasks = activeTasks.filter(task => {
                    return taskMissingCounts.get(task.taskId + ':::' + task.noticeName) > 0;
                });
            }
    
    // 如果沒有作業，顯示提示
    if (activeTasks.length === 0) {
        emptyMsg.classList.remove('hidden');
        thead.parentElement.classList.add('hidden');
        return;
    } else {
        emptyMsg.classList.add('hidden');
        thead.parentElement.classList.remove('hidden');
    }

    // 產生 Header
    let theadHtml = `<tr><th class="px-4 py-2 font-bold text-gray-700 sticky left-0 bg-gray-100 z-10 w-24 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">學生</th>`;
    activeTasks.forEach(t => {
        theadHtml += `<th class="px-2 py-2 font-bold text-gray-700 font-mono text-xs max-w-[100px] overflow-hidden text-ellipsis" title="${t.label}">${t.label}</th>`;
    });
    theadHtml += `</tr>`;
    thead.innerHTML = theadHtml;

    // 產生 Body
    let tbodyHtml = '';
    
    sortedStudents.forEach(student => {
        let missingCount = 0;
        let cellHtml = '';
        
        activeTasks.forEach(task => {
            const range = (db.ranges || []).find(r => r.taskId === task.taskId && r.noticeName === task.noticeName);
            let shouldSubmit = true;
            if (range && range.type === 'specific') {
                shouldSubmit = range.students.includes(student.id);
            }
            
            if (shouldSubmit) {
                const isSubmitted = db.records.some(r => r.taskId === task.taskId && r.noticeName === task.noticeName && r.studentId === student.id);
                if (isSubmitted) {
                    cellHtml += `<td class="px-2 py-2 text-green-600 font-bold border-l border-gray-50">✓</td>`;
                } else {
                    missingCount++;
                    cellHtml += `<td class="px-2 py-2 text-red-500 font-bold bg-red-50 border-l border-red-100">缺</td>`;
                }
            } else {
                cellHtml += `<td class="px-2 py-2 text-gray-300 border-l border-gray-50">-</td>`;
            }
        });

        // 隱藏全勤學生 (除非開啟顯示)
        if (!showAll && missingCount === 0) return;

        // 姓名欄位樣式
        const nameClass = missingCount > 0 
            ? "cursor-pointer font-bold text-red-600 hover:text-red-800 hover:bg-red-50 transition sticky left-0 bg-white border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-10" 
            : "cursor-pointer font-bold text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition sticky left-0 bg-white border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-10";
        const badge = missingCount > 0 ? `<span class="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">${missingCount}</span>` : '';

        tbodyHtml += `
            <tr class="hover:bg-gray-50 border-b">
                <td class="px-4 py-2 ${nameClass}" onclick="openReminderModal(${student.id})">
                    <div class="flex items-center justify-center">
                        ${student.id}. ${student.name} ${badge}
                    </div>
                </td>
                ${cellHtml}
            </tr>
        `;
    });
    
    tbody.innerHTML = tbodyHtml;
}

function setReminderSubjectFilter(subject) {
    currentSubjectFilter = subject;
    renderReminderStats();
}

function openReminderModal(studentId) {
    currentReminderStudentId = studentId;
    const student = db.students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('reminder-student-name').textContent = `${student.id}. ${student.name}`;
    
    // 找出所有缺交作業 (忽略篩選，全部列出)
    currentReminderMissingTasks = [];
    
    // 收集所有有效作業
    let allValidTasks = [];
    db.tasks.forEach(t => {
        const hasBaseRecords = db.records.some(r => r.taskId === t.id && !r.noticeName);
        const hasBaseRange = (db.ranges || []).some(r => r.taskId === t.id && !r.noticeName);
        if (hasBaseRecords || hasBaseRange) {
            allValidTasks.push({ taskId: t.id, noticeName: '', label: `${t.name}` });
        }
    });
    if (db.ranges) {
        db.ranges.forEach(r => {
            if (r.noticeName) {
                const t = db.tasks.find(t => t.id === r.taskId);
                if (t && !allValidTasks.find(k => k.taskId === r.taskId && k.noticeName === r.noticeName)) {
                    allValidTasks.push({ taskId: t.id, noticeName: r.noticeName, label: t.name + '-' + r.noticeName });
                }
            }
        });
    }

    // 過濾缺交
    allValidTasks.forEach(task => {
        const range = (db.ranges || []).find(r => r.taskId === task.taskId && r.noticeName === task.noticeName);
        let shouldSubmit = true;
        if (range && range.type === 'specific') {
            shouldSubmit = range.students.includes(student.id);
        }
        if (shouldSubmit) {
            const isSubmitted = db.records.some(r => r.taskId === task.taskId && r.noticeName === task.noticeName && r.studentId === student.id);
            if (!isSubmitted) {
                currentReminderMissingTasks.push(task);
            }
        }
    });

    // 渲染 Checkbox 列表
    const taskListDiv = document.getElementById('reminder-task-list');
    if (currentReminderMissingTasks.length === 0) {
        taskListDiv.innerHTML = '<div class="text-green-600 p-2 font-bold flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> 此學生目前沒有任何缺交/沒帶作業。</div>';
    } else {
        let html = '';
        currentReminderMissingTasks.forEach((task, idx) => {
            const id = `rem-task-${idx}`;
            html += `
                <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input type="checkbox" id="${id}" value="${idx}" checked onchange="autoSelectReminderState(); generateReminderText()" class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500">
                    <span class="text-gray-800 text-sm font-medium">${task.label}</span>
                </label>
            `;
        });
        taskListDiv.innerHTML = html;
    }

    // 預設日期為今天
    const today = new Date();
    const dateStr = `${today.getMonth()+1}/${today.getDate()} (${['日','一','二','三','四','五','六'][today.getDay()]})`;
    document.getElementById('reminder-date-input').value = dateStr;

    // 預設模組 1，並根據缺交數量自動選擇狀態
    document.getElementById('reminder-module-select').value = "1";
    onReminderModuleChange(); // 會聯動呼叫 autoSelectReminderState 和 generateReminderText
    
    // 顯示 Modal
    document.getElementById('reminder-modal').style.display = 'flex';
}

function closeReminderModal() {
    document.getElementById('reminder-modal').style.display = 'none';
}

function onReminderModuleChange() {
    const moduleId = document.getElementById('reminder-module-select').value;
    const stateSelect = document.getElementById('reminder-state-select');
    const module = REMINDER_MODULES[moduleId];
    
    if (!module) return;

    let html = '';
    module.states.forEach(state => {
        html += `<option value="${state.value}">${state.label}</option>`;
    });
    stateSelect.innerHTML = html;

    autoSelectReminderState();
    generateReminderText();
}

function autoSelectReminderState() {
    const moduleId = document.getElementById('reminder-module-select').value;
    const stateSelect = document.getElementById('reminder-state-select');
    
    // 取得目前勾選的作業數量
    let checkedCount = 0;
    if (currentReminderMissingTasks && currentReminderMissingTasks.length > 0) {
        currentReminderMissingTasks.forEach((t, idx) => {
            const cb = document.getElementById(`rem-task-${idx}`);
            if(cb && cb.checked) checkedCount++;
        });
    }

    if (moduleId === "1") {
        if (checkedCount === 1) stateSelect.value = "1-1";
        else if (checkedCount === 2) stateSelect.value = "1-2";
        else if (checkedCount === 3) stateSelect.value = "1-3";
        else if (checkedCount >= 4) stateSelect.value = "1-4";
    }
}

function generateReminderText(forceRandom = false) {
    if (!currentReminderStudentId) return;
    const student = db.students.find(s => s.id === currentReminderStudentId);
    if (!student) return;

    // 取得勾選的作業
    const selectedTaskLabels = [];
    if (currentReminderMissingTasks && currentReminderMissingTasks.length > 0) {
        currentReminderMissingTasks.forEach((t, idx) => {
            const cb = document.getElementById(`rem-task-${idx}`);
            if(cb && cb.checked) selectedTaskLabels.push(t.label);
        });
    }

    const taskListStr = selectedTaskLabels.length > 0 ? selectedTaskLabels.join('、') : "(無勾選任何作業)";
    const dateStr = document.getElementById('reminder-date-input').value.trim() || '今天';
    
    const moduleId = document.getElementById('reminder-module-select').value;
    const stateId = document.getElementById('reminder-state-select').value;
    const module = REMINDER_MODULES[moduleId];
    let sentence = "";

    if (module) {
        const state = module.states.find(s => s.value === stateId);
        if (state && state.sentences.length > 0) {
            // 從可用句子中隨機挑選
            // 為避免每次按 Checkbox 都跳動，我們可以把選擇存在 data attribute 或使用固定的 random seed。
            // 但如果 user 點擊了 "換句話說 (forceRandom)" 就強制換句。
            const textarea = document.getElementById('reminder-preview-text');
            const previousSentenceIndex = textarea.dataset.sentenceIdx ? parseInt(textarea.dataset.sentenceIdx) : -1;
            const previousStateId = textarea.dataset.stateId;

            let nextIdx = 0;
            if (forceRandom) {
                // 排除當前句
                const available = state.sentences.map((_, i) => i).filter(i => i !== previousSentenceIndex);
                nextIdx = available[Math.floor(Math.random() * available.length)] || 0;
            } else {
                // 如果 state 沒變，保持同一句
                if (previousStateId === stateId && previousSentenceIndex >= 0 && previousSentenceIndex < state.sentences.length) {
                    nextIdx = previousSentenceIndex;
                } else {
                    nextIdx = Math.floor(Math.random() * state.sentences.length);
                }
            }

            sentence = state.sentences[nextIdx];
            textarea.dataset.sentenceIdx = nextIdx;
            textarea.dataset.stateId = stateId;
        }
    }

    const template = `${student.name} 媽媽/爸爸您好，${student.name} ${dateStr} 應繳交的作業：【${taskListStr}】尚未補繳。${sentence}`;
    
    const textarea = document.getElementById('reminder-preview-text');
    textarea.value = template;
    // Auto-resize
    setTimeout(() => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }, 0);
}

function copyReminderText() {
    const text = document.getElementById('reminder-preview-text').value;
    navigator.clipboard.writeText(text).then(() => {
        if(typeof showUndoToast === 'function') {
            // 借用 Toast 系統顯示複製成功
            showUndoToast('✅ 已複製提醒單內容！可直接貼至 Line');
            // 隱藏復原按鈕
            setTimeout(() => {
                const btn = document.querySelector('#undo-toast button');
                if (btn) btn.style.display = 'none';
            }, 10);
        } else {
            showAlert('提示', '已複製到剪貼簿！');
        }
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showAlert('提示', '複製失敗，請手動全選複製。');
    });
}
