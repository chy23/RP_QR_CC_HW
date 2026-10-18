        // ==========================================
        // 匯出功能與 PDF 預覽
        // ==========================================
        
        let pdfPreviewOriginalWidth = 595.28;
        let pdfPreviewOriginalHeight = 841.89;
        let previewScale = 1;

        let pdfDocumentGlobal = null;
        async function renderPdfPreview() {
            const fileInput = document.getElementById('tab3-pdf-upload');
            if(!fileInput.files.length) return;
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                pdfDocumentGlobal = pdf;
                
                // Update page selector
                const pageSelect = document.getElementById('tab3-page');
                pageSelect.innerHTML = '<option value="all">所有頁面</option>';
                for(let i=1; i<=pdf.numPages; i++) {
                    pageSelect.innerHTML += `<option value="${i}">第 ${i} 頁</option>`;
                }
                
                const container = document.getElementById('pdf-preview-container');
                container.style.display = 'block';
                // We use a scrollable inner container if there are multiple pages
                container.style.maxHeight = '600px';
                container.style.overflowY = 'auto';
                container.style.overflowX = 'hidden';
                
                // Create a canvas for each page
                const existingCanvases = container.querySelectorAll('canvas:not(#pdf-preview-canvas)');
                existingCanvases.forEach(c => c.remove());
                
                const page1 = await pdf.getPage(1);
                const viewport = page1.getViewport({scale: 1.0});
                pdfPreviewOriginalWidth = viewport.width;
                pdfPreviewOriginalHeight = viewport.height;
                previewScale = (container.clientWidth - 20) / viewport.width; // leave some space for scrollbar
                
                for(let i=1; i<=pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const scaledViewport = page.getViewport({scale: previewScale});
                    
                    let canvas;
                    if(i === 1) {
                        canvas = document.getElementById('pdf-preview-canvas');
                    } else {
                        canvas = document.createElement('canvas');
                        canvas.style.display = 'block';
                        canvas.style.marginBottom = '10px';
                        container.insertBefore(canvas, document.getElementById('draggable-box').nextSibling);
                    }
                    
                    canvas.width = scaledViewport.width;
                    canvas.height = scaledViewport.height;
                    const context = canvas.getContext('2d');
                    await page.render({canvasContext: context, viewport: scaledViewport}).promise;
                }
                
                setupDraggableBox();
                updatePreviewBox();
                hideLoading();
            };
            showLoading();
            fileReader.readAsArrayBuffer(fileInput.files[0]);
        }

        
        function applyAnchor() {
            const anchor = document.getElementById('tab3-anchor').value;
            if (anchor === 'custom') return;
            
            // A4 pdf size is ~ 595.28 x 841.89 points
            // 1 cm = 28.346 points
            const cmToPt = 28.346;
            const wCm = parseFloat(document.getElementById('tab3-size').value) || 7;
            const hCm = wCm * 1.1;
            
            const wPt = wCm * cmToPt;
            const hPt = hCm * cmToPt;
            const marginCm = 1; 
            const marginPt = marginCm * cmToPt;
            const a4WPt = 595.28;
            const a4HPt = 841.89;
            
            let xPt = marginPt;
            let yPt = marginPt;
            
            if (anchor === 'tl') {
                xPt = marginPt;
                yPt = a4HPt - marginPt - hPt;
            } else if (anchor === 'tr') {
                xPt = a4WPt - marginPt - wPt;
                yPt = a4HPt - marginPt - hPt;
            } else if (anchor === 'bl') {
                xPt = marginPt;
                yPt = marginPt;
            } else if (anchor === 'br') {
                xPt = a4WPt - marginPt - wPt;
                yPt = marginPt;
            }
            
            document.getElementById('tab3-x').value = (xPt / cmToPt).toFixed(1);
            document.getElementById('tab3-y').value = (yPt / cmToPt).toFixed(1);
            updatePreviewBox();
        }

        function updatePreviewBox() {
            const cmToPt = 28.346;
            const xCm = parseFloat(document.getElementById('tab3-x').value) || 0;
            const yCm = parseFloat(document.getElementById('tab3-y').value) || 0;
            const wCm = parseFloat(document.getElementById('tab3-size').value) || 7;
            const hCm = wCm * 1.1;
            
            const xPt = xCm * cmToPt;
            const yPt = yCm * cmToPt;
            const wPt = wCm * cmToPt;
            const hPt = hCm * cmToPt;
            
            const box = document.getElementById('qr-preview-box');
            box.style.width = (wPt * previewScale) + 'px';
            box.style.height = (hPt * previewScale) + 'px';
            box.style.left = (xPt * previewScale) + 'px';
            box.style.top = ((pdfPreviewOriginalHeight - yPt - hPt) * previewScale) + 'px';
        }

        function setupDraggableBox() {
            const box = document.getElementById('qr-preview-box');
            let isDragging = false;
            let startX, startY;
            
            box.onmousedown = function(e) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                e.preventDefault();
            };
            
            document.onmousemove = function(e) {
                if(!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                startX = e.clientX;
                startY = e.clientY;
                
                const currentLeft = parseFloat(box.style.left) || 0;
                const currentTop = parseFloat(box.style.top) || 0;
                
                box.style.left = (currentLeft + dx) + 'px';
                box.style.top = (currentTop + dy) + 'px';
                
                const cmToPt = 28.346;
                const wCm = parseFloat(document.getElementById('tab3-size').value) || 7;
                const hCm = wCm * 1.1;
                const wPt = wCm * cmToPt;
                const hPt = hCm * cmToPt;
                
                const newXPt = (currentLeft + dx) / previewScale;
                const newYPt = pdfPreviewOriginalHeight - ((currentTop + dy) / previewScale) - hPt;
                
                document.getElementById('tab3-x').value = (newXPt / cmToPt).toFixed(1);
                document.getElementById('tab3-y').value = (newYPt / cmToPt).toFixed(1);
                document.getElementById('tab3-anchor').value = 'custom';
            };
            
            document.onmouseup = function() {
                isDragging = false;
            };
        }

        
        async function createLabelImage(student, task, noticeName = '', isSimplified = false, customW = 600, customH = 400) {
            const canvas = document.createElement('canvas');
            canvas.width = customW;
            canvas.height = customH;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            const qrText = getQRText(student, task, noticeName);
            // QR occupies most of the height
            const margin = customH * 0.05;
            const qrSize = customH - (margin * 2);
            
            const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: qrSize, errorCorrectionLevel: 'L', color: { dark: '#000000', light: '#ffffff' } });
            
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, margin, margin, qrSize, qrSize);
                    
                    const textX = margin + qrSize + (customW * 0.05);
                    ctx.fillStyle = '#000000';
                    ctx.textBaseline = 'top';
                    
                    const maxTextWidth = customW - textX - margin;
                    
                    // Name
                    ctx.font = `bold ${customH * 0.22}px sans-serif`;
                    ctx.fillText(student.name, textX, margin + (customH * 0.05), maxTextWidth);
                    
                    // Seat
                    ctx.font = `${customH * 0.18}px monospace`;
                    ctx.fillText(`座號: ${student.id}`, textX, margin + (customH * 0.35), maxTextWidth);
                    
                    // Task Name
                    ctx.font = `${customH * 0.18}px sans-serif`;
                    const taskStr = isSimplified ? task.name : `[${task.subject}] ${task.name}`;
                    ctx.fillText(taskStr, textX, margin + (customH * 0.65), maxTextWidth);
                    
                    if (!isSimplified && noticeName) {
                        ctx.fillStyle = '#b91c1c';
                        ctx.fillText(noticeName, textX, margin + (customH * 0.85), maxTextWidth);
                    }
                    
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = qrDataUrl;
            });
        }

        async function createFloatingLabelImage(student, task, noticeName = '', customW = 400) {
            // Square-ish shape: Top text, bottom QR
            const customH = customW * 1.1; // Slightly taller than wide
            const canvas = document.createElement('canvas');
            canvas.width = customW;
            canvas.height = customH;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Optional border for floating
            ctx.strokeStyle = '#aaaaaa';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            // Draw text at top
            const margin = customW * 0.05;
            ctx.fillStyle = '#000000';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${customW * 0.12}px sans-serif`;
            ctx.fillText(student.name, margin, margin);
            
            ctx.font = `${customW * 0.1}px monospace`;
            ctx.fillText(`座號:${student.id}`, customW * 0.5, margin);

            // Draw QR below text
            const qrText = getQRText(student, task, noticeName);
            const qrStartY = customW * 0.2;
            const qrSize = customW - (margin * 2);
            
            const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: qrSize, errorCorrectionLevel: 'L', color: { dark: '#000000', light: '#ffffff' } });
            
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, margin, qrStartY, qrSize, qrSize);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = qrDataUrl;
            });
        }

        async function generateFloatingPDF() {
            const select = document.getElementById('tab3-task-select');
            if(!select.value) { showAlert('提示', '請先選擇浮動作/通知單'); return; }
            const task = db.tasks.find(t => t.id === select.value);
            let noticeName = document.getElementById('tab3-notice-name').value.trim();

            const fileInput = document.getElementById('tab3-pdf-upload');
            if(fileInput.files.length === 0) { showAlert('提示', '請先上傳底板 PDF'); return; }

            const pagesKeep = document.getElementById('tab3-pages-keep').value.trim();
            const targetPage = document.getElementById('tab3-page') ? document.getElementById('tab3-page').value : 'all';

            const cmToPt = 28.346;
            const qrX = (parseFloat(document.getElementById('tab3-x').value) || 1) * cmToPt;
            const qrY = (parseFloat(document.getElementById('tab3-y').value) || 1) * cmToPt;
            const qrSize = (parseFloat(document.getElementById('tab3-size').value) || 4) * cmToPt;

            showLoading();
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                try {
                    const originalPdfBytes = new Uint8Array(this.result);
                    const mergedPdf = await PDFLib.PDFDocument.create();

                    for (const student of db.students) {
                        const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
                        const pages = pdfDoc.getPages();
                        
                        let keepIndices = [];
                        if (pagesKeep) {
                            const parts = pagesKeep.split(',');
                            parts.forEach(p => {
                                if(p.includes('-')) {
                                    const [s, e] = p.split('-');
                                    for(let i = parseInt(s)-1; i <= parseInt(e)-1; i++) keepIndices.push(i);
                                } else {
                                    keepIndices.push(parseInt(p)-1);
                                }
                            });
                        } else {
                            keepIndices = pages.map((_, i) => i);
                        }

                        let stampIndices = [];
                        if (targetPage === 'all') {
                            stampIndices = pages.map((_, i) => i);
                        } else {
                            stampIndices = [parseInt(targetPage) - 1];
                        }

                        // 產生長方形標籤 (姓名座號QR)
                        const dataUrl = await createFloatingLabelImage(student, task, noticeName, 400);
                        const qrBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
                        const qrImage = await pdfDoc.embedPng(qrBytes);

                        // 比例 = 1.1 (正方形偏長)
                        const imgHeight = qrSize * 1.1;

                        stampIndices.forEach(idx => {
                            if(pages[idx]) {
                                pages[idx].drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: imgHeight });
                            }
                        });
                        
                        const validKeepIndices = keepIndices.filter(i => i >= 0 && i < pages.length);
                        const copiedPages = await mergedPdf.copyPages(pdfDoc, validKeepIndices);
                        copiedPages.forEach(p => mergedPdf.addPage(p));
                    }

                    const pdfBytes = await mergedPdf.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `套印_${task.name}.pdf`;
                    a.click();

                } catch (e) {
                    showAlert('提示', '套印失敗: ' + e.message);
                }
                hideLoading();
            };
            fileReader.readAsArrayBuffer(fileInput.files[0]);
        }

        
        async function previewWord() {
            const taskIds = getCheckedTaskIds('tab4-task-checkboxes');
            if(taskIds.length === 0) { showAlert('提示', '請至少選擇一項作業'); return; }
            if(!db.students || db.students.length === 0) { showAlert('提示', '尚未建立學生名單'); return; }
            
            showLoading();
            setTimeout(async () => {
                try {
                    const selectedTasks = taskIds.map(id => db.tasks.find(t => t.id === id)).filter(Boolean);
                    
                    let tableHtml = '<table class="w-full border-collapse border border-gray-300 text-sm shadow-sm rounded bg-white">';
                    tableHtml += '<thead class="bg-gray-100 sticky top-0 z-10 shadow-sm"><tr>';
                    tableHtml += '<th class="border border-gray-300 p-2.5 text-center w-16 bg-gray-100 font-bold text-gray-700">座號</th>';
                    tableHtml += '<th class="border border-gray-300 p-2.5 text-center w-24 bg-gray-100 font-bold text-gray-700">姓名</th>';
                    for (const t of selectedTasks) {
                        tableHtml += `<th class="border border-gray-300 p-2.5 text-center font-bold text-gray-800 bg-gray-100">[${t.subject}] ${t.name}</th>`;
                    }
                    tableHtml += '</tr></thead><tbody>';

                    const cmToPx = 118.11; // 300dpi approx
                    const wCm = parseFloat(document.getElementById('tab4-w').value) || 4;
                    const hCm = parseFloat(document.getElementById('tab4-h').value) || 2;
                    const wPx = Math.floor(wCm * cmToPx);
                    const hPx = Math.floor(hCm * cmToPx);
                    // html style scaling (1cm ~ 38px in browser)
                    const wCss = Math.floor(wCm * 38);
                    const hCss = Math.floor(hCm * 38);

                    for (const student of db.students) {
                        tableHtml += `<tr class="hover:bg-blue-50 transition-colors">`;
                        tableHtml += `<td class="border border-gray-300 p-2 text-center font-mono font-semibold text-gray-500">${student.id}</td>`;
                        tableHtml += `<td class="border border-gray-300 p-2 text-center font-bold text-gray-900">${student.name}</td>`;

                        for (const task of selectedTasks) {
                            const dataUrl = await createLabelImage(student, task, '', true, wPx, hPx);
                            tableHtml += `<td class="border border-gray-300 p-2 text-center align-middle"><img src="${dataUrl}" style="width: ${wCss}px; height: ${hCss}px; margin: 0 auto; display: block;" class="rounded border shadow-sm"></td>`;
                        }
                        tableHtml += '</tr>';
                    }
                    tableHtml += '</tbody></table>';

                    document.getElementById('word-preview-content').innerHTML = tableHtml;
                    const container = document.getElementById('word-preview-container');
                    container.classList.remove('hidden');
                    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch(e) {
                    showAlert('提示', "產生預覽失敗: " + e.message);
                }
                hideLoading();
            }, 100);
        }

        async function generateWord() {
            const taskIds = getCheckedTaskIds('tab4-task-checkboxes');
            if(taskIds.length === 0) { showAlert('提示', '請至少選擇一項作業'); return; }
            if(!db.students || db.students.length === 0) { showAlert('提示', '尚未建立學生名單'); return; }
            const selectedTasks = taskIds.map(id => db.tasks.find(t => t.id === id)).filter(Boolean);

            showLoading();
            setTimeout(async () => {
                try {
                    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, WidthType, AlignmentType, VerticalAlign } = docx;
                    
                    const cmToPx = 118.11;
                    const wCm = parseFloat(document.getElementById('tab4-w').value) || 4;
                    const hCm = parseFloat(document.getElementById('tab4-h').value) || 2;
                    const wPx = Math.floor(wCm * cmToPx);
                    const hPx = Math.floor(hCm * cmToPx);
                    const docxW = Math.floor(wCm * 38);
                    const docxH = Math.floor(hCm * 38);

                    // ★ 計算頁面寬度可容納多少作業欄位
                    // A4 可用寬度 = 21cm - 左右邊距各 1.27cm = 18.46cm
                    const usableWidthCm = 18.46;
                    const fixedColsCm = 1.5 + 2.5; // 座號(1.5cm) + 姓名(2.5cm)
                    const maxTasksPerRow = Math.max(1, Math.floor((usableWidthCm - fixedColsCm) / (wCm + 0.3)));

                    // ★ 將作業分組（自動換行）
                    const taskGroups = [];
                    for (let i = 0; i < selectedTasks.length; i += maxTasksPerRow) {
                        taskGroups.push(selectedTasks.slice(i, i + maxTasksPerRow));
                    }

                    // 預先產生所有學生 x 所有作業的標籤圖片 (避免重複產生)
                    const imageCache = {};
                    for (const student of db.students) {
                        for (const task of selectedTasks) {
                            const key = `${student.id}_${task.id}`;
                            const dataUrl = await createLabelImage(student, task, '', true, wPx, hPx);
                            imageCache[key] = dataUrl.split(',')[1];
                        }
                    }

                    // 建立表頭列
                    function makeHeaderRow(taskGroup) {
                        const hCells = [
                            new TableCell({
                                verticalAlign: VerticalAlign.CENTER,
                                children: [new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: "座號", bold: true, size: 22 })]
                                })]
                            }),
                            new TableCell({
                                verticalAlign: VerticalAlign.CENTER,
                                children: [new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: "姓名", bold: true, size: 22 })]
                                })]
                            }),
                        ];
                        taskGroup.forEach(task => {
                            hCells.push(new TableCell({
                                verticalAlign: VerticalAlign.CENTER,
                                children: [new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: `[${task.subject}] ${task.name}`, bold: true, size: 20 })]
                                })]
                            }));
                        });
                        return new TableRow({ cantSplit: true, tableHeader: true, children: hCells });
                    }

                    // 建立學生資料列（只含該組的作業）
                    function makeStudentRow(student, taskGroup) {
                        const cells = [
                            new TableCell({
                                verticalAlign: VerticalAlign.CENTER,
                                children: [new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: String(student.id), size: 20 })]
                                })]
                            }),
                            new TableCell({
                                verticalAlign: VerticalAlign.CENTER,
                                children: [new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: student.name, bold: true, size: 22 })]
                                })]
                            })
                        ];
                        taskGroup.forEach(task => {
                            const base64Data = imageCache[`${student.id}_${task.id}`];
                            cells.push(new TableCell({
                                verticalAlign: VerticalAlign.CENTER,
                                children: [
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        spacing: { before: 20, after: 20 },
                                        children: [
                                            new ImageRun({
                                                data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                                                transformation: { width: docxW, height: docxH }
                                            })
                                        ]
                                    })
                                ]
                            }));
                        });
                        return new TableRow({ cantSplit: true, children: cells });
                    }

                    // ★ 組裝文件：標題 + 依序排列各組表格
                    const docChildren = [];

                    // 標題
                    docChildren.push(new Paragraph({
                        spacing: { after: 200 },
                        children: [new TextRun({ text: "全班作業條碼對照表", bold: true, size: 32 })],
                    }));

                    // 每組作業各建一張表格（座號＋姓名重複出現），表格間留間距
                    for (let gIdx = 0; gIdx < taskGroups.length; gIdx++) {
                        const group = taskGroups[gIdx];

                        const tableRows = [makeHeaderRow(group)];
                        for (const student of db.students) {
                            tableRows.push(makeStudentRow(student, group));
                        }

                        docChildren.push(new Table({
                            rows: tableRows,
                            width: { size: 100, type: WidthType.PERCENTAGE },
                        }));

                        // 組與組之間加空行分隔
                        if (gIdx < taskGroups.length - 1) {
                            docChildren.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }));
                        }
                    }

                    const doc = new Document({
                        sections: [{
                            properties: {
                                page: {
                                    margin: {
                                        top: 720,
                                        right: 720,
                                        bottom: 720,
                                        left: 720
                                    }
                                }
                            },
                            children: docChildren,
                        }],
                    });

                    const blob = await Packer.toBlob(doc);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = "全班作業條碼對照表.docx";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch(e) {
                    showAlert('提示', "匯出 Word 失敗: " + e.message);
                }
                hideLoading();
            }, 300);
        }

        async function generateExcelBarcodeTable() {
            const taskIds = getCheckedTaskIds('tab4-task-checkboxes');
            if(taskIds.length === 0) { showAlert('提示', '請至少選擇一項作業'); return; }
            if(!db.students || db.students.length === 0) { showAlert('提示', '尚未建立學生名單'); return; }
            const selectedTasks = taskIds.map(id => db.tasks.find(t => t.id === id)).filter(Boolean);

            showLoading();
            setTimeout(async () => {
                try {
                    const cmToPx = 118.11; // 300dpi approx
                    const wCm = parseFloat(document.getElementById('tab4-w').value) || 4;
                    const hCm = parseFloat(document.getElementById('tab4-h').value) || 2;
                    const wPx = Math.floor(wCm * cmToPx);
                    const hPx = Math.floor(hCm * cmToPx);

                    if (window.ExcelJS) {
                        const workbook = new ExcelJS.Workbook();
                        const worksheet = workbook.addWorksheet('全班作業條碼表', {
                            views: [{ showGridLines: true }]
                        });

                        // Set header columns
                        const columns = [
                            { header: '座號', key: 'seat', width: 8 },
                            { header: '姓名', key: 'name', width: 14 }
                        ];
                        // Approximate Excel column width for cm: 1 cm is roughly 5.2 character units
                        const colWidth = Math.max(16, Math.floor(wCm * 5.5) + 4);
                        selectedTasks.forEach(t => {
                            columns.push({
                                header: `[${t.subject}] ${t.name}`,
                                key: `task_${t.id}`,
                                width: colWidth
                            });
                        });
                        worksheet.columns = columns;

                        // Header style
                        const headerRow = worksheet.getRow(1);
                        headerRow.height = 28;
                        headerRow.font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
                        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        headerRow.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF1F5F9' }
                        };

                        // Calculate row height in Excel points: 1 cm ~ 28.35 pt
                        const rowHeightPt = Math.floor(hCm * 28.35) + 12;
                        // Image display size in pixels for excel: 1cm ~ 37.8 pixels
                        const imgDisplayW = Math.floor(wCm * 37.8);
                        const imgDisplayH = Math.floor(hCm * 37.8);

                        for (let sIdx = 0; sIdx < db.students.length; sIdx++) {
                            const student = db.students[sIdx];
                            const rowIndex = sIdx + 2; // 1-based, header is row 1
                            const row = worksheet.getRow(rowIndex);
                            row.height = rowHeightPt;
                            row.getCell(1).value = student.id;
                            row.getCell(2).value = student.name;
                            row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                            row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center', font: { bold: true } };

                            for (let tIdx = 0; tIdx < selectedTasks.length; tIdx++) {
                                const task = selectedTasks[tIdx];
                                const colIndex = tIdx + 3; // 1-based (1: seat, 2: name, 3+: tasks)
                                const dataUrl = await createLabelImage(student, task, '', true, wPx, hPx);
                                const base64Data = dataUrl.split(',')[1];
                                
                                const imageId = workbook.addImage({
                                    base64: base64Data,
                                    extension: 'png',
                                });

                                // Place image inside the cell
                                worksheet.addImage(imageId, {
                                    tl: { col: colIndex - 1 + 0.05, row: rowIndex - 1 + 0.08 },
                                    ext: { width: imgDisplayW, height: imgDisplayH },
                                    editAs: 'oneCell'
                                });
                            }
                        }

                        // Add cell borders
                        worksheet.eachRow((row, rowNumber) => {
                            row.eachCell((cell) => {
                                cell.border = {
                                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                                };
                            });
                        });

                        const buffer = await workbook.xlsx.writeBuffer();
                        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = "全班作業條碼對照表.xlsx";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } else {
                        // Fallback: HTML Spreadsheet .xls
                        let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>table{border-collapse:collapse;} th,td{border:0.5pt solid #cbd5e1;padding:8px;text-align:center;vertical-align:middle;} th{background-color:#f1f5f9;font-weight:bold;}</style></head><body><table>`;
                        tableHtml += '<thead><tr><th>座號</th><th>姓名</th>';
                        for (const t of selectedTasks) {
                            tableHtml += `<th>[${t.subject}] ${t.name}</th>`;
                        }
                        tableHtml += '</tr></thead><tbody>';

                        const wCss = Math.floor(wCm * 38);
                        const hCss = Math.floor(hCm * 38);

                        const targetStudents = db.students.filter(s => studentIds.includes(s.id));
                        for (const student of targetStudents) {
                            tableHtml += `<tr><td>${student.id}</td><td><b>${student.name}</b></td>`;
                            for (const task of selectedTasks) {
                                const dataUrl = await createLabelImage(student, task, '', true, wPx, hPx);
                                tableHtml += `<td><img src="${dataUrl}" width="${wCss}" height="${hCss}"></td>`;
                            }
                            tableHtml += '</tr>';
                        }
                        tableHtml += '</tbody></table></body></html>';

                        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = "全班作業條碼對照表.xls";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                } catch(e) {
                    showAlert('提示', "匯出 Excel 失敗: " + e.message);
                }
                hideLoading();
            }, 100);
        }

        let currentCanvasDataUrl = null;
        function selectAllStudents(containerId) {
            const container = document.getElementById(containerId);
            if(!container) return;
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        }
        function deselectAllStudents(containerId) {
            const container = document.getElementById(containerId);
            if(!container) return;
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        function selectFixedTasks(containerId) {
            const container = document.getElementById(containerId);
            if(!container) return;
            const cbs = Array.from(container.querySelectorAll('input[type="checkbox"]')).filter(cb => {
                const task = db.tasks.find(t => t.id === cb.value);
                return task && task.type === 'fixed';
            });
            if(cbs.length === 0) return;
            const allChecked = cbs.every(cb => cb.checked);
            cbs.forEach(cb => cb.checked = !allChecked);
        }
        function selectSubjectTasks(containerId, subject) {
            const container = document.getElementById(containerId);
            if(!container) return;
            const cbs = Array.from(container.querySelectorAll('input[type="checkbox"]')).filter(cb => {
                const task = db.tasks.find(t => t.id === cb.value);
                return task && task.subject === subject;
            });
            if(cbs.length === 0) return;
            const allChecked = cbs.every(cb => cb.checked);
            cbs.forEach(cb => cb.checked = !allChecked);
        }
        function getCheckedStudentIds(containerId) {
            const container = document.getElementById(containerId);
            if(!container) return [];
            return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        }

                let currentBatchPdfBlobUrl = null;
        async function previewBatchPDF() {
            const taskIds = getCheckedTaskIds('tab4-task-checkboxes');
            const studentIds = getCheckedStudentIds('tab4-student-checkboxes');
            if(taskIds.length === 0) { showAlert('提示', '請至少選擇一項作業'); return; }
            if(studentIds.length === 0) { showAlert('提示', '請至少選擇一位學生'); return; }
            
            const wCm = parseFloat(document.getElementById('tab4-w').value) || 4;
            const hCm = parseFloat(document.getElementById('tab4-h').value) || 2;
            
            showLoading();
            setTimeout(async () => {
                try {
                    // PDF dimensions in points (1 cm = 28.346 pt)
                    const cmToPt = 28.346;
                    const a4W = 595.28;
                    const a4H = 841.89;
                    
                    const labelW = wCm * cmToPt;
                    const labelH = hCm * cmToPt;
                    
                    // 窄邊界 = 0.5cm
                    const minMarginPt = 0.5 * cmToPt;
                    const cols = Math.max(1, Math.floor((a4W - minMarginPt * 2) / labelW));
                    const rows = Math.max(1, Math.floor((a4H - minMarginPt * 2) / labelH));
                    
                    const marginLeft = minMarginPt;
                    const marginTop = minMarginPt;
                    
                    const pdfDoc = await PDFLib.PDFDocument.create();
                    let page = pdfDoc.addPage([a4W, a4H]);
                    
                    let index = 0;
                    
                    // Pre-calculate all combinations to know total count
                    const selectedStudents = db.students.filter(s => studentIds.includes(s.id));
                    let totalItems = taskIds.length * selectedStudents.length;
                    
                    for (const taskId of taskIds) {
                        const task = db.tasks.find(t => t.id === taskId);
                        for (const student of selectedStudents) {
                            if (index > 0 && index % (cols * rows) === 0) {
                                page = pdfDoc.addPage([a4W, a4H]);
                            }
                            
                            const pageIndex = index % (cols * rows);
                            const col = pageIndex % cols;
                            const row = Math.floor(pageIndex / cols);
                            
                            const x = marginLeft + col * labelW;
                            const y = a4H - (marginTop + row * labelH) - labelH; // PDF y is bottom-up
                            
                            // Get image data URL from canvas generator
                            // Use high res for good print quality (e.g. 600x400)
                            const pxW = Math.floor(wCm * 118.11);
                            const pxH = Math.floor(hCm * 118.11);
                            const dataUrl = await createLabelImage(student, task, '', false, pxW, pxH);
                            
                            const imgBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
                            const pdfImg = await pdfDoc.embedPng(imgBytes);
                            
                            page.drawImage(pdfImg, { x: x, y: y, width: labelW, height: labelH });
                            index++;
                        }
                    }

                    const pdfBytes = await pdfDoc.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    currentBatchPdfBlobUrl = URL.createObjectURL(blob);
                    
                    const preview = document.getElementById('tab4-pdf-preview');
                    preview.innerHTML = `<iframe src="${currentBatchPdfBlobUrl}#toolbar=0" width="100%" height="100%"></iframe>`;
                    preview.classList.remove('hidden');
                    
                    document.getElementById('tab4-download-pdf-btn').classList.remove('hidden');

                } catch (e) {
                    showAlert('提示', '產生 PDF 失敗: ' + e.message);
                    console.error(e);
                }
                hideLoading();
            }, 500);
        }

        function downloadBatchPDF() {
            if(currentBatchPdfBlobUrl) {
                const a = document.createElement('a');
                a.href = currentBatchPdfBlobUrl;
                a.download = `標籤排版_批次.pdf`;
                a.click();
            }
        }

        async function generateZip() {
            showLoading();
            setTimeout(async () => {
                try {
                    const zip = new JSZip();
                    for (const student of db.students) {
                        const folder = zip.folder(student.name);
                        for (const task of db.tasks) {
                            const qrText = getQRText(student, task);
                            const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 300, errorCorrectionLevel: 'L', color: { dark: '#000000', light: '#ffffff' } });
                            const base64Data = qrDataUrl.split(',')[1];
                            folder.file(`${student.name}_${task.name}.png`, base64Data, {base64: true});
                        }
                    }
                    const content = await zip.generateAsync({type:"blob"});
                    const url = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = "全班條碼打包.zip";
                    a.click();
                } catch(e) {
                    showAlert('提示', "打包失敗: " + e.message);
                }
                hideLoading();
            }, 500);
        }

        // Boot
        loadData();
        
        // Ensure we save data if user refreshes while focusing an input
        window.addEventListener('beforeunload', () => {
            if (document.activeElement && (document.activeElement.id === 'info-school' || document.activeElement.id === 'info-year' || document.activeElement.id === 'info-class')) {
                saveClassInfo();
            }
        });
        // --- VISUAL PDF EDITOR ---
        let visualPdfScale = 1;
        let visualQrStates = []; // [{ pageIndex, x, y, size, keep, stamp }]

        function updateVisualSize() {
            const wCm = parseFloat(document.getElementById('tab3-visual-w').value) || 2.5;
            const hCm = parseFloat(document.getElementById('tab3-visual-h').value) || 3.0;
            
            const ptToCm = 1 / 28.346;
            const widthPt = wCm / ptToCm;
            const heightPt = hCm / ptToCm;
            
            const boxes = document.querySelectorAll('.qr-box');
            boxes.forEach(box => {
                box.style.width = (widthPt * visualPdfScale) + 'px';
                box.style.height = (heightPt * visualPdfScale) + 'px';
            });
        }
        
        function snapQr(pageIndex, pos) {
            const wrapper = document.getElementById('pdf-zoom-container').children[pageIndex - 1];
            const box = document.getElementById('qr-box-' + pageIndex);
            if(!wrapper || !box) return;
            
            const margin = 20; // 20px padding from edge
            
            if(pos === 'tl') {
                box.style.left = margin + 'px';
                box.style.top = margin + 'px';
            } else if(pos === 'tr') {
                box.style.left = (wrapper.offsetWidth - box.offsetWidth - margin) + 'px';
                box.style.top = margin + 'px';
            } else if(pos === 'bl') {
                box.style.left = margin + 'px';
                box.style.top = (wrapper.offsetHeight - box.offsetHeight - margin) + 'px';
            } else if(pos === 'br') {
                box.style.left = (wrapper.offsetWidth - box.offsetWidth - margin) + 'px';
                box.style.top = (wrapper.offsetHeight - box.offsetHeight - margin) + 'px';
            }
        }

        async function renderVisualPdfPreview() {
            const fileInput = document.getElementById('tab3-pdf-upload');
            if(!fileInput || !fileInput.files.length) return;
            const file = fileInput.files[0];
            
            // Auto-fill notice name with filename
            const noticeInput = document.getElementById('tab3-notice-name');
            if(noticeInput && file) {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                noticeInput.value = nameWithoutExt;
            }

            showLoading();
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                try {
                    const typedarray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    pdfDocumentGlobal = pdf;
                    
                    const container = document.getElementById('visual-pdf-preview');
                    if(!container) return;
                    container.style.display = 'flex';
                    document.getElementById('pdf-zoom-container').innerHTML = '';
                    
                    visualQrStates = [];
                    
                    const page1 = await pdf.getPage(1);
                    const viewport1 = page1.getViewport({scale: 1.0});
                    // scale to fit container width, leave padding
                    visualPdfScale = (container.clientWidth - 40) / viewport1.width;
                    if(visualPdfScale > 1.5) visualPdfScale = 1.5; // cap it
                    
                    for(let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const scaledViewport = page.getViewport({scale: visualPdfScale});
                        
                        const wrapper = document.createElement('div');
                        wrapper.className = 'relative shadow-lg bg-white border mx-auto';
                        wrapper.style.width = scaledViewport.width + 'px';
                        wrapper.style.height = scaledViewport.height + 'px';
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = scaledViewport.width;
                        canvas.height = scaledViewport.height;
                        canvas.className = 'absolute top-0 left-0';
                        wrapper.appendChild(canvas);
                        
                        const context = canvas.getContext('2d');
                        await page.render({canvasContext: context, viewport: scaledViewport}).promise;
                        
                        // Controls
                        const controls = document.createElement('div');
                        controls.className = 'absolute top-2 left-2 flex flex-col gap-2 bg-white p-3 rounded shadow-md border z-20 opacity-90 hover:opacity-100';
                        controls.innerHTML = `
                            <div class="font-bold text-gray-700 border-b pb-1 mb-1">第 ${i} 頁</div>
                            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="keep-page-${i}" checked onchange="toggleBox(${i})"> 保留此頁匯出</label>
                            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="stamp-page-${i}" ${i===1?'checked':''} onchange="toggleBox(${i})"> 在此頁蓋條碼</label>
                            <div class="flex gap-1 mt-1 justify-between">
                                <button onclick="snapQr(${i}, 'tl')" class="text-xs bg-gray-100 border hover:bg-gray-200 px-1.5 py-0.5 rounded shadow-sm">左上</button>
                                <button onclick="snapQr(${i}, 'tr')" class="text-xs bg-gray-100 border hover:bg-gray-200 px-1.5 py-0.5 rounded shadow-sm">右上</button>
                                <button onclick="snapQr(${i}, 'bl')" class="text-xs bg-gray-100 border hover:bg-gray-200 px-1.5 py-0.5 rounded shadow-sm">左下</button>
                                <button onclick="snapQr(${i}, 'br')" class="text-xs bg-gray-100 border hover:bg-gray-200 px-1.5 py-0.5 rounded shadow-sm">右下</button>
                            </div>
                        `;
                        wrapper.appendChild(controls);
                        
                        // QR Box
                        const box = document.createElement('div');
                        box.id = 'qr-box-' + i;
                        box.className = 'qr-box absolute border-2 border-red-500 cursor-move bg-red-200 bg-opacity-50 flex flex-col items-center justify-center text-xs font-bold text-red-700 z-30';
                        box.style.display = i === 1 ? 'flex' : 'none';
                        box.innerHTML = '姓名座號<br><br>條碼區塊';
                        wrapper.appendChild(box);
                        
                        // Default position: Top right corner, offset slightly
                        box.style.top = '20px';
                        box.style.left = (scaledViewport.width - 120) + 'px';
                        
                        setupDraggable(box, wrapper);
                        
                        document.getElementById('pdf-zoom-container').appendChild(wrapper);
                    }
                    updateVisualSize();
                } catch(e) {
                    showAlert('提示', "載入 PDF 發生錯誤: " + e.message);
                }
                hideLoading();
            };
            fileReader.readAsArrayBuffer(fileInput.files[0]);
        }

        function toggleBox(pageIndex) {
            const keep = document.getElementById('keep-page-' + pageIndex).checked;
            const stamp = document.getElementById('stamp-page-' + pageIndex).checked;
            const box = document.getElementById('qr-box-' + pageIndex);
            
            if(!keep && stamp) {
                // if not keeping, can't stamp
                document.getElementById('stamp-page-' + pageIndex).checked = false;
                box.style.display = 'none';
            } else {
                box.style.display = stamp ? 'flex' : 'none';
            }
        }

        
        let pdfZoomLevel = 1.0;
        
        function changePdfZoom(delta) {
            pdfZoomLevel += delta;
            if(pdfZoomLevel < 0.5) pdfZoomLevel = 0.5;
            if(pdfZoomLevel > 3.0) pdfZoomLevel = 3.0;
            
            document.getElementById('pdf-zoom-text').innerText = Math.round(pdfZoomLevel * 100) + '%';
            document.getElementById('pdf-zoom-container').style.transform = `scale(${pdfZoomLevel})`;
        }

        let currentDragBox = null;
        let currentDragContainer = null;
        let dragStartX = 0;
        let dragStartY = 0;

        document.addEventListener('mousemove', function(e) {
            if(!currentDragBox) return;
            // Adjust drag speed based on zoom level
            const dx = (e.clientX - dragStartX) / (typeof pdfZoomLevel !== 'undefined' ? pdfZoomLevel : 1);
            const dy = (e.clientY - dragStartY) / (typeof pdfZoomLevel !== 'undefined' ? pdfZoomLevel : 1);
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            
            let currentLeft = parseFloat(currentDragBox.style.left) || 0;
            let currentTop = parseFloat(currentDragBox.style.top) || 0;
            
            let newLeft = currentLeft + dx;
            let newTop = currentTop + dy;
            
            if(newLeft < 0) newLeft = 0;
            if(newTop < 0) newTop = 0;
            if(newLeft + currentDragBox.offsetWidth > currentDragContainer.offsetWidth) newLeft = currentDragContainer.offsetWidth - currentDragBox.offsetWidth;
            if(newTop + currentDragBox.offsetHeight > currentDragContainer.offsetHeight) newTop = currentDragContainer.offsetHeight - currentDragBox.offsetHeight;
            
            currentDragBox.style.left = newLeft + 'px';
            currentDragBox.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', function() {
            currentDragBox = null;
            currentDragContainer = null;
        });

        function setupDraggable(box, container) {
            // Enable native CSS resizing
            box.style.resize = 'both';
            box.style.overflow = 'hidden';
            
            box.onmousedown = function(e) {
                // Do not drag if clicking on the bottom-right resize handle
                const rect = box.getBoundingClientRect();
                const isResize = (e.clientX > rect.right - 20) && (e.clientY > rect.bottom - 20);
                if(isResize) return;
                
                currentDragBox = box;
                currentDragContainer = container;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                e.preventDefault(); // Prevents text selection while dragging
            };
        }

        async function generateVisualFloatingPDF() {
            const select = document.getElementById('tab3-task-select');
            if(!select.value) { showAlert('提示', '請先選擇浮動作/通知單'); return; }
            const task = db.tasks.find(t => t.id === select.value);
            let noticeName = '';
            const noticeInput = document.getElementById('tab3-notice-name');
            if(noticeInput) noticeName = noticeInput.value.trim();

            const fileInput = document.getElementById('tab3-pdf-upload');
            if(!fileInput || fileInput.files.length === 0) { showAlert('提示', '請先上傳底板 PDF'); return; }
            
            showLoading();
            setTimeout(async () => {
                try {
                    const originalPdfBytes = await fileInput.files[0].arrayBuffer();
                    const mergedPdf = await PDFLib.PDFDocument.create();
                    
                    for (const student of db.students) {
                        const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
                        const pages = pdfDoc.getPages();
                        
                        let keepIndices = [];
                        let stampIndices = [];
                        let boxPositions = {}; // pageIndex -> {x, y} in points
                        
                        for(let i = 1; i <= pages.length; i++) {
                            const keep = document.getElementById('keep-page-' + i)?.checked;
                            const stamp = document.getElementById('stamp-page-' + i)?.checked;
                            
                            if(keep) keepIndices.push(i - 1);
                            if(stamp) {
                                stampIndices.push(i - 1);
                                const box = document.getElementById('qr-box-' + i);
                                const leftPx = parseFloat(box.style.left) || 0;
                                const topPx = parseFloat(box.style.top) || 0;
                                const widthPx = box.offsetWidth;
                                const heightPx = box.offsetHeight;
                                
                                // Use pdfjsLib's viewport to do precise coordinate mapping (handles CropBox, Rotation, UserUnit)
                                const pdfjsPage = await pdfDocumentGlobal.getPage(i);
                                const viewport = pdfjsPage.getViewport({scale: visualPdfScale});
                                
                                // Box bottom-left in CSS pixels relative to the wrapper
                                const boxBottomLeftX = leftPx;
                                const boxBottomLeftY = topPx + heightPx;
                                const [pdfX, pdfY] = viewport.convertToPdfPoint(boxBottomLeftX, boxBottomLeftY);
                                
                                // Box top-right in CSS pixels to calculate precise width/height
                                const [pdfTopRightX, pdfTopRightY] = viewport.convertToPdfPoint(leftPx + widthPx, topPx);
                                
                                const customWidthPt = Math.abs(pdfTopRightX - pdfX);
                                const customHeightPt = Math.abs(pdfTopRightY - pdfY);
                                
                                boxPositions[i-1] = { 
                                    x: Math.min(pdfX, pdfTopRightX), 
                                    y: Math.min(pdfY, pdfTopRightY),
                                    w: customWidthPt,
                                    h: customHeightPt
                                };
                            }
                        }
                        
                        if(keepIndices.length === 0) {
                            showAlert('提示', '必須至少保留一頁！');
                            hideLoading();
                            return;
                        }

                        // Generate label image for this student
                        const dataUrl = await createFloatingLabelImage(student, task, noticeName, 400);
                        const qrBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
                        const qrImage = await pdfDoc.embedPng(qrBytes);

                        for (const idx of keepIndices) {
                            const page = pages[idx];
                            if (stampIndices.includes(idx)) {
                                const pos = boxPositions[idx];
                                page.drawImage(qrImage, {
                                    x: pos.x,
                                    y: pos.y,
                                    width: pos.w,
                                    height: pos.h
                                });
                            }
                        }

                        // Extract kept pages
                        const extractedDoc = await PDFLib.PDFDocument.create();
                        const copiedPages = await extractedDoc.copyPages(pdfDoc, keepIndices);
                        copiedPages.forEach(p => extractedDoc.addPage(p));
                        
                        const extractedBytes = await extractedDoc.save();
                        const copiedPdf = await PDFLib.PDFDocument.load(extractedBytes);
                        
                        const finalPages = await mergedPdf.copyPages(copiedPdf, copiedPdf.getPageIndices());
                        finalPages.forEach(p => mergedPdf.addPage(p));
                    }

                    const finalBytes = await mergedPdf.save();
                    const blob = new Blob([finalBytes], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = noticeName ? `${task.name}_${noticeName}.pdf` : `${task.name}_浮動套印.pdf`;
                    a.click();

                } catch (e) {
                    showAlert('提示', '產生 PDF 失敗: ' + e.message);
                    console.error(e);
                }
                hideLoading();
            }, 500);
        }

    
        function exportStatToExcel() {
            const wb = XLSX.utils.book_new();
            const allSubjectKeys = {};
            const subjects = getSubjects();
            
            const filterLast = document.getElementById('stat-filter-last') && document.getElementById('stat-filter-last').checked;

            if (subjects.length === 0) {
                showAlert('提示', '目前沒有任何作業資料可以匯出');
                return;
            }

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

                let finalTaskKeys = uniqueTaskKeys;
                if (filterLast && db.lastSessionTasks) {
                    finalTaskKeys = uniqueTaskKeys.filter(k => {
                        return db.lastSessionTasks.some(lt => lt.taskId === k.taskId && lt.noticeName === k.noticeName);
                    });
                }

                if (finalTaskKeys.length === 0) return;

                const aoa = [];
                const rowTask = ['作業名稱'];
                const rowDate = ['應繳交日期'];
                const rowRange = ['姓名 \ 範圍'];
                finalTaskKeys.forEach(k => {
                    rowTask.push(k.label);
                    rowDate.push(getTaskDate(k.taskId, k.noticeName) || new Date().toISOString().split('T')[0]);
                    rowRange.push(getTaskRange(k.taskId, k.noticeName) || '');
                });
                aoa.push(rowTask);
                aoa.push(rowDate);
                aoa.push(rowRange);
                
                db.students.forEach(s => {
                    const row = [s.name];
                    finalTaskKeys.forEach(k => {
                        const record = db.records.find(r => r.studentId === s.id && r.taskId === k.taskId && r.noticeName === k.noticeName);
                        const taskDef = db.tasks.find(t => t.id === k.taskId);
                        const missingText = (taskDef && taskDef.subject === '聯絡簿') ? '沒帶' : '缺交';
                        let cellValue = missingText;
                        if (record) {
                            cellValue = record.timestamp;
                            if (record.manualStatus && (record.manualStatus.startsWith('leave_') || ['事假', '病假', '公假', '喪假', '曠課', '遲到', '其他', '其他假別'].includes(record.manualStatus))) {
                                
                                let lName = record.manualStatus;
                                if (lName.startsWith('leave_custom_')) lName = lName.replace('leave_custom_', '');
                                else if (lName.startsWith('leave_')) lName = lName.replace('leave_', '');
                                cellValue = lName;
                            } else if (record.manualStatus === 'missing') {
                                cellValue = missingText;
                            }
                            if (taskDef && taskDef.deadline) {
                                let deadlineDate = new Date(taskDef.deadline);
                                let isLate = false;
                                if (record.manualStatus === 'late') {
                                    isLate = true;
                                } else if (record.manualStatus === 'ontime') {
                                    isLate = false;
                                } else {
                                    let scanDate;
                                    if (record.timestamp.includes('T') || record.timestamp.includes('-')) {
                                        scanDate = new Date(record.timestamp);
                                    } else {
                                        const currentYear = new Date().getFullYear();
                                        scanDate = new Date(`${currentYear}/${record.timestamp}`);
                                    }
                                    if (scanDate > deadlineDate) isLate = true;
                                }
                                if (isLate) cellValue = `[遲交] ${record.timestamp}`;
                            }
                        }
                        row.push(cellValue);
                    });
                    aoa.push(row);
                });
                
                const ws = XLSX.utils.aoa_to_sheet(aoa);
                XLSX.utils.book_append_sheet(wb, ws, sub);
            });
            
            if (wb.SheetNames.length === 0) {
                showAlert('提示', '沒有任何資料可匯出！');
                return;
            }
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `作業繳交統計表_${dateStr}.xlsx`);
        }

        function exportExcel() {
            return exportStatToExcel();
        }

// ==========================================
// 家長端查詢小卡自訂文字與設定模組 (比照 MPScore)
// ==========================================
const DEFAULT_PARENT_CARD_CONFIG = {
    title: '作業繳交狀況查詢卡',
    step1: '手機掃描查詢：直接開啟手機相機對準 QR Code 掃描，免密碼秒查孩子作業繳交狀況、各科明細與待補交清單。',
    step2: 'LINE 自動通知：進入網頁點擊「一秒綁定 LINE」，放學有缺交主動發送推播通知！（亦可直接回傳查詢代碼至班級 LINE 完成綁定）',
    note: '導師叮嚀：請家長每日協助督促孩子按時完成作業並落實訂正，親師攜手共創良好學習習慣！'
};

function getParentCardConfig() {
    try {
        const saved = localStorage.getItem('hw_parent_card_config');
        if (saved) {
            return Object.assign({}, DEFAULT_PARENT_CARD_CONFIG, JSON.parse(saved));
        }
    } catch(e) {}
    return Object.assign({}, DEFAULT_PARENT_CARD_CONFIG);
}

function saveParentCardConfig(cfg) {
    try {
        localStorage.setItem('hw_parent_card_config', JSON.stringify(cfg));
    } catch(e) {}
}

function syncParentCardTextsOnCards(cfg) {
    if (!cfg) cfg = getParentCardConfig();
    document.querySelectorAll('.card-editable-title').forEach(el => {
        if (el.innerText !== cfg.title) el.innerText = cfg.title;
    });
    document.querySelectorAll('.card-editable-step1').forEach(el => {
        if (el.innerText !== cfg.step1) el.innerText = cfg.step1;
    });
    document.querySelectorAll('.card-editable-step2').forEach(el => {
        if (el.innerText !== cfg.step2) el.innerText = cfg.step2;
    });
    document.querySelectorAll('.card-editable-note').forEach(el => {
        if (el.innerText !== cfg.note) el.innerText = cfg.note;
    });
}

function syncTab8CustomInputs(cfg) {
    if (!cfg) cfg = getParentCardConfig();
    const t = document.getElementById('parent-card-cfg-title');
    const s1 = document.getElementById('parent-card-cfg-step1');
    const s2 = document.getElementById('parent-card-cfg-step2');
    const n = document.getElementById('parent-card-cfg-note');
    if (t) t.value = cfg.title || '';
    if (s1) s1.value = cfg.step1 || '';
    if (s2) s2.value = cfg.step2 || '';
    if (n) n.value = cfg.note || '';
}

function syncModalCustomInputs(cfg) {
    if (!cfg) cfg = getParentCardConfig();
    const t = document.getElementById('modal-card-cfg-title');
    const s1 = document.getElementById('modal-card-cfg-step1');
    const s2 = document.getElementById('modal-card-cfg-step2');
    const n = document.getElementById('modal-card-cfg-note');
    if (t) t.value = cfg.title || '';
    if (s1) s1.value = cfg.step1 || '';
    if (s2) s2.value = cfg.step2 || '';
    if (n) n.value = cfg.note || '';
}

function escapeCardHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function saveParentCardCustomTextFromUI() {
    const tEl = document.getElementById('parent-card-cfg-title');
    const s1El = document.getElementById('parent-card-cfg-step1');
    const s2El = document.getElementById('parent-card-cfg-step2');
    const nEl = document.getElementById('parent-card-cfg-note');
    const current = getParentCardConfig();
    const cfg = {
        title: tEl ? tEl.value : current.title,
        step1: s1El ? s1El.value : current.step1,
        step2: s2El ? s2El.value : current.step2,
        note: nEl ? nEl.value : current.note,
    };
    saveParentCardConfig(cfg);
    syncParentCardTextsOnCards(cfg);
    syncModalCustomInputs(cfg);
}

function saveParentCardCustomTextFromModalUI() {
    const tEl = document.getElementById('modal-card-cfg-title');
    const s1El = document.getElementById('modal-card-cfg-step1');
    const s2El = document.getElementById('modal-card-cfg-step2');
    const nEl = document.getElementById('modal-card-cfg-note');
    const current = getParentCardConfig();
    const cfg = {
        title: tEl ? tEl.value : current.title,
        step1: s1El ? s1El.value : current.step1,
        step2: s2El ? s2El.value : current.step2,
        note: nEl ? nEl.value : current.note,
    };
    saveParentCardConfig(cfg);
    syncParentCardTextsOnCards(cfg);
    syncTab8CustomInputs(cfg);
}

function handleCardDirectEdit(field, el) {
    const text = el.innerText.replace(/^\n+|\n+$/g, '');
    const cfg = getParentCardConfig();
    cfg[field] = text;
    saveParentCardConfig(cfg);

    // 同步到預覽頁面上的其他所有小卡
    const selectorMap = {
        title: '.card-editable-title',
        step1: '.card-editable-step1',
        step2: '.card-editable-step2',
        note: '.card-editable-note'
    };
    const targetClass = selectorMap[field];
    if (targetClass) {
        document.querySelectorAll(targetClass).forEach(target => {
            if (target !== el && target.innerText !== text) {
                target.innerText = text;
            }
        });
    }

    // 同步更新設定面板中的輸入框
    syncTab8CustomInputs(cfg);
    syncModalCustomInputs(cfg);
}

function resetParentCardCustomText() {
    saveParentCardConfig(DEFAULT_PARENT_CARD_CONFIG);
    syncParentCardTextsOnCards(DEFAULT_PARENT_CARD_CONFIG);
    syncTab8CustomInputs(DEFAULT_PARENT_CARD_CONFIG);
    syncModalCustomInputs(DEFAULT_PARENT_CARD_CONFIG);
    if (typeof showToast === 'function') {
        showToast('已重設為預設文字內容！', 'success');
    }
}

function toggleParentTabCustomTextPanel() {
    const panel = document.getElementById('parent-tab-custom-panel');
    const icon = document.getElementById('parent-tab-custom-toggle-icon');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        if (icon) icon.innerText = '▲ 收合設定';
        syncTab8CustomInputs();
    } else {
        panel.classList.add('hidden');
        if (icon) icon.innerText = '▼ 展開設定';
    }
}

function toggleModalCardCustomPanel() {
    const panel = document.getElementById('modal-card-custom-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        syncModalCustomInputs();
    } else {
        panel.classList.add('hidden');
    }
}

function changeParentCardDensityInModal(val) {
    const density = parseInt(val, 10) || 6;
    window._currentParentCardsDensity = density;
    const tab8Density = document.getElementById('parent-tab-card-density');
    if (tab8Density) tab8Density.value = String(density);
    const tab4Density = document.getElementById('parent-card-density');
    if (tab4Density) tab4Density.value = String(density);
    const studentIds = window._currentParentCardStudentIds || db.students.map(s => s.id);
    renderParentCardsContent(studentIds, density);
}

// ==========================================
// 家長端專屬查詢小卡預覽與列印模組 (比照 MPScore)
// ==========================================
async function previewParentCardsModal(explicitStudentIds, explicitDensity) {
    let studentIds = explicitStudentIds;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        const tab8Checked = Array.from(document.querySelectorAll('.parent-tab-stu-cb:checked')).map(cb => parseInt(cb.value, 10));
        if (tab8Checked.length > 0) {
            studentIds = tab8Checked;
        } else {
            studentIds = getCheckedStudentIds('tab4-student-checkboxes');
        }
    }
    if (!studentIds || studentIds.length === 0) {
        studentIds = db.students.map(s => s.id);
    }
    if (studentIds.length === 0) {
        showAlert('提示', '尚未建立任何學生名單！');
        return;
    }

    let cardsPerPage = explicitDensity;
    if (!cardsPerPage) {
        const densitySelect = document.getElementById('parent-tab-card-density') || document.getElementById('parent-card-density');
        cardsPerPage = densitySelect ? parseInt(densitySelect.value, 10) || 6 : 6;
    }

    window._currentParentCardStudentIds = studentIds;
    window._currentParentCardsDensity = cardsPerPage;

    let modal = document.getElementById('parent-cards-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'parent-cards-modal';
        modal.className = 'fixed inset-0 bg-black/60 z-50 flex flex-col justify-between p-2 sm:p-4 overflow-hidden';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[92vh] mx-auto overflow-hidden">
                <!-- 模態框標頭 -->
                <div class="p-3.5 bg-emerald-600 text-white flex flex-wrap justify-between items-center gap-2 no-print shadow-xs">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">👨‍👩‍👧</span>
                        <div>
                            <h3 class="font-bold text-base sm:text-lg leading-tight">家長專屬查詢小卡列印預覽 (A4 排版)</h3>
                            <p class="text-xs text-emerald-100">支援手機相機一鍵掃碼 ‧ 點擊卡片文字可直接線上編輯修改</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <!-- 密度切換 -->
                        <div class="flex items-center gap-1.5 bg-emerald-700/80 px-2.5 py-1 rounded-xl border border-emerald-500/50 text-xs">
                            <span class="text-emerald-100 font-bold hidden sm:inline">每頁密度：</span>
                            <select id="modal-parent-card-density" onchange="changeParentCardDensityInModal(this.value)" class="bg-emerald-800 text-white text-xs font-bold rounded-lg px-2 py-1 border border-emerald-500 outline-none cursor-pointer">
                                <option value="6">每頁 6 張 (3x2 推薦)</option>
                                <option value="8">每頁 8 張 (4x2 經濟)</option>
                                <option value="4">每頁 4 張 (2x2 大字)</option>
                            </select>
                        </div>
                        <!-- 自訂文字開關 -->
                        <button onclick="toggleModalCardCustomPanel()" class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-500/60 transition active:scale-95 flex items-center gap-1 cursor-pointer">
                            <span>✏️ 自訂文字</span>
                        </button>
                        <!-- 儲存 PDF 按鈕 -->
                        <button id="btn-modal-download-pdf" onclick="downloadParentCardsPDF()" class="bg-amber-400 hover:bg-amber-300 text-amber-950 font-black px-3.5 py-2 rounded-xl text-sm shadow transition active:scale-95 flex items-center gap-1 cursor-pointer">
                            <span>📥 儲存 PDF (A4)</span>
                        </button>
                        <!-- 直接列印按鈕 -->
                        <button id="btn-modal-print-a4" onclick="printParentCardsA4()" class="bg-white text-emerald-800 hover:bg-emerald-50 font-bold px-3.5 py-2 rounded-xl text-sm shadow transition active:scale-95 flex items-center gap-1 cursor-pointer">
                            <span>🖨️ 直接列印 (A4)</span>
                        </button>
                        <button onclick="closeParentCardsModal()" class="text-white hover:bg-white/20 p-2 rounded-full text-xl transition active:scale-95 cursor-pointer leading-none">&times;</button>
                    </div>
                </div>

                <!-- 模態框內的自訂文字面板 (預設隱藏，點擊按鈕展開) -->
                <div id="modal-card-custom-panel" class="hidden p-3.5 bg-emerald-50 border-b border-emerald-200 no-print">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-2">
                        <div>
                            <label class="block font-bold text-emerald-950 mb-0.5">小卡標題：</label>
                            <input type="text" id="modal-card-cfg-title" class="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-500" oninput="saveParentCardCustomTextFromModalUI()">
                        </div>
                        <div>
                            <label class="block font-bold text-emerald-950 mb-0.5">導師叮嚀 / 親師配合叮嚀：</label>
                            <input type="text" id="modal-card-cfg-note" class="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-500" oninput="saveParentCardCustomTextFromModalUI()">
                        </div>
                        <div>
                            <label class="block font-bold text-emerald-950 mb-0.5">步驟一 (查詢說明)：</label>
                            <textarea id="modal-card-cfg-step1" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-500" oninput="saveParentCardCustomTextFromModalUI()"></textarea>
                        </div>
                        <div>
                            <label class="block font-bold text-emerald-950 mb-0.5">步驟二 (LINE 綁定說明)：</label>
                            <textarea id="modal-card-cfg-step2" rows="2" class="w-full border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-white outline-none focus:ring-1 focus:ring-emerald-500" oninput="saveParentCardCustomTextFromModalUI()"></textarea>
                        </div>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-emerald-800 font-medium">💡 亦可直接在下方卡片點選文字即時編輯（會自動同步至全班卡片並儲存）</span>
                        <div class="space-x-2">
                            <button onclick="resetParentCardCustomText()" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded hover:bg-rose-100 transition cursor-pointer">恢復預設文字</button>
                            <button onclick="toggleModalCardCustomPanel()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg transition active:scale-95 cursor-pointer">完成收合</button>
                        </div>
                    </div>
                </div>

                <!-- 預覽容器 (A4 表格滾動區) -->
                <div id="parent-cards-print-container" class="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1 space-y-6">
                    <div class="text-center py-10 text-gray-500 font-bold">正在生成 QR Code 排版中...</div>
                </div>

                <!-- 底部操作列 -->
                <div class="p-3 bg-gray-50 border-t flex flex-wrap justify-between items-center gap-2 text-xs text-gray-500 no-print">
                    <span id="parent-cards-page-stats">全班預計產生 A4 列印頁面</span>
                    <div class="flex items-center gap-2">
                        <button onclick="downloadParentCardsPDF()" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-2xs transition active:scale-95 cursor-pointer">📥 儲存 PDF 檔</button>
                        <button onclick="printParentCardsA4()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition active:scale-95 cursor-pointer">🖨️ 直接列印</button>
                        <button onclick="closeParentCardsModal()" class="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition active:scale-95 cursor-pointer">關閉視窗</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        // 確保舊快取建立的 modal 也具備儲存 PDF 與新版列印按鈕
        const oldPrintBtn = modal.querySelector('button[onclick="window.print()"]');
        if (oldPrintBtn) {
            oldPrintBtn.setAttribute('onclick', 'printParentCardsA4()');
            oldPrintBtn.id = 'btn-modal-print-a4';
            if (!modal.querySelector('#btn-modal-download-pdf')) {
                const dlBtn = document.createElement('button');
                dlBtn.id = 'btn-modal-download-pdf';
                dlBtn.setAttribute('onclick', 'downloadParentCardsPDF()');
                dlBtn.className = 'bg-amber-400 hover:bg-amber-300 text-amber-950 font-black px-3.5 py-2 rounded-xl text-sm shadow transition active:scale-95 flex items-center gap-1 cursor-pointer';
                dlBtn.innerHTML = '<span>📥 儲存 PDF (A4)</span>';
                oldPrintBtn.parentNode.insertBefore(dlBtn, oldPrintBtn);
            }
        }
    }

    const modalDensitySelect = document.getElementById('modal-parent-card-density');
    if (modalDensitySelect) {
        modalDensitySelect.value = String(cardsPerPage);
    }
    syncModalCustomInputs();

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    await renderParentCardsContent(studentIds, cardsPerPage);
}

function closeParentCardsModal() {
    const modal = document.getElementById('parent-cards-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function renderParentCardsContent(studentIds, cardsPerPage) {
    const container = document.getElementById('parent-cards-print-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10 text-gray-500 font-bold">正在生成 QR Code 排版中...</div>';

    const pool = db.students.filter(s => studentIds.includes(s.id));
    const totalStudents = pool.length;
    const totalPages = Math.ceil(totalStudents / cardsPerPage);

    const statsEl = document.getElementById('parent-cards-page-stats');
    if (statsEl) {
        statsEl.innerText = `全班共 ${totalStudents} 位學生 ‧ 預計產生 ${totalPages} 頁 A4 (每頁 ${cardsPerPage} 張)`;
    }

    let classLabel = '本班級';
    try {
        const cls = appConfig.classes ? appConfig.classes.find(c => c.id === appConfig.activeClassId) : null;
        if (cls && cls.label) classLabel = cls.label;
    } catch(e) {}

    const currentPath = window.location.pathname;
    let basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const parentBaseUrl = window.location.origin + basePath + 'parent.html';

    const gas = appConfig.gasUrl || '';
    let apiParam = '';
    if (gas && gas.includes('/macros/s/')) {
        apiParam = gas.split('/macros/s/')[1].split('/')[0];
    }

    const cfg = getParentCardConfig();

    // 精準調校 A4 (794x1123px) 內各密度的高度與字級，確保 6張/8張/4張 絕不超出單頁高度
    let gridClass = 'grid-cols-2 grid-rows-3 gap-3';
    let qrPixelSize = 240;
    let qrDisplaySize = 95;
    let cardPadding = 'p-2.5';
    let nameSize = 'text-xl';
    let stepPadding = 'p-1.5';
    let stepTextSize = 'text-[9.5px]';
    let middlePy = 'py-1';
    let bottomSpace = 'space-y-1 pt-1.5';

    if (cardsPerPage === 8) {
        gridClass = 'grid-cols-2 grid-rows-4 gap-2';
        qrPixelSize = 200;
        qrDisplaySize = 72;
        cardPadding = 'p-2';
        nameSize = 'text-lg';
        stepPadding = 'p-1';
        stepTextSize = 'text-[8.5px]';
        middlePy = 'py-0.5';
        bottomSpace = 'space-y-1 pt-1';
    } else if (cardsPerPage === 4) {
        gridClass = 'grid-cols-2 grid-rows-2 gap-4';
        qrPixelSize = 300;
        qrDisplaySize = 128;
        cardPadding = 'p-4';
        nameSize = 'text-3xl';
        stepPadding = 'p-2.5';
        stepTextSize = 'text-xs';
        middlePy = 'py-2';
        bottomSpace = 'space-y-2 pt-2';
    }

    container.innerHTML = '';

    if (window.location.protocol === 'file:') {
        container.innerHTML += `
            <div class="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold mb-4 no-print flex items-center gap-2">
                <span class="text-lg">🚨</span>
                <span>注意：您目前以本地檔案模式 (file://) 開啟，產生的 QR Code 為本機電腦路徑，家長手機無法連線！請務必部署至 GitHub Pages 後再列印發放！</span>
            </div>
        `;
    } else if (!gas) {
        container.innerHTML += `
            <div class="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 font-bold mb-4 no-print flex items-center gap-2">
                <span class="text-lg">⚠️</span>
                <span>溫馨提醒：尚未設定 Google 試算表 GAS 網址！若未設定雲端 API，家長手機掃碼後將無法連線讀取即時作業資料。請先至【0. 資料建置】填入 GAS 網址！</span>
            </div>
        `;
    }

    for (let p = 0; p < totalPages; p++) {
        const start = p * cardsPerPage;
        const pageStudents = pool.slice(start, start + cardsPerPage);

        const sheetEl = document.createElement('div');
        sheetEl.className = 'a4-print-sheet flex flex-col justify-between';

        const gridEl = document.createElement('div');
        gridEl.className = `grid ${gridClass} flex-1 min-h-0`;
        sheetEl.appendChild(gridEl);

        for (const st of pageStudents) {
            const token = st.token || ('STU' + String(st.id).padStart(3, '0'));
            const queryUrl = `${parentBaseUrl}?t=${encodeURIComponent(token)}${apiParam ? '&a=' + apiParam : ''}`;

            let qrDataUrl = '';
            try {
                qrDataUrl = await QRCode.toDataURL(queryUrl, {
                    width: qrPixelSize,
                    margin: 1,
                    errorCorrectionLevel: 'M'
                });
            } catch(e) {
                console.warn('QR code gen error:', e);
            }

            const card = document.createElement('div');
            card.className = `border-2 border-dashed border-slate-300 rounded-2xl ${cardPadding} bg-white flex flex-col justify-between relative shadow-2xs h-full min-h-0 overflow-hidden`;
            card.innerHTML = `
                <!-- 頂部標頭 (強制單行不換行) -->
                <div class="flex justify-between items-center gap-1 border-b border-slate-200 pb-1 flex-shrink-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 select-none whitespace-nowrap shrink-0">${escapeCardHtml(classLabel)}</span>
                        <span class="card-editable-title text-xs sm:text-sm font-black text-slate-800 tracking-tight cursor-text whitespace-nowrap truncate" contenteditable="true" spellcheck="false" title="點擊可直接修改全班標題" oninput="handleCardDirectEdit('title', this)">${escapeCardHtml(cfg.title)}</span>
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono flex items-center gap-0.5 select-none whitespace-nowrap shrink-0">✂️ 裁切發放</span>
                </div>
                
                <!-- 中間核心資訊 (學生姓名、座號、查詢代碼與大 QR Code) -->
                <div class="flex items-center justify-between gap-2.5 ${middlePy} flex-1 min-h-0">
                    <div class="space-y-1 flex-1 min-w-0 flex flex-col justify-center">
                        <div class="${nameSize} font-black text-slate-900 tracking-tight leading-tight truncate">${escapeCardHtml(st.name)}</div>
                        <div class="text-xs font-bold text-slate-600 flex items-center gap-1 whitespace-nowrap">
                            <span>座號：</span>
                            <span class="font-mono text-sm font-black text-slate-900">${String(st.id).padStart(2, '0')} 號</span>
                        </div>
                        <div class="bg-emerald-50/90 border border-emerald-300 rounded-xl px-2.5 py-0.5 inline-block shadow-2xs self-start">
                            <div class="text-[9px] text-emerald-800 font-bold leading-tight whitespace-nowrap">專屬查詢代碼</div>
                            <div class="text-xs sm:text-sm font-mono font-black text-emerald-950 tracking-wider leading-tight whitespace-nowrap">${escapeCardHtml(token)}</div>
                        </div>
                    </div>
                    <div class="flex-shrink-0 flex flex-col items-center justify-center p-1 bg-white border border-slate-200 rounded-xl shadow-xs">
                        <img src="${qrDataUrl}" width="${qrDisplaySize}" height="${qrDisplaySize}" alt="QR" class="rounded">
                        <span class="text-[8.5px] text-slate-400 font-bold mt-0.5 select-none whitespace-nowrap">相機掃描免帳密</span>
                    </div>
                </div>

                <!-- 底部指引：如何查詢、如何綁定與導師叮嚀 -->
                <div class="${bottomSpace} border-t border-slate-100 flex-shrink-0">
                    <div class="bg-slate-50/90 border border-slate-200/80 rounded-lg ${stepPadding} flex items-start gap-1.5">
                        <div class="w-4 h-4 rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0 mt-0.5 shadow-2xs select-none">
                            1
                        </div>
                        <div class="${stepTextSize} text-slate-700 leading-tight card-editable-step1 cursor-text" contenteditable="true" spellcheck="false" title="點擊可直接修改步驟一說明" oninput="handleCardDirectEdit('step1', this)">${escapeCardHtml(cfg.step1)}</div>
                    </div>
                    <div class="bg-slate-50/90 border border-slate-200/80 rounded-lg ${stepPadding} flex items-start gap-1.5">
                        <div class="w-4 h-4 rounded-md bg-blue-500 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0 mt-0.5 shadow-2xs select-none">
                            2
                        </div>
                        <div class="${stepTextSize} text-slate-700 leading-tight card-editable-step2 cursor-text" contenteditable="true" spellcheck="false" title="點擊可直接修改步驟二說明" oninput="handleCardDirectEdit('step2', this)">${escapeCardHtml(cfg.step2)}</div>
                    </div>
                    <div class="bg-amber-50/70 border border-amber-200/70 rounded-lg ${stepPadding} flex items-start gap-1.5">
                        <div class="w-4 h-4 rounded-md bg-amber-500 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0 mt-0.5 shadow-2xs select-none">
                            💡
                        </div>
                        <div class="${stepTextSize} text-amber-950 leading-tight card-editable-note font-medium cursor-text" contenteditable="true" spellcheck="false" title="點擊可直接修改導師叮嚀" oninput="handleCardDirectEdit('note', this)">${escapeCardHtml(cfg.note)}</div>
                    </div>
                </div>
            `;
            gridEl.appendChild(card);
        }

        const footerEl = document.createElement('div');
        footerEl.className = 'text-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-200 mt-1.5 flex justify-between items-center flex-shrink-0';
        footerEl.innerHTML = `
            <span>✂️ 請沿虛線裁切發給家長</span>
            <span class="font-bold text-slate-600">第 ${p + 1} / ${totalPages} 頁 ‧ 👨‍👩‍👧【家長發放版】(每頁 ${cardsPerPage} 張)</span>
            <span>QRcode 自動清點作業系統</span>
        `;
        sheetEl.appendChild(footerEl);
        container.appendChild(sheetEl);
    }
}

// 將預覽視窗中的所有 .a4-print-sheet 轉為高解析度多頁 A4 PDF Blob
async function buildParentCardsPdfBlob(onProgress) {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    const container = document.getElementById('parent-cards-print-container');
    if (!container) throw new Error('找不到小卡預覽容器');
    const sheets = Array.from(container.querySelectorAll('.a4-print-sheet'));
    if (sheets.length === 0) throw new Error('目前沒有可匯出的小卡頁面');

    if (typeof html2canvas === 'undefined') {
        throw new Error('正在載入 PDF 轉換元件，請重新整理網頁後再試一次');
    }

    const pdfDoc = await PDFLib.PDFDocument.create();
    const a4W = 595.28;
    const a4H = 841.89;

    for (let i = 0; i < sheets.length; i++) {
        if (typeof onProgress === 'function') {
            onProgress(i + 1, sheets.length);
        }
        const sheet = sheets[i];
        const canvas = await html2canvas(sheet, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 794,
            height: 1123
        });
        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const jpgBytes = await fetch(jpgDataUrl).then(r => r.arrayBuffer());
        const jpgImg = await pdfDoc.embedJpg(jpgBytes);
        const page = pdfDoc.addPage([a4W, a4H]);
        page.drawImage(jpgImg, {
            x: 0,
            y: 0,
            width: a4W,
            height: a4H
        });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
}

// 儲存/下載家長專屬查詢小卡 A4 PDF
async function downloadParentCardsPDF() {
    const btn = document.getElementById('btn-modal-download-pdf');
    const origHtml = btn ? btn.innerHTML : '';
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ 產生 PDF 中...</span>';
        }
        showToast('正在為您產生高畫質 A4 PDF，請稍候...', 'info');

        const blob = await buildParentCardsPdfBlob((curr, total) => {
            if (btn) btn.innerHTML = `<span>⏳ 轉換第 ${curr}/${total} 頁...</span>`;
        });

        let classLabel = '全班';
        try {
            const cls = appConfig.classes ? appConfig.classes.find(c => c.id === appConfig.activeClassId) : null;
            if (cls && cls.label) classLabel = cls.label;
        } catch(e) {}

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `作業繳交狀況查詢卡_${classLabel}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        showToast('✅ PDF 檔案已成功下載！', 'success');
    } catch (err) {
        console.error('downloadParentCardsPDF error:', err);
        showAlert('匯出 PDF 失敗', err.message || String(err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<span>📥 儲存 PDF (A4)</span>';
        }
    }
}

// 從 Tab 8 直接開啟預覽並自動下載 PDF
async function downloadParentCardsPDFFromTab8() {
    const density = parseInt(document.getElementById('parent-tab-card-density').value, 10) || 6;
    const checkedIds = Array.from(document.querySelectorAll('.parent-tab-stu-cb:checked')).map(cb => parseInt(cb.value, 10));
    if (checkedIds.length === 0) {
        showAlert('提示', '請至少勾選一位學生！');
        return;
    }
    await previewParentCardsModal(checkedIds, density);
    await downloadParentCardsPDF();
}

// 直接列印 (A4)：產生精準 A4 PDF 並透過瀏覽器內建 PDF 列印引擎列印 (避免網頁滾動條截斷)
async function printParentCardsA4() {
    const btn = document.getElementById('btn-modal-print-a4');
    const origHtml = btn ? btn.innerHTML : '';
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ 準備列印頁面...</span>';
        }
        const blob = await buildParentCardsPdfBlob((curr, total) => {
            if (btn) btn.innerHTML = `<span>⏳ 排版第 ${curr}/${total} 頁...</span>`;
        });
        const pdfUrl = URL.createObjectURL(blob);

        let printFrame = document.getElementById('parent-cards-pdf-print-frame');
        if (printFrame) printFrame.remove();
        printFrame = document.createElement('iframe');
        printFrame.id = 'parent-cards-pdf-print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        printFrame.src = pdfUrl;
        document.body.appendChild(printFrame);

        printFrame.onload = () => {
            setTimeout(() => {
                try {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.print();
                } catch (e) {
                    window.print();
                }
            }, 300);
        };
    } catch (err) {
        console.warn('PDF print fallback to window.print():', err);
        window.print();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<span>🖨️ 直接列印 (A4)</span>';
        }
    }
}

// ==========================================
// Tab 8: 家長手札與專屬查詢小卡中心
// ==========================================
let currentSimulatorStudentId = null;

function renderParentTab() {
    const cls = appConfig.classes ? appConfig.classes.find(c => c.id === appConfig.activeClassId) : null;
    const classLabel = cls ? cls.label : '目前班級';
    const labelEl = document.getElementById('parent-tab-class-label');
    if (labelEl) labelEl.innerText = classLabel;

    // 1. 渲染學生勾選框清單
    const selector = document.getElementById('parent-tab-students-selector');
    if (selector) {
        selector.innerHTML = '';
        db.students.forEach(s => {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-1.5 p-1.5 hover:bg-white rounded cursor-pointer border border-transparent hover:border-slate-200 transition';
            label.innerHTML = `
                <input type="checkbox" value="${s.id}" checked class="parent-tab-stu-cb rounded text-emerald-600 focus:ring-emerald-500" onchange="updateParentTabSelectedCount()">
                <span class="font-bold text-slate-700">${String(s.id).padStart(2, '0')} ${s.name}</span>
            `;
            selector.appendChild(label);
        });
        updateParentTabSelectedCount();
    }

    // 2. 渲染全班 Token 代碼表
    const tbody = document.getElementById('parent-tab-tokens-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        const gas = appConfig.gasUrl || '';
        let apiParam = '';
        if (gas && gas.includes('/macros/s/')) {
            apiParam = gas.split('/macros/s/')[1].split('/')[0];
        }
        const currentPath = window.location.pathname;
        let basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        const parentBaseUrl = window.location.origin + basePath + 'parent.html';

        db.students.forEach(s => {
            const token = s.token || ('STU' + String(s.id).padStart(3, '0'));
            const directUrl = `${parentBaseUrl}?t=${encodeURIComponent(token)}${apiParam ? '&a=' + apiParam : ''}`;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-2 text-center font-bold text-slate-500">${String(s.id).padStart(2, '0')}</td>
                <td class="p-2 font-bold text-slate-800">${s.name}</td>
                <td class="p-2 font-mono font-bold text-emerald-700 bg-emerald-50/50 rounded px-1.5 py-0.5">${token}</td>
                <td class="p-2 text-center space-x-1">
                    <button onclick="navigator.clipboard.writeText('${directUrl}').then(() => showToast('已複製 ${s.name} 專屬手札網址！', 'success'))" class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold active:scale-95 transition cursor-pointer">複製</button>
                    <a href="${directUrl}" target="_blank" class="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition inline-block">開啟</a>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 3. 渲染手機模擬器學生下拉選單
    const sel = document.getElementById('parent-simulator-student-select');
    if (sel) {
        sel.innerHTML = '';
        db.students.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.innerText = `${String(s.id).padStart(2, '0')} ${s.name}`;
            sel.appendChild(opt);
        });
        if (db.students.length > 0) {
            updateParentSimulator(db.students[0].id);
        } else {
            const frame = document.getElementById('parent-simulator-frame');
            if (frame) frame.innerHTML = '<div class="py-10 text-center text-slate-400 font-bold">目前班級尚無學生資料</div>';
        }
    }

    // 4. 自動載入 LINE 官方帳號推播與綁定狀態
    if (typeof fetchLineBindingStatus === 'function') {
        fetchLineBindingStatus();
    }

    // 5. 同步小卡自訂文字至 Tab 8 面板輸入框
    syncTab8CustomInputs();
}

function updateParentTabSelectedCount() {
    const total = db.students.length;
    const checked = document.querySelectorAll('.parent-tab-stu-cb:checked').length;
    const el = document.getElementById('parent-tab-selected-count');
    if (el) el.innerText = `已勾選 ${checked} / ${total} 人`;
}

function selectAllParentTabStudents(check) {
    document.querySelectorAll('.parent-tab-stu-cb').forEach(cb => cb.checked = check);
    updateParentTabSelectedCount();
}

function previewParentCardsFromTab8() {
    const density = parseInt(document.getElementById('parent-tab-card-density').value, 10) || 6;
    const checkedIds = Array.from(document.querySelectorAll('.parent-tab-stu-cb:checked')).map(cb => parseInt(cb.value, 10));
    if (checkedIds.length === 0) {
        showAlert('提示', '請至少勾選一位學生！');
        return;
    }
    previewParentCardsModal(checkedIds, density);
}

// 學生姓名去識別化函式（個資法保護規範：三個字中間變圈圈，兩個字第二個字變圈圈）
function maskStudentName(name) {
    if (!name) return '';
    const s = name.toString().trim();
    if (s.length <= 1) return s;
    if (s.length === 2) {
        return s.charAt(0) + '○';
    }
    if (s.length === 3) {
        return s.charAt(0) + '○' + s.charAt(2);
    }
    let mid = '';
    for (let i = 1; i < s.length - 1; i++) {
        mid += '○';
    }
    return s.charAt(0) + mid + s.charAt(s.length - 1);
}

// 通用家長端作業狀態分類器
function classifyParentTaskStatus(statusStr, timestamp, deadline) {
    const s = (statusStr || '').toString().trim();
    const ts = (timestamp || '').toString().trim();

    // 1. 缺交 / 未交 (Missing)
    if (
        s === '缺交' || s === '未交' || s === 'missing' || s === '曠課' ||
        s.includes('leave_custom_缺交') || s.includes('leave_custom_未交') ||
        s === ''
    ) {
        return {
            type: 'missing',
            label: '缺交',
            badge: '❌ 缺交',
            badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
            isPending: true
        };
    }

    // 2. 沒帶 (Forgot)
    if (s === '沒帶' || s === 'forgot' || s.includes('leave_custom_沒帶')) {
        return {
            type: 'forgot',
            label: '沒帶',
            badge: '🎒 聯絡簿沒帶',
            badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            isPending: true
        };
    }

    // 3. 退回待訂正 (Returned)
    if (s === '退回' || s === 'returned' || s.includes('訂正') || s.includes('重交')) {
        return {
            type: 'returned',
            label: '待訂正',
            badge: '⚠️ 需訂正重交',
            badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
            isPending: true
        };
    }

    // 4. 請假 / 免計入分母 (Excused Leaves)
    const standardLeaves = ['事假', '病假', '公假', '喪假', '免交', '請假', '其他假別', '其他'];
    const isLeave = standardLeaves.includes(s) || (
        s.startsWith('leave_') &&
        !s.includes('曠課') && !s.includes('遲到') && !s.includes('沒帶') && !s.includes('缺交')
    );
    if (isLeave) {
        let leaveName = s.replace(/^leave_custom_/, '').replace(/^leave_/, '');
        if (!leaveName || leaveName === '其他') leaveName = '請假免交';
        return {
            type: 'excused',
            label: leaveName,
            badge: leaveName,
            badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
            isPending: false
        };
    }

    // 5. 遲交 (Late)
    let isLate = false;
    if (s === '遲交' || s === 'late' || s.includes('[遲交]') || s.includes('遲交')) {
        isLate = true;
    } else if (deadline && ts) {
        try {
            const dl = new Date(deadline + 'T23:59:59');
            let scDate = null;
            if (ts.includes('T') || ts.includes('-')) {
                scDate = new Date(ts);
            } else {
                const year = new Date().getFullYear();
                scDate = new Date(`${year}/${ts}`);
            }
            if (scDate && !isNaN(scDate.getTime()) && scDate > dl) {
                isLate = true;
            }
        } catch(e) {}
    }

    if (isLate) {
        return {
            type: 'late',
            label: '遲交',
            badge: '⏰ 遲交',
            badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
            isPending: false
        };
    }

    // 6. 準時繳交 (On-time)
    return {
        type: 'ontime',
        label: '準時',
        badge: '✅ 準時',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        isPending: false
    };
}

function updateParentSimulator(studentId) {
    currentSimulatorStudentId = parseInt(studentId, 10);
    const frame = document.getElementById('parent-simulator-frame');
    if (!frame) return;

    const student = db.students.find(s => s.id === currentSimulatorStudentId);
    if (!student) {
        frame.innerHTML = '<div class="py-10 text-center text-slate-400 font-bold">查無該生資料</div>';
        return;
    }

    const token = student.token || ('STU' + String(student.id).padStart(3, '0'));
    const tasks = db.tasks || [];
    const records = db.records || [];
    const ranges = db.ranges || [];

    // 計算各作業狀況 (排除從未掃描統計過、且未設定範圍的作業)
    const studentTasks = [];
    tasks.forEach(t => {
        // 檢查全班是否有任何繳交打卡紀錄
        const hasAnyRecord = (records || []).some(r => r.taskId === t.id);
        // 檢查是否有設定範圍或日期
        const hasAnyRange = (ranges || []).some(r => r.taskId === t.id && (r.range || r.date));

        // 若全班完全沒有任何掃描/打卡紀錄，且未設定範圍日期，表示尚未開始清點，不計入準時率與待辦
        if (!hasAnyRecord && !hasAnyRange) {
            return;
        }

        let noticeNames = [...new Set(records.filter(r => r.taskId === t.id).map(r => r.noticeName || ''))];
        if (ranges) {
            const rangeNotices = ranges.filter(r => r.taskId === t.id && (r.range || r.date)).map(r => r.noticeName || '');
            rangeNotices.forEach(rn => { if (!noticeNames.includes(rn)) noticeNames.push(rn); });
        }
        if (noticeNames.length === 0) noticeNames = [''];

        noticeNames.forEach(nn => {
            // 確認該子項目在全班是否有紀錄或範圍
            const subHasRecord = (records || []).some(r => r.taskId === t.id && (r.noticeName || '') === nn);
            const subHasRange = (ranges || []).some(r => r.taskId === t.id && (r.noticeName || '') === nn && (r.range || r.date));
            if (!subHasRecord && !subHasRange) return;

            const rec = records.find(r => r.studentId === student.id && r.taskId === t.id && (r.noticeName || '') === nn);
            let status = '缺交';
            let timestamp = '';
            if (rec) {
                status = rec.manualStatus || '已交';
                timestamp = rec.timestamp || rec.fullTimestamp || '';
            }
            let range = '';
            let dueDate = nn || '近期';
            const rObj = ranges.find(r => r.taskId === t.id && (r.noticeName || '') === nn);
            if (rObj) {
                range = rObj.range || nn || '';
                if (rObj.date) dueDate = rObj.date;
            } else if (nn) {
                range = nn;
            }

            studentTasks.push({
                subject: t.subject || '其他',
                taskName: t.name,
                range: range,
                date: dueDate,
                status: status,
                timestamp: timestamp,
                deadline: t.deadline || ''
            });
        });
    });

    // 統計計算 (採用統一分類標準)
    let totalAssigned = studentTasks.length;
    let onTimeCount = 0;
    let lateCount = 0;
    let missingCount = 0;
    let forgotCount = 0;
    let returnedCount = 0;
    let excusedCount = 0;
    const pendingItems = [];
    const lateCountsPerTask = {};
    const lateDetailsPerTask = {};

    studentTasks.forEach(t => {
        const c = classifyParentTaskStatus(t.status, t.timestamp, t.deadline);
        if (c.type === 'ontime') {
            onTimeCount++;
        } else if (c.type === 'late') {
            lateCount++;
            const key = `[${t.subject}] ${t.taskName}`;
            lateCountsPerTask[key] = (lateCountsPerTask[key] || 0) + 1;
            if (!lateDetailsPerTask[key]) lateDetailsPerTask[key] = [];
            lateDetailsPerTask[key].push(t.range || (t.date !== '近期' ? t.date : '日常作業'));
        } else if (c.type === 'missing') {
            missingCount++;
            pendingItems.push({ subject: t.subject, taskName: t.taskName, range: t.range, date: t.date, badge: c.badge });
        } else if (c.type === 'forgot') {
            forgotCount++;
            pendingItems.push({ subject: t.subject, taskName: t.taskName, range: t.range, date: t.date, badge: c.badge });
        } else if (c.type === 'returned') {
            returnedCount++;
            pendingItems.push({ subject: t.subject, taskName: t.taskName, range: t.range, date: t.date, badge: c.badge });
        } else if (c.type === 'excused') {
            excusedCount++;
        }
    });

    const effTotal = Math.max(1, totalAssigned - excusedCount);
    const onTimeRate = totalAssigned > 0 ? Math.round((onTimeCount / effTotal) * 100) : 100;
    const totalSubmitted = onTimeCount + lateCount;
    const submittedRate = totalAssigned > 0 ? Math.round((totalSubmitted / effTotal) * 100) : 100;
    const totalMissing = missingCount + forgotCount;
    const delayEntries = Object.entries(lateCountsPerTask).sort((a, b) => b[1] - a[1]);

    // 依科目群組化
    const groupedSubjects = {};
    studentTasks.forEach(t => {
        const sub = t.subject || '其他';
        if (!groupedSubjects[sub]) groupedSubjects[sub] = [];
        groupedSubjects[sub].push(t);
    });

    let subjectsHtml = '';
    Object.entries(groupedSubjects).forEach(([sub, subTasks], idx) => {
        const sTotal = subTasks.length;
        let sOnTime = 0;
        let sLate = 0;
        let sMiss = 0;
        let sExc = 0;
        const taskMap = {};

        subTasks.forEach(st => {
            const tn = st.taskName;
            if (!taskMap[tn]) taskMap[tn] = { total: 0, ontime: 0, late: 0, miss: 0, exc: 0, items: [] };
            taskMap[tn].total++;
            
            const c = classifyParentTaskStatus(st.status, st.timestamp, st.deadline);
            taskMap[tn].items.push({
                range: st.range,
                date: st.date,
                status: st.status,
                timestamp: st.timestamp,
                c: c
            });
            if (c.type === 'ontime') {
                sOnTime++;
                taskMap[tn].ontime++;
            } else if (c.type === 'late') {
                sLate++;
                taskMap[tn].late++;
            } else if (c.type === 'excused') {
                sExc++;
                taskMap[tn].exc++;
            } else {
                sMiss++;
                taskMap[tn].miss++;
            }
        });

        const sEff = Math.max(1, sTotal - sExc);
        const sRate = Math.round((sOnTime / sEff) * 100);
        const simAccId = 'sim-acc-' + idx;

        let details = '';
        Object.entries(taskMap).forEach(([tn, ts], tIdx) => {
            const trEff = Math.max(1, ts.total - ts.exc);
            const tr = Math.round((ts.ontime / trEff) * 100);
            const taskDetailId = `sim-task-detail-${idx}-${tIdx}`;

            // 排序子項目：缺交/沒帶/需訂正 -> 遲交 -> 免計 -> 準時
            const orderWeight = { missing: 1, forgot: 1, returned: 1, late: 2, excused: 3, ontime: 4 };
            const sortedItems = ts.items.slice().sort((a, b) => (orderWeight[a.c.type] || 5) - (orderWeight[b.c.type] || 5));

            const itemRowsHtml = sortedItems.map((it, iIdx) => {
                const labelText = it.range ? `範圍：${escapeCardHtml(it.range)}` : (it.date && it.date !== '近期' ? `日期：${escapeCardHtml(it.date)}` : `第 ${iIdx + 1} 次作業`);
                const dateSub = (it.range && it.date && it.date !== '近期' && it.date !== it.range) ? ` ‧ 應繳：${escapeCardHtml(it.date)}` : '';
                const cleanTs = (it.timestamp || '').replace(/\[遲交\]/g, '').trim();
                const tsSub = (cleanTs && it.c.type !== 'missing' && it.c.type !== 'forgot' && it.c.type !== 'excused') ? `<div class="text-[9px] text-slate-400">登記時間：${escapeCardHtml(cleanTs)}</div>` : '';
                const rowBg = it.c.type === 'late' ? 'bg-amber-50/70 border-amber-200' : (it.c.isPending ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50/80 border-slate-100');

                return `
                    <div class="p-1.5 rounded-lg border ${rowBg} flex items-center justify-between gap-1.5 text-[10px]">
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-slate-700 truncate">${labelText}${dateSub}</div>
                            ${tsSub}
                        </div>
                        <span class="px-1.5 py-0.5 rounded border text-[9px] font-bold flex-shrink-0 ${it.c.badgeClass}">${it.c.badge}</span>
                    </div>
                `;
            }).join('');

            details += `
                <div class="bg-white rounded-lg border border-slate-100 overflow-hidden">
                    <button type="button" onclick="toggleSimTaskDetail('${taskDetailId}')" class="w-full flex items-center justify-between text-[11px] p-1.5 hover:bg-slate-50 transition cursor-pointer text-left">
                        <div class="flex items-center gap-1">
                            <span class="font-bold text-slate-700">${escapeCardHtml(tn)}</span>
                            <span class="text-[9px] text-slate-400">(${ts.ontime}/${trEff})</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="font-bold ${tr >= 90 ? 'text-emerald-600' : (tr >= 80 ? 'text-amber-600' : 'text-rose-600')}">${tr}%</span>
                            ${ts.late > 0 ? '<span class="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded font-bold">遲' + ts.late + '</span>' : ''}
                            ${ts.miss > 0 ? '<span class="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-1 rounded font-bold">缺' + ts.miss + '</span>' : ''}
                            ${ts.exc > 0 ? '<span class="text-[9px] bg-slate-100 text-slate-600 px-1 rounded">免' + ts.exc + '</span>' : ''}
                            <svg id="${taskDetailId}-arrow" class="w-3 h-3 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </button>
                    <div id="${taskDetailId}" class="hidden p-1.5 pt-1 space-y-1 bg-white border-t border-slate-100">
                        ${itemRowsHtml}
                    </div>
                </div>
            `;
        });

        subjectsHtml += `
            <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button type="button" onclick="toggleSimAccordion('${simAccId}')" class="w-full p-2.5 flex flex-col gap-1 text-left hover:bg-slate-50 transition active:scale-[0.99] cursor-pointer">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-black text-slate-800">${sub}</span>
                        <span class="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">${sRate}% 準時</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="${sRate >= 90 ? 'bg-emerald-500' : (sRate >= 80 ? 'bg-amber-500' : 'bg-rose-500')} h-1.5 rounded-full transition-all duration-500" style="width: ${sRate}%"></div>
                    </div>
                </button>
                <div id="${simAccId}" class="accordion-panel border-t border-transparent">
                    <div>
                        <div class="p-2 pt-1.5 space-y-1 bg-slate-50/50 border-t border-slate-100">
                            <div class="text-[9px] text-slate-400 px-0.5">💡 點擊下方任一作業可展開查看哪幾份遲交或各次明細：</div>
                            ${details}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    const simNow = new Date();
    const simWeekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const simW = simWeekdays[simNow.getDay()];
    const simDateStr = `${simNow.getFullYear()}/${String(simNow.getMonth() + 1).padStart(2, '0')}/${String(simNow.getDate()).padStart(2, '0')} (${simW}) ${simNow.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;

    frame.innerHTML = `
        <!-- 手機頂部英雄卡 -->
        <div class="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex justify-between items-center">
            <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-xs">
                    ${String(student.id).padStart(2, '0')}
                </div>
                <div>
                    <div class="text-sm font-black text-slate-900">${maskStudentName(student.name)}</div>
                </div>
            </div>
            <div class="text-right">
                <span class="inline-flex items-center gap-1 text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    即時同步 ${simDateStr}
                </span>
            </div>
        </div>

        <!-- 三大指標 -->
        <div class="grid grid-cols-3 gap-1.5 text-center">
            <div class="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                <div class="text-[10px] text-slate-400 font-bold">準時率</div>
                <div class="text-base font-black ${onTimeRate >= 90 ? 'text-emerald-600' : (onTimeRate >= 80 ? 'text-amber-600' : 'text-rose-600')} mt-0.5">${onTimeRate}%</div>
            </div>
            <div class="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                <div class="text-[10px] text-slate-400 font-bold">已準時交</div>
                <div class="text-xs font-black text-slate-800 mt-0.5">${onTimeCount} / ${effTotal}</div>
                <div class="text-[9px] text-slate-400">${lateCount > 0 ? `遲${lateCount} ‧ ` : ''}缺${totalMissing}</div>
            </div>
            <div class="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                <div class="text-[10px] text-slate-400 font-bold">待補交</div>
                <div class="text-base font-black ${pendingItems.length > 0 ? 'text-rose-600' : 'text-emerald-600'}">${pendingItems.length}</div>
                <div class="text-[9px] ${pendingItems.length > 0 ? 'text-rose-500 font-bold' : 'text-emerald-500'}">${pendingItems.length > 0 ? '待補交' : '全數交齊'}</div>
            </div>
        </div>

        <!-- 🚨 待補交作業清單 -->
        <div class="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-2xs space-y-1.5">
            <div class="flex justify-between items-center text-[11px] font-black text-slate-800 border-b pb-1">
                <span>🚨 待補交作業清單</span>
                <span class="text-[10px] text-rose-600 font-bold">${pendingItems.length} 項</span>
            </div>
            ${pendingItems.length === 0 ? '<div class="text-[11px] text-emerald-600 font-bold py-1.5 text-center">沒有任何缺交作業，請給孩子一個大大的讚賞與鼓勵！ 🎉</div>' : ''}
            ${pendingItems.map(p => `
                <div class="flex items-center justify-between text-[11px] py-0.5">
                    <span class="font-bold text-slate-700">[${p.subject}] ${p.taskName}${p.range ? ' (' + escapeCardHtml(p.range) + ')' : ''}</span>
                    <span class="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold">${p.badge}</span>
                </div>
            `).join('')}
        </div>

        <!-- ⚠️ 常遲到作業排行 -->
        <div class="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-2xs space-y-1.5">
            <div class="text-[11px] font-black text-slate-800 border-b pb-1">⚠️ 常遲到作業排行</div>
            ${delayEntries.length === 0 ? '<div class="text-[11px] text-slate-400 py-1 text-center font-bold">目前無任何遲到紀錄 模範生！</div>' : ''}
            ${delayEntries.slice(0, 3).map(([taskKey, count], idx) => `
                <div class="flex flex-col text-[11px] py-0.5 border-b border-slate-50 last:border-0">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-700">#${idx + 1} ${taskKey}</span>
                        <span class="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">遲交 ${count} 次</span>
                    </div>
                    ${lateDetailsPerTask[taskKey] && lateDetailsPerTask[taskKey].length > 0 ? `<div class="text-[9.5px] text-amber-700 mt-0.5 pl-2">↳ 遲交項目：${lateDetailsPerTask[taskKey].map(d => escapeCardHtml(d)).join('、')}</div>` : ''}
                </div>
            `).join('')}
        </div>

        <!-- 📊 各科習慣與展開明細 -->
        <div class="space-y-1.5">
            <div class="text-[11px] font-black text-slate-800 px-1">📊 各科長條圖 (點擊科目與作業可查看明細)</div>
            ${subjectsHtml}
        </div>
    `;
}

function toggleSimAccordion(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('open');
}

function toggleSimTaskDetail(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById(id + '-arrow');
    if (!el) return;
    const isHidden = el.classList.contains('hidden');
    if (isHidden) {
        el.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
    } else {
        el.classList.add('hidden');
        if (arrow) arrow.classList.remove('rotate-180');
    }
}

function openSelectedStudentParentPage() {
    if (!currentSimulatorStudentId) {
        if (db.students.length > 0) currentSimulatorStudentId = db.students[0].id;
        else return;
    }
    const student = db.students.find(s => s.id === currentSimulatorStudentId);
    if (!student) return;

    const token = student.token || ('STU' + String(student.id).padStart(3, '0'));
    const gas = appConfig.gasUrl || '';
    let apiParam = '';
    if (gas && gas.includes('/macros/s/')) {
        apiParam = gas.split('/macros/s/')[1].split('/')[0];
    }
    const currentPath = window.location.pathname;
    let basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const directUrl = `${window.location.origin}${basePath}parent.html?t=${encodeURIComponent(token)}${apiParam ? '&a=' + apiParam : ''}`;
    window.open(directUrl, '_blank');
}

// ==========================================
// LINE 官方帳號推播中心邏輯
// ==========================================
let currentLineBindings = [];

// 取得單一學生目前待補交之作業清單
function getStudentPendingTasks(student) {
    if (!student) return [];
    const tasks = db.tasks || [];
    const records = db.records || [];
    const ranges = db.ranges || [];

    const pendingList = [];
    tasks.forEach(t => {
        const hasAnyRecord = (records || []).some(r => r.taskId === t.id);
        const hasAnyRange = (ranges || []).some(r => r.taskId === t.id && (r.range || r.date));
        if (!hasAnyRecord && !hasAnyRange) return;

        let noticeNames = [...new Set(records.filter(r => r.taskId === t.id).map(r => r.noticeName || ''))];
        if (ranges) {
            const rangeNotices = ranges.filter(r => r.taskId === t.id && (r.range || r.date)).map(r => r.noticeName || '');
            rangeNotices.forEach(rn => { if (!noticeNames.includes(rn)) noticeNames.push(rn); });
        }
        if (noticeNames.length === 0) noticeNames = [''];

        noticeNames.forEach(nn => {
            const subHasRecord = (records || []).some(r => r.taskId === t.id && (r.noticeName || '') === nn);
            const subHasRange = (ranges || []).some(r => r.taskId === t.id && (r.noticeName || '') === nn && (r.range || r.date));
            if (!subHasRecord && !subHasRange) return;

            const rec = records.find(r => r.studentId === student.id && r.taskId === t.id && (r.noticeName || '') === nn);
            let status = '缺交';
            let timestamp = '';
            if (rec) {
                status = rec.manualStatus || '已交';
                timestamp = rec.timestamp || rec.fullTimestamp || '';
            }
            let range = '';
            let dueDate = nn || '近期';
            const rObj = ranges.find(r => r.taskId === t.id && (r.noticeName || '') === nn);
            if (rObj) {
                range = rObj.range || nn || '';
                if (rObj.date) dueDate = rObj.date;
            } else if (nn) {
                range = nn;
            }

            const c = classifyParentTaskStatus(status, timestamp, t.deadline);
            if (c.type === 'missing' || c.type === 'forgot' || c.type === 'returned') {
                pendingList.push({
                    subject: t.subject || '其他',
                    taskName: t.name,
                    range: range,
                    date: dueDate,
                    status: status,
                    badge: c.badge
                });
            }
        });
    });
    return pendingList;
}

// 篩選出今日有缺交且已綁定 LINE 的學生名單（onlyChecked 為 true 時僅回傳教師有勾選的學生）
function getBoundStudentsWithMissing(boundMap, onlyChecked = false) {
    if (!boundMap) {
        boundMap = {};
        (currentLineBindings || []).forEach(b => {
            if (b.isBound) boundMap[b.studentId.toString()] = b;
        });
    }

    let checkedIdSet = null;
    if (onlyChecked) {
        const cbs = document.querySelectorAll('.line-missing-stu-cb');
        if (cbs.length > 0) {
            checkedIdSet = new Set(
                Array.from(document.querySelectorAll('.line-missing-stu-cb:checked')).map(cb => cb.value.toString())
            );
        }
    }

    const targets = [];
    (db.students || []).forEach(s => {
        const sidStr = s.id.toString();
        const binding = boundMap[sidStr];
        if (!binding) return; // 家長尚未綁定 LINE，跳過
        if (checkedIdSet && !checkedIdSet.has(sidStr)) return; // 教師取消勾選，跳過

        const missingTasks = getStudentPendingTasks(s);
        if (missingTasks.length > 0) {
            targets.push({
                studentId: s.id,
                studentName: s.name,
                token: s.token || ('STU' + String(s.id).padStart(3, '0')),
                lineUserId: binding.lineUserId,
                missingTasks: missingTasks
            });
        }
    });
    return targets;
}

// 渲染待補交且已綁定 LINE 之可勾選學生清單
function renderLineMissingTargetsSelector(targets) {
    const box = document.getElementById('line-missing-targets-box');
    const selector = document.getElementById('line-missing-targets-selector');
    const badge = document.getElementById('line-missing-selected-badge');
    if (!box || !selector) return;

    if (!targets || targets.length === 0) {
        box.classList.add('hidden');
        selector.innerHTML = '';
        if (badge) badge.classList.add('hidden');
        return;
    }

    box.classList.remove('hidden');
    selector.innerHTML = '';

    targets.forEach(t => {
        const summaryStr = t.missingTasks.map(m => `${m.taskName}${m.range ? '(' + m.range + ')' : ''}`).join('、');
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between gap-1.5 p-1.5 bg-white hover:bg-rose-50/60 rounded-lg border border-rose-200/80 transition';
        item.innerHTML = `
            <label class="flex items-center gap-1.5 cursor-pointer min-w-0 flex-1">
                <input type="checkbox" value="${t.studentId}" checked class="line-missing-stu-cb rounded text-rose-600 focus:ring-rose-500 flex-shrink-0" onchange="updateLineMissingSelectedCount()">
                <div class="min-w-0 flex-1">
                    <div class="font-bold text-slate-800 truncate">${String(t.studentId).padStart(2, '0')} ${escapeCardHtml(t.studentName)} <span class="text-rose-600 font-black">(${t.missingTasks.length}項)</span></div>
                    <div class="text-[10px] text-slate-500 truncate" title="${escapeCardHtml(summaryStr)}">${escapeCardHtml(summaryStr)}</div>
                </div>
            </label>
            <button type="button" onclick="openSingleStudentLinePushModal('${t.studentId}')" class="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[10px] font-bold flex-shrink-0 transition active:scale-95 cursor-pointer" title="只單獨發送給這位學生家長">
                📨 單發
            </button>
        `;
        selector.appendChild(item);
    });

    updateLineMissingSelectedCount();
}

function updateLineMissingSelectedCount() {
    const total = document.querySelectorAll('.line-missing-stu-cb').length;
    const checked = document.querySelectorAll('.line-missing-stu-cb:checked').length;
    const badge = document.getElementById('line-missing-selected-badge');
    const btn = document.getElementById('btn-send-line-push');
    if (badge) {
        if (total > 0) {
            badge.classList.remove('hidden');
            badge.innerText = `已勾選 ${checked} / ${total} 人`;
        } else {
            badge.classList.add('hidden');
        }
    }
    if (btn) {
        btn.innerHTML = checked > 0 && checked < total
            ? `<span>🚀 發送勾選學生 (${checked}人)</span>`
            : `<span>🚀 發送 LINE 缺交通知</span>`;
    }
}

function toggleAllLineMissingTargets(check) {
    document.querySelectorAll('.line-missing-stu-cb').forEach(cb => cb.checked = check);
    updateLineMissingSelectedCount();
}

// 單獨發送指定學生的 LINE 通知（支援有缺交提醒或自訂親師留言）
function openSingleStudentLinePushModal(studentId) {
    const s = (db.students || []).find(st => st.id.toString() === studentId.toString());
    if (!s) return;

    const binding = (currentLineBindings || []).find(b => b.isBound && b.studentId.toString() === studentId.toString());
    if (!binding) {
        showAlert('提示', `${s.name} 的家長尚未綁定 LINE 官方帳號，無法發送私訊！`);
        return;
    }

    const missingTasks = getStudentPendingTasks(s);
    const token = s.token || ('STU' + String(s.id).padStart(3, '0'));
    const gas = appConfig.gasUrl || '';
    let apiParam = '';
    if (gas && gas.includes('/macros/s/')) {
        apiParam = gas.split('/macros/s/')[1].split('/')[0];
    }
    const currentPath = window.location.pathname;
    let basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const portalUrl = `${window.location.origin}${basePath}parent.html?t=${encodeURIComponent(token)}${apiParam ? '&a=' + apiParam : ''}`;

    let defaultMsg = '';
    if (missingTasks.length > 0) {
        const taskLines = missingTasks.map(mt => `‧ 【${mt.subject}】${mt.taskName}${mt.range ? ' (' + mt.range + ')' : ''}`).join('\n');
        defaultMsg = `🚨 【作業待補交提醒】\n\n` +
            `${maskStudentName(s.name)} 家長您好：\n` +
            `今日學校清點作業，孩子尚有 ${missingTasks.length} 項作業待補交：\n` +
            `${taskLines}\n\n` +
            `請您今晚撥冗提醒並陪伴孩子於明日到校前補齊！\n\n` +
            `🔗 點此秒開專屬手札查看明細：\n${portalUrl}\n\n` +
            `（由 班級作業管理系統 自動推播）`;
    } else {
        defaultMsg = `🌱 【班級作業手札與親師通知】\n\n` +
            `${maskStudentName(s.name)} 家長您好：\n` +
            `孩子目前的應交作業皆已按時完成，表現非常棒！🎉\n\n` +
            `🔗 點此可隨時查看孩子最新作業手札與各科明細：\n${portalUrl}\n\n` +
            `（由 班級作業管理系統 推播）`;
    }

    Swal.fire({
        title: `📨 指定發送 LINE 通知 — ${String(s.id).padStart(2, '0')} ${s.name}`,
        html: `
            <div class="text-left text-xs space-y-2.5">
                <div class="p-2.5 rounded-xl border ${missingTasks.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'} font-bold">
                    ${missingTasks.length > 0 ? `⚠️ 該生目前共有 ${missingTasks.length} 項待補交作業，已自動帶入缺交提醒範本。` : `🎉 該生目前無缺交作業，已帶入正面鼓勵與手札通知範本。`}
                </div>
                <div>
                    <label class="block font-bold text-slate-700 mb-1">✏️ 推播私訊內容（可直接修改或加註給家長的話）：</label>
                    <textarea id="single-line-push-textarea" rows="10" class="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 outline-none leading-relaxed">${escapeCardHtml(defaultMsg)}</textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: `🚀 單獨發送給 ${s.name} 家長`,
        cancelButtonText: '取消',
        confirmButtonColor: '#059669',
        preConfirm: () => {
            const ta = document.getElementById('single-line-push-textarea');
            return ta ? ta.value.trim() : defaultMsg;
        }
    }).then(async (res) => {
        if (!res || !res.isConfirmed || !res.value) return;
        await executeLinePushRequest([{
            studentId: s.id,
            studentName: s.name,
            token: token,
            lineUserId: binding.lineUserId,
            missingTasks: missingTasks,
            customMessage: res.value
        }]);
    });
}

// 切換 Token 密碼/明文顯示
function toggleLineTokenVisibility() {
    const input = document.getElementById('line-access-token');
    const btn = event ? event.target : null;
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.innerText = '隱藏';
    } else {
        input.type = 'password';
        if (btn) btn.innerText = '顯示';
    }
}

// 複製邀請文案供導師發送至班群
function copyLineInviteText() {
    const botIdInput = document.getElementById('line-bot-id');
    const botId = (botIdInput && botIdInput.value.trim()) || (appConfig.lineBotBasicId || '');
    const cls = appConfig.classes ? appConfig.classes.find(c => c.id === appConfig.activeClassId) : null;
    const classLabel = cls ? cls.label : '班級';
    
    const botText = botId ? `LINE ID 搜尋：${botId.startsWith('@') ? botId : ('@' + botId)}` : '【請向導師洽詢班級 LINE 帳號】';

    const text = `📢 【${classLabel} LINE 智慧作業通知服務】家長邀請函\n\n` +
      `親愛的家長您好：\n` +
      `為了讓您能第一時間掌握孩子的每日作業繳交進度，本班已啟用 LINE 官方帳號作業提醒服務！\n\n` +
      `📱 【兩步驟輕鬆綁定】：\n` +
      `1. 請加入班級官方 LINE：\n` +
      `   ${botText}\n` +
      `2. 加入好友後，請直接傳送孩子的「專屬代碼」（請參考隨聯絡簿發放的作業查詢小卡，例如：V9UPK4）。\n\n` +
      `🎉 綁定完成後，若放學有點名缺交，系統將於放學後自動發送私訊提醒您；您也可以隨時在 LINE 中傳送「查詢」查看孩子完整的作業手札。\n` +
      `感謝各位家長的配合與支持！`;

    navigator.clipboard.writeText(text).then(() => {
        showToast('已複製家長加好友與綁定說明文案！', 'success');
    }).catch(() => {
        showToast('複製失敗，請手動複製', 'error');
    });
}

// 儲存 LINE 設定至雲端試算表 SystemConfig
async function saveLineSettings() {
    const botIdInput = document.getElementById('line-bot-id');
    const tokenInput = document.getElementById('line-access-token');
    const botId = botIdInput ? botIdInput.value.trim() : '';
    const token = tokenInput ? tokenInput.value.trim() : '';

    if (!botId && !token) {
        showAlert('提示', '請至少填寫 LINE Bot Basic ID 或 Channel Access Token！');
        return;
    }

    const gasUrl = window.gasUrl || (appConfig && appConfig.gasUrl);
    if (!gasUrl) {
        showAlert('提示', '尚未設定 Google Apps Script (GAS) 網址，請先至【系統設定】設定！');
        return;
    }

    if (botId) {
        appConfig.lineBotBasicId = botId;
        try { localStorage.setItem('line_bot_id', botId); } catch(e) {}
    }
    if (token) {
        appConfig.lineChannelAccessToken = token;
        try { localStorage.setItem('line_access_token', token); } catch(e) {}
    }
    if (typeof saveData === 'function') saveData();

    showLoading();
    const loadText = document.getElementById('loading-text');
    if (loadText) loadText.innerText = '正在同步 LINE 設定至雲端...';

    try {
        const payload = {
            action: 'line_save_config',
            classPrefix: getActiveClassPrefix(),
            lineBotBasicId: botId,
            lineChannelAccessToken: token
        };
        const resp = await fetch(gasUrl, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const res = await resp.json();
        if (res.status === 'success') {
            showToast('LINE 設定已成功儲存並同步至雲端！', 'success');
            fetchLineBindingStatus();
        } else {
            showAlert('儲存失敗', res.message || '未知錯誤');
        }
    } catch(e) {
        console.error(e);
        showAlert('連線錯誤', '無法連線至 GAS，請檢查網路或 GAS 發布狀態！');
    } finally {
        hideLoading();
    }
}

// 讀取全班 LINE 綁定狀態並刷新介面
async function fetchLineBindingStatus() {
    const gasUrl = window.gasUrl || (appConfig && appConfig.gasUrl);
    const badge = document.getElementById('line-config-status-badge');
    const botIdInput = document.getElementById('line-bot-id');
    const tokenInput = document.getElementById('line-access-token');
    const statsEl = document.getElementById('line-bound-stats');
    const progressEl = document.getElementById('line-bound-progress');
    const gridEl = document.getElementById('line-students-bound-grid');
    const targetCountEl = document.getElementById('line-missing-target-count');

    // 預先帶入本機暫存
    if (botIdInput && !botIdInput.value) {
        botIdInput.value = appConfig.lineBotBasicId || localStorage.getItem('line_bot_id') || '';
    }
    if (tokenInput && !tokenInput.value) {
        tokenInput.value = appConfig.lineChannelAccessToken || localStorage.getItem('line_access_token') || '';
    }

    if (!gasUrl) {
        if (badge) {
            badge.innerText = '未設定 GAS';
            badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200';
        }
        if (statsEl) statsEl.innerText = '請先設定 GAS 網址';
        return;
    }

    if (statsEl) statsEl.innerText = '檢查連線中...';

    try {
        const resp = await fetch(gasUrl, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: 'line_get_status',
                classPrefix: getActiveClassPrefix()
            })
        });
        const res = await resp.json();

        if (res.status === 'success') {
            if (res.config && res.config.isConfigured) {
                if (badge) {
                    badge.innerText = '已連線 (金鑰有效)';
                    badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
                }
                if (res.config.botBasicId && botIdInput && !botIdInput.value) {
                    botIdInput.value = res.config.botBasicId;
                    appConfig.lineBotBasicId = res.config.botBasicId;
                }
            } else {
                if (badge) {
                    badge.innerText = '未設定金鑰';
                    badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300';
                }
            }

            currentLineBindings = res.bindings || [];

            // 建立已綁定的 ID map
            const boundMap = {};
            currentLineBindings.forEach(b => {
                if (b.isBound) {
                    boundMap[b.studentId.toString()] = b;
                }
            });

            const totalStudents = db.students ? db.students.length : 0;
            let boundCount = 0;

            if (gridEl) {
                gridEl.innerHTML = '';
                (db.students || []).forEach(s => {
                    const isBound = !!boundMap[s.id.toString()];
                    if (isBound) boundCount++;

                    const pill = document.createElement('div');
                    pill.className = `flex items-center justify-between p-1.5 rounded-lg border text-[11px] ${
                        isBound
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-400'
                    }`;
                    pill.innerHTML = `
                        <span class="truncate">${String(s.id).padStart(2, '0')} ${escapeCardHtml(s.name)}</span>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            ${isBound ? `
                                <button type="button" onclick="openSingleStudentLinePushModal('${s.id}')" class="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded px-1.5 py-0.5 transition cursor-pointer font-bold" title="單獨發送 LINE 通知給此學生家長">📨推播</button>
                                <button type="button" onclick="unbindLineStudent('${s.id}', '${s.name}')" class="text-[10px] text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded px-1 py-0.5 transition cursor-pointer" title="解除此學生綁定">✕解除</button>
                            ` : `
                                <span class="text-slate-300 font-black text-xs">未綁定</span>
                            `}
                        </div>
                    `;
                    gridEl.appendChild(pill);
                });
            } else {
                (db.students || []).forEach(s => {
                    if (boundMap[s.id.toString()]) boundCount++;
                });
            }

            const percent = totalStudents > 0 ? Math.round((boundCount / totalStudents) * 100) : 0;
            if (statsEl) statsEl.innerText = `${boundCount} / ${totalStudents} 人 (${percent}%)`;
            if (progressEl) progressEl.style.width = `${percent}%`;

            // 計算今日缺交且已綁定的學生名單並渲染勾選框
            const targetMissing = getBoundStudentsWithMissing(boundMap, false);
            if (targetCountEl) targetCountEl.innerText = targetMissing.length;
            renderLineMissingTargetsSelector(targetMissing);

        } else {
            if (statsEl) statsEl.innerText = '讀取失敗：' + (res.message || '未知錯誤');
        }
    } catch(e) {
        console.error(e);
        if (statsEl) statsEl.innerText = '連線失敗，請檢查網路';
        if (badge) {
            badge.innerText = '連線異常';
            badge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300';
        }
    }
}

// 預覽 LINE 推播私訊樣式
function previewLinePushModal() {
    const targets = getBoundStudentsWithMissing(null, true);
    if (targets.length === 0) {
        Swal.fire({
            title: '📱 LINE 訊息預覽',
            html: `
                <div class="text-left text-xs space-y-3">
                    <div class="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 font-bold">
                        🎉 目前沒有勾選任何待補交且已綁定 LINE 的學生（或全班皆已交齊）！
                    </div>
                    <div class="text-slate-500">
                        若有勾選缺交學生，系統將會為每位家長生成 1 對 1 客製化私訊如下範例（作業全齊之家庭不會收到打擾）：
                    </div>
                    <div class="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-800 leading-relaxed border border-slate-200">
                        🚨 【作業待補交提醒】<br><br>
                        王○明 家長您好：<br>
                        今日學校清點作業，孩子尚有 1 項作業待補交：<br>
                        ‧ 【國語】甲本 (P.10~12)<br><br>
                        請您今晚撥冗提醒並陪伴孩子於明日到校前補齊！<br><br>
                        🔗 點此秒開專屬手札查看明細：<br>
                        https://chy23.github.io/RP_QR_CC_HW/parent.html?t=DEMO<br><br>
                        （由 班級作業管理系統 自動推播）
                    </div>
                </div>
            `,
            confirmButtonText: '關閉'
        });
        return;
    }

    const first = targets[0];
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const gas = appConfig.gasUrl || '';
    let apiParam = '';
    if (gas && gas.includes('/macros/s/')) {
        apiParam = gas.split('/macros/s/')[1].split('/')[0];
    }
    const demoUrl = `${window.location.origin}${basePath}parent.html?t=${encodeURIComponent(first.token)}${apiParam ? '&a=' + apiParam : ''}`;
    const taskLines = (first.missingTasks || []).map(mt => `‧ 【${escapeCardHtml(mt.subject)}】${escapeCardHtml(mt.taskName)}${mt.range ? ' (' + escapeCardHtml(mt.range) + ')' : ''}`).join('<br>');

    const targetListHtml = targets.map(t => `
        <span class="inline-block bg-white border border-rose-200 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
            ${String(t.studentId).padStart(2, '0')} ${escapeCardHtml(t.studentName)} (${t.missingTasks.length}項)
        </span>
    `).join(' ');

    Swal.fire({
        title: '📱 LINE 缺交通知預覽',
        html: `
            <div class="text-left text-xs space-y-3">
                <div class="p-2.5 bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
                    <div class="font-bold">本次已勾選預計發送對象共 ${targets.length} 人（僅發送給以下名單）：</div>
                    <div class="mt-1 flex flex-wrap gap-1 max-h-24 overflow-y-auto">${targetListHtml}</div>
                </div>
                <div class="font-bold text-slate-700">私訊內容範例（以 ${escapeCardHtml(first.studentName)} 為例）：</div>
                <div class="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-800 leading-relaxed border border-slate-200">
                    🚨 【作業待補交提醒】<br><br>
                    ${escapeCardHtml(maskStudentName(first.studentName))} 家長您好：<br>
                    今日學校清點作業，孩子尚有 ${first.missingTasks.length} 項作業待補交：<br>
                    ${taskLines}<br><br>
                    請您今晚撥冗提醒並陪伴孩子於明日到校前補齊！<br><br>
                    🔗 點此秒開專屬手札查看明細：<br>
                    ${demoUrl}<br><br>
                    （由 班級作業管理系統 自動推播）
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: `🚀 立即發送推播 (${targets.length}人)`,
        cancelButtonText: '關閉預覽',
        confirmButtonColor: '#e11d48'
    }).then(r => {
        if (r && r.isConfirmed) {
            sendLinePushMissing();
        }
    });
}

// 執行 LINE 推播 API 請求共用函式
async function executeLinePushRequest(targets) {
    const gasUrl = window.gasUrl || (appConfig && appConfig.gasUrl);
    if (!gasUrl) {
        showAlert('提示', '尚未設定 Google Apps Script (GAS) 網址！');
        return;
    }

    const tokenInput = document.getElementById('line-access-token');
    const token = (tokenInput && tokenInput.value.trim()) || appConfig.lineChannelAccessToken || localStorage.getItem('line_access_token') || '';

    showLoading();
    const loadText = document.getElementById('loading-text');
    if (loadText) loadText.innerText = `正在透過 LINE 官方帳號發送 ${targets.length} 則通知...`;

    try {
        const payload = {
            action: 'line_push_missing',
            classPrefix: getActiveClassPrefix(),
            lineChannelAccessToken: token,
            targets: targets
        };

        const resp = await fetch(gasUrl, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const res = await resp.json();

        if (res.status === 'success') {
            showAlert(
                '推播發送完成！',
                `成功發送：${res.successCount} 位\n失敗：${res.failCount} 位\n未綁定跳過：${res.skippedCount} 位`,
                'success'
            );
        } else {
            showAlert('發送失敗', res.message || '未知錯誤');
        }
    } catch(e) {
        console.error(e);
        showAlert('連線錯誤', '發送失敗，請確認網路連線與金鑰有效性！');
    } finally {
        hideLoading();
    }
}

// 一鍵發送今日缺交私訊推播（支援僅發送勾選之指定學生）
async function sendLinePushMissing() {
    const targets = getBoundStudentsWithMissing(null, true);
    if (targets.length === 0) {
        showAlert('提示', '請至少勾選一位待補交且已綁定 LINE 的學生！（或使用上方名單中的「📨推播」單獨傳訊）');
        return;
    }

    const namesStr = targets.map(t => `${String(t.studentId).padStart(2, '0')} ${t.studentName}`).join('、');
    const confirmResult = await showConfirm(
        '確認發送 LINE 缺交通知',
        `即將發送 LINE 缺交私訊給已勾選的 ${targets.length} 位學生家長：\n【${namesStr}】\n\n未缺交或未勾選之學生不會收到通知，確定送出嗎？`,
        'question',
        '立即發送',
        '取消'
    );
    if (!confirmResult.isConfirmed) return;

    await executeLinePushRequest(targets);
}

// 教師端手動解除某學生的 LINE 綁定
async function unbindLineStudent(studentId, studentName) {
    const confirmRes = await showConfirm(
        '解除 LINE 綁定確認',
        `確定要解除 ${studentName} 的 LINE 官方帳號綁定嗎？\n解除後家長將不再接收自動缺交通知。`,
        'warning',
        '解除綁定',
        '取消'
    );
    if (!confirmRes || !confirmRes.isConfirmed) return;

    const gasUrl = window.gasUrl || (appConfig && appConfig.gasUrl);
    if (!gasUrl) {
        showAlert('提示', '尚未設定 GAS 網址！');
        return;
    }

    showLoading();
    try {
        const resp = await fetch(gasUrl, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: 'line_unbind_student',
                classPrefix: getActiveClassPrefix(),
                studentId: studentId
            })
        });
        const res = await resp.json();
        if (res.status === 'success') {
            showToast(`已解除 ${studentName} 的 LINE 綁定！`, 'success');
            fetchLineBindingStatus();
        } else {
            showAlert('解除失敗', res.message || '未知錯誤');
        }
    } catch(e) {
        console.error(e);
        showAlert('連線錯誤', '解除失敗，請確認網路連線');
    } finally {
        hideLoading();
    }
}


