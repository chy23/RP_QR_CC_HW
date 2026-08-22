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
                    a.download = `${task.name}_浮動套印.pdf`;
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
                        let cellValue = '缺交';
                        if (record) {
                            cellValue = record.timestamp;
                            if (record.manualStatus && (record.manualStatus.startsWith('leave_') || ['事假', '病假', '公假', '喪假', '曠課', '遲到', '其他', '其他假別'].includes(record.manualStatus))) {
                                
                                let lName = record.manualStatus;
                                if (lName.startsWith('leave_custom_')) lName = lName.replace('leave_custom_', '');
                                else if (lName.startsWith('leave_')) lName = lName.replace('leave_', '');
                                cellValue = lName;
                            } else if (record.manualStatus === 'missing') {
                                cellValue = '缺交';
                            }
                            const taskDef = db.tasks.find(t => t.id === k.taskId);
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
