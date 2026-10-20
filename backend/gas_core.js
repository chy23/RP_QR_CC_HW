function(e, ss, getSheetNames) {
  try {
    var payload = JSON.parse(e.postData.contents);
    
    // 輔助函式：自動掃描試算表所有分頁，發現包含「學生名單」的所有班級
    function discoverAllClasses(existingConfig) {
      var allSheets = ss.getSheets();
      var discovered = [];
      for (var i = 0; i < allSheets.length; i++) {
        var sName = allSheets[i].getName();
        if (sName.indexOf("學生名單") !== -1) {
          var cleanLabel = sName.replace("學生名單", "").trim();
          if (cleanLabel.indexOf("[") === 0 && cleanLabel.lastIndexOf("]") === cleanLabel.length - 1) {
            cleanLabel = cleanLabel.substring(1, cleanLabel.length - 1).trim();
          }
          if (!cleanLabel) cleanLabel = "預設班級";
          discovered.push({
            sheetName: sName,
            label: cleanLabel,
            prefix: cleanLabel
          });
        }
      }
      
      var cfg = existingConfig || {};
      if (!cfg.classes || cfg.classes.length === 0) {
        cfg.classes = discovered.map(function(dc, idx) {
          return {
            id: 'c_' + idx + '_' + Math.abs(dc.label.split('').reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)).toString(36),
            label: dc.label,
            prefix: dc.prefix
          };
        });
        if (cfg.classes.length > 0 && !cfg.activeClassId) {
          cfg.activeClassId = cfg.classes[0].id;
        }
      } else {
        discovered.forEach(function(dc) {
          var exists = cfg.classes.some(function(c) {
            return c.prefix === dc.prefix || c.label === dc.label;
          });
          if (!exists) {
            cfg.classes.push({
              id: 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
              label: dc.label,
              prefix: dc.prefix
            });
          }
        });
      }
      return { config: cfg, discovered: discovered };
    }

    // ==========================================
    // 全域共用輔助函式：網址產生、學生姓名去識別化、學生代碼檢索、現況摘要計算、分頁色彩管理
    // ==========================================

    function maskStudentName(name) {
      if (!name) return "";
      var s = name.toString().trim();
      if (s.length <= 1) return s;
      if (s.length === 2) {
        return s.charAt(0) + "○";
      }
      if (s.length === 3) {
        return s.charAt(0) + "○" + s.charAt(2);
      }
      var mid = "";
      for (var i = 1; i < s.length - 1; i++) {
        mid += "○";
      }
      return s.charAt(0) + mid + s.charAt(s.length - 1);
    }

    function getColorForPrefix(p) {
      if (!p) return null;
      var clean = p.toString().replace(/\[|\]/g, '').trim();
      if (!clean) return null;
      var colors = ['#ea4335', '#fbbc04', '#34a853', '#4285f4', '#ff6d01', '#46bdc6', '#7baaf7', '#d01884', '#00bfa5', '#9c27b0', '#e91e63', '#673ab7'];
      var hash = 0;
      for (var i = 0; i < clean.length; i++) {
        hash = clean.charCodeAt(i) + ((hash << 5) - hash);
      }
      hash = Math.abs(hash);
      return colors[hash % colors.length];
    }

    function ensureSheetAndColor(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      var p = "";
      var m = sheetName.match(/^\[([^\]]+)\]/);
      if (m) {
        p = m[1];
      } else if (payload && payload.classPrefix) {
        p = payload.classPrefix;
      }
      var tabColor = getColorForPrefix(p);
      if (tabColor) {
        try { if (sheet.getTabColor() !== tabColor) sheet.setTabColor(tabColor); } catch(err) {}
      }
      return sheet;
    }

    function getGasWebAppId() {
      var gasId = "";
      try {
        var sUrl = ScriptApp.getService().getUrl();
        if (sUrl && sUrl.indexOf("/macros/s/") !== -1) {
          gasId = sUrl.split("/macros/s/")[1].split("/")[0];
        }
      } catch(e) {}
      
      if (!gasId) {
        try {
          var cfgSheet = ss.getSheetByName("SystemConfig");
          if (cfgSheet) {
            var cfgStr = cfgSheet.getRange("A1").getValue();
            if (cfgStr) {
              var cfg = JSON.parse(cfgStr);
              if (cfg && cfg.gasUrl && cfg.gasUrl.indexOf("/macros/s/") !== -1) {
                gasId = cfg.gasUrl.split("/macros/s/")[1].split("/")[0];
              }
            }
          }
        } catch(e) {}
      }
      return gasId;
    }

    function getPortalUrl(classLabel, token) {
      var isBeta = (classLabel || "").toLowerCase().indexOf("beta") !== -1;
      var base = isBeta ? "https://chy23.github.io/RP_QR_CC_HW/beta/parent.html" : "https://chy23.github.io/RP_QR_CC_HW/parent.html";
      var gasId = getGasWebAppId();
      var url = base + "?t=" + encodeURIComponent(token);
      if (gasId) {
        url += "&a=" + encodeURIComponent(gasId);
      }
      url += "&lb=1&src=line";
      return url;
    }

    function parseDateForCompare(dStr, fallbackYear) {
      if (!dStr) return null;
      var raw = dStr.toString().trim();
      // 1. 先檢驗完整的 YYYY-MM-DD 或 YYYY/MM/DD
      var mYMD = raw.match(/^(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (mYMD) {
        var m = parseInt(mYMD[2], 10);
        var d = parseInt(mYMD[3], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return new Date(parseInt(mYMD[1], 10), m - 1, d, 23, 59, 59, 999);
        }
      }
      // 2. 嚴格防止把「1-5」「1-10」「p.1-5」「10-12」等作業頁數/課次範圍誤判為 1月5日
      if (/^[pP]?\d+\s*[-~～至到]\s*\d+/.test(raw) && raw.indexOf('/') === -1 && raw.indexOf('月') === -1) {
        return null;
      }
      // 3. 僅當原始字串包含明確日期符號（斜線 / 或「月」）時，才允許解析為 M/D 格式
      if (raw.indexOf('/') !== -1 || raw.indexOf('月') !== -1) {
        var s = raw.replace(/\//g, '-').replace(/月/g, '-').replace(/日/g, '');
        var mMD = s.match(/(\d{1,2})-(\d{1,2})/);
        if (mMD) {
          var m2 = parseInt(mMD[1], 10);
          var d2 = parseInt(mMD[2], 10);
          if (m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31) {
            var curY = fallbackYear || new Date().getFullYear();
            return new Date(curY, m2 - 1, d2, 23, 59, 59, 999);
          }
        }
      }
      return null;
    }

    function parseScanTime(tsStr) {
      if (!tsStr) return null;
      var s = tsStr.toString().trim().replace(/\[遲交\]|\[已繳交\]|遲交|已交|已繳交/g, "").trim();
      s = s.replace(/\//g, "-");
      if (s.indexOf("T") !== -1) {
        var d = new Date(s);
        if (!isNaN(d.getTime())) return d;
      }
      var mYMDTime = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
      if (mYMDTime) {
        return new Date(parseInt(mYMDTime[1], 10), parseInt(mYMDTime[2], 10) - 1, parseInt(mYMDTime[3], 10), parseInt(mYMDTime[4], 10), parseInt(mYMDTime[5], 10));
      }
      var mMDTime = s.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
      if (mMDTime) {
        var curY = new Date().getFullYear();
        return new Date(curY, parseInt(mMDTime[1], 10) - 1, parseInt(mMDTime[2], 10), parseInt(mMDTime[3], 10), parseInt(mMDTime[4], 10));
      }
      var mYMD = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (mYMD) {
        return new Date(parseInt(mYMD[1], 10), parseInt(mYMD[2], 10) - 1, parseInt(mYMD[3], 10), 0, 0, 0);
      }
      var mMD = s.match(/(\d{1,2})-(\d{1,2})/);
      if (mMD) {
        var curY2 = new Date().getFullYear();
        return new Date(curY2, parseInt(mMD[1], 10) - 1, parseInt(mMD[2], 10), 0, 0, 0);
      }
      return null;
    }

    function isLateCheck(scanTimeStr, deadlineStr) {
      if (!scanTimeStr || !deadlineStr) return false;
      var sStr = scanTimeStr.toString().trim();
      if (sStr.indexOf("遲交") !== -1 || sStr.toLowerCase().indexOf("late") !== -1) return true;
      var sc = parseScanTime(sStr);
      var dl = parseDateForCompare(deadlineStr, sc ? sc.getFullYear() : undefined);
      if (sc && dl) {
        return sc.getTime() > dl.getTime();
      }
      return false;
    }

    // 輔助函式：根據代碼尋找學生 (支援防偽暗碼、系統代碼、座號代碼 STU001 等全欄位檢索)
    function findStudentByToken(searchToken, targetPrefix) {
      var query = (searchToken || '').toString().trim().toUpperCase();
      if (!query) return null;
      
      var allSheets = ss.getSheets();
      for (var i = 0; i < allSheets.length; i++) {
        var sName = allSheets[i].getName();
        if (sName.indexOf("學生名單") !== -1) {
          if (targetPrefix && sName.indexOf(targetPrefix) !== 0) continue;
          
          var sData = allSheets[i].getDataRange().getDisplayValues();
          if (sData.length > 1) {
            var h = sData[0];
            var idIdx = -1;
            var nameIdx = -1;
            var tokIndices = [];
            
            for (var c = 0; c < h.length; c++) {
              var colH = (h[c] || '').toString().trim();
              if (colH.indexOf("座號") !== -1 || colH.toLowerCase().indexOf("seat") !== -1) {
                idIdx = c;
              } else if (colH.indexOf("姓名") !== -1 || colH.toLowerCase().indexOf("name") !== -1) {
                nameIdx = c;
              } else if (
                colH.indexOf("代碼") !== -1 ||
                colH.indexOf("防偽") !== -1 ||
                colH.indexOf("暗碼") !== -1 ||
                colH.indexOf("密碼") !== -1 ||
                colH.toLowerCase().indexOf("token") !== -1 ||
                colH.toLowerCase().indexOf("salt") !== -1
              ) {
                tokIndices.push(c);
              }
            }
            if (idIdx === -1) idIdx = 0;
            if (nameIdx === -1) nameIdx = 1;
            if (tokIndices.length === 0) {
              for (var c = 2; c < h.length; c++) tokIndices.push(c);
            }
            
            for (var r = 1; r < sData.length; r++) {
              var row = sData[r];
              var rId = (row[idIdx] || '').toString().trim();
              var rName = (row[nameIdx] || '').toString().trim();
              var rSysCode = ('STU' + ('00' + rId).slice(-3)).toUpperCase();
              
              var isMatch = false;
              var primaryToken = '';
              
              if (query === rSysCode) {
                isMatch = true;
              }
              
              for (var ti = 0; ti < tokIndices.length; ti++) {
                var cellVal = (row[tokIndices[ti]] || '').toString().trim().toUpperCase();
                if (cellVal && !primaryToken) primaryToken = cellVal;
                if (cellVal && cellVal === query) {
                  isMatch = true;
                  primaryToken = cellVal;
                  break;
                }
              }
              
              if (isMatch) {
                return {
                  student: { id: rId, name: rName, token: primaryToken || rSysCode },
                  classPrefix: sName.replace("學生名單", "")
                };
              }
            }
          }
        }
      }
      return null;
    }

    // 取得學生作業現況與繳交摘要
    function getStudentStatusSummary(matchedPrefix, targetStudent) {
      var allSheets = ss.getSheets();
      var studentTasks = [];
      var missingTasks = [];
      var lateTasks = [];
      var onTimeCount = 0;
      var totalCount = 0;

      for (var j = 0; j < allSheets.length; j++) {
        var sheet = allSheets[j];
        var sName2 = sheet.getName();
        if (matchedPrefix && sName2.indexOf(matchedPrefix) !== 0) continue;
        if (!matchedPrefix && sName2.indexOf("[") === 0) continue;
        
        var baseName = matchedPrefix ? sName2.substring(matchedPrefix.length) : sName2;
        if (baseName === "學生名單" || baseName === "所有掃描紀錄" || baseName.indexOf("統計") !== -1 || baseName === "SystemConfig" || baseName.indexOf("LINE用戶綁定") !== -1 || baseName.indexOf("家長閱覽紀錄") !== -1) continue;
        
        var sheetValues = sheet.getDataRange().getDisplayValues();
        if (sheetValues.length >= 4) {
          var headerTaskNames = sheetValues[0];
          var r1Label = (sheetValues[1][0] || '').toString();
          var headerDates = (r1Label.indexOf('日') !== -1 || r1Label.toLowerCase().indexOf('date') !== -1) ? sheetValues[1] : sheetValues[2];
          var headerRanges = (r1Label.indexOf('日') !== -1 || r1Label.toLowerCase().indexOf('date') !== -1) ? sheetValues[2] : sheetValues[1];
          
          var studentRowValues = null;
          for (var rIdx = 3; rIdx < sheetValues.length; rIdx++) {
            if (sheetValues[rIdx][0].toString().trim() === targetStudent.name) {
              studentRowValues = sheetValues[rIdx];
              break;
            }
          }
          
          if (studentRowValues) {
            for (var col = 1; col < headerTaskNames.length; col++) {
              var tName = headerTaskNames[col] || baseName;
              var tRange = headerRanges[col] || '';
              var tDate = headerDates[col] || '';

              var colHasAnyStudentData = false;
              for (var rowCheck = 3; rowCheck < sheetValues.length; rowCheck++) {
                if (sheetValues[rowCheck][col] && sheetValues[rowCheck][col].toString().trim() !== '') {
                  colHasAnyStudentData = true;
                  break;
                }
              }

              if (!colHasAnyStudentData && !tRange && !tDate) {
                continue;
              }

              totalCount++;
              var tStatus = studentRowValues[col] || '';
              var cleanStatus = tStatus.toString().trim();
              
              var isMissing = false;
              var isLate = false;
              var isExcused = false;

              if (!cleanStatus || cleanStatus === '缺交' || cleanStatus === '未交' || cleanStatus === '沒帶' || cleanStatus === 'missing') {
                isMissing = true;
                cleanStatus = cleanStatus || '缺交';
              } else if (cleanStatus.indexOf('[遲交]') !== -1 || cleanStatus.indexOf('遲交') !== -1 || cleanStatus.toLowerCase().indexOf('late') !== -1) {
                // 依教師指令：只有教師明確註記「遲交」才計入遲交，不管時間點
                isLate = true;
                if (cleanStatus.indexOf('[遲交]') === -1) {
                  cleanStatus = '[遲交] ' + cleanStatus;
                }
              } else if (['事假', '病假', '公假', '喪假', '免交', '請假', '其他'].indexOf(cleanStatus) !== -1) {
                isExcused = true;
              } else {
                onTimeCount++;
              }

              var taskItem = {
                subject: baseName,
                taskName: tName,
                range: tRange,
                date: tDate,
                deadline: tDate,
                status: cleanStatus
              };
              studentTasks.push(taskItem);

              if (isMissing) {
                missingTasks.push(taskItem);
              } else if (isLate) {
                lateTasks.push(taskItem);
              }
            }
          }
        }
      }

      var onTimeRateStr = totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) + "%" : "-";
      return {
        totalCount: totalCount,
        onTimeCount: onTimeCount,
        lateCount: lateTasks.length,
        missingCount: missingTasks.length,
        onTimeRate: onTimeRateStr,
        missingTasks: missingTasks,
        lateTasks: lateTasks,
        tasks: studentTasks
      };
    }

    // ==========================================
    // 家長閱覽紀錄核心函式 (足跡日誌、節流防刷、統計匯總)
    // ==========================================
    function findParentViewSheet(classPrefix) {
      var clean = (classPrefix || "").replace(/\[|\]/g, "").trim();
      var target1 = clean ? ("[" + clean + "] 家長閱覽紀錄") : "家長閱覽紀錄";
      var target2 = clean ? ("[" + clean + "]家長閱覽紀錄") : "家長閱覽紀錄";
      var sh = ss.getSheetByName(target1) || ss.getSheetByName(target2);
      if (sh) return sh;

      if (clean) {
        var all = ss.getSheets();
        for (var i = 0; i < all.length; i++) {
          var sName = all[i].getName();
          if (sName.indexOf("家長閱覽紀錄") !== -1) {
            var sClean = sName.replace("家長閱覽紀錄", "").replace(/\[|\]/g, "").trim();
            if (sClean === clean) return all[i];
          }
        }
      } else {
        return ss.getSheetByName("家長閱覽紀錄");
      }
      return null;
    }

    function logParentView(classPrefix, student, source, note) {
      try {
        var sheet = findParentViewSheet(classPrefix);
        if (!sheet) {
          var clean = (classPrefix || "").replace(/\[|\]/g, "").trim();
          var sheetName = clean ? ("[" + clean + "] 家長閱覽紀錄") : "家長閱覽紀錄";
          sheet = ensureSheetAndColor(sheetName);
        }
        if (!sheet) return;

        if (sheet.getLastRow() === 0) {
          sheet.appendRow(["時間戳記", "座號", "學生姓名", "查詢代碼", "閱覽管道", "備註"]);
          sheet.getRange("A1:F1").setBackground("#4f46e5").setFontColor("#ffffff").setFontWeight("bold");
        }

        var now = new Date();
        var nowStr = Utilities.formatDate(now, "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
        var sId = student.id !== undefined ? student.id.toString().trim() : "";
        var sName = student.name || "";
        var sToken = (student.token || "").toString().trim().toUpperCase();
        var sSource = source || "📱 手機手札 (QR掃碼)";
        var sNote = note || "";

        // 檢查防抖防刷機制 (Throttle): 若此學生在過去 3 分鐘內曾有紀錄，則更新該筆時間與備註，避免頻繁重新整理灌爆試算表
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          var checkStart = Math.max(2, lastRow - 15);
          var checkRange = sheet.getRange(checkStart, 1, lastRow - checkStart + 1, 6).getDisplayValues();
          for (var r = checkRange.length - 1; r >= 0; r--) {
            var rowData = checkRange[r];
            var rowId = (rowData[1] || "").toString().trim();
            var rowToken = (rowData[3] || "").toString().trim().toUpperCase();
            var isMatch = (rowId && sId && rowId === sId) || (sToken && rowToken && rowToken === sToken);
            if (isMatch) {
              var rowTimeStr = rowData[0];
              var rowTime = new Date(rowTimeStr);
              if (!isNaN(rowTime.getTime()) && (now.getTime() - rowTime.getTime() < 3 * 60 * 1000)) {
                var targetRowNum = checkStart + r;
                sheet.getRange(targetRowNum, 1, 1, 6).setValues([[
                  nowStr, sId, sName, sToken, sSource, sNote
                ]]);
                return;
              }
              break;
            }
          }
        }

        sheet.appendRow([nowStr, sId, sName, sToken, sSource, sNote]);
      } catch (err) {}
    }

    function getParentViewData(classPrefix) {
      var sheet = findParentViewSheet(classPrefix);
      var stats = {};
      var logs = [];

      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getDataRange().getDisplayValues();
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var timeStr = (row[0] || '').toString().trim();
          var sId = (row[1] || '').toString().trim();
          var sName = (row[2] || '').toString().trim();
          var sToken = (row[3] || '').toString().trim().toUpperCase();
          var source = (row[4] || '').toString().trim();
          var note = (row[5] || '').toString().trim();

          if (sId) {
            if (!stats[sId]) {
              stats[sId] = {
                studentId: sId,
                studentName: sName,
                token: sToken,
                totalViews: 0,
                lastViewedAt: timeStr,
                lastSource: source,
                lastNote: note
              };
            }
            stats[sId].totalViews++;
            stats[sId].lastViewedAt = timeStr;
            stats[sId].lastSource = source;
            stats[sId].lastNote = note;
          }

          logs.push({
            timestamp: timeStr,
            studentId: sId,
            studentName: sName,
            token: sToken,
            source: source,
            note: note
          });
        }
      }

      logs.reverse();
      if (logs.length > 200) {
        logs = logs.slice(0, 200);
      }

      return {
        stats: stats,
        logs: logs
      };
    }

    // ==========================================
    // 0. LINE Webhook 接收器 (連線驗證、傳送代碼自動綁定、輸入查詢回傳手札)
    // ==========================================
    if (payload.events !== undefined) {
      // (a) 若為 LINE 後台點擊「Verify (驗證)」測試連線 (events 為空陣列)
      if (!payload.events || payload.events.length === 0) {
        return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
      }

      // 讀取 SystemConfig 取得 LINE Channel Access Token
      var lineToken = "";
      var configSheet = ss.getSheetByName("SystemConfig");
      if (configSheet) {
        try {
          var cfgObj = JSON.parse(configSheet.getRange("A1").getValue());
          if (cfgObj && cfgObj.lineChannelAccessToken) {
            lineToken = cfgObj.lineChannelAccessToken;
          }
        } catch(e) {}
      }

      // 發送 LINE Reply 訊息輔助函式
      function replyLine(replyToken, textMsg) {
        if (!lineToken || !replyToken) return;
        try {
          UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + lineToken
            },
            payload: JSON.stringify({
              replyToken: replyToken,
              messages: [{ type: "text", text: textMsg }]
            }),
            muteHttpExceptions: true
          });
        } catch(err) {
          console.error("LINE reply error: " + err);
        }
      }

      for (var evIdx = 0; evIdx < payload.events.length; evIdx++) {
        var ev = payload.events[evIdx];
        if (ev.type === "message" && ev.message && ev.message.type === "text") {
          var userMsg = ev.message.text.trim();
          var userId = ev.source ? ev.source.userId : "";
          var replyToken = ev.replyToken;

          if (!userId) continue;

          // (1) 查詢指令
          if (userMsg === "查詢" || userMsg === "查作業" || userMsg === "作業" || userMsg.toLowerCase() === "query") {
            var allSheets = ss.getSheets();
            var boundStudents = [];
            for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
              var sName = allSheets[sIdx].getName();
              if (sName.indexOf("LINE用戶綁定") !== -1) {
                var bData = allSheets[sIdx].getDataRange().getDisplayValues();
                for (var bRow = 1; bRow < bData.length; bRow++) {
                  if (bData[bRow][3] && bData[bRow][3].trim() === userId) {
                    var sPrefix = sName.replace("LINE用戶綁定", "");
                    boundStudents.push({
                      classPrefix: sPrefix,
                      className: sPrefix.replace(/\[|\]/g, "").trim() || "本班",
                      id: bData[bRow][0],
                      name: bData[bRow][1],
                      token: bData[bRow][2]
                    });
                  }
                }
              }
            }

            if (boundStudents.length > 0) {
              var replyLines = ["📖 【孩子作業學習狀況即時查詢】\n"];
              for (var bs = 0; bs < boundStudents.length; bs++) {
                var stu = boundStudents[bs];
                var summary = getStudentStatusSummary(stu.classPrefix, stu);
                var portalUrl = getPortalUrl(stu.className, stu.token);

                var qNote = (summary.missingTasks && summary.missingTasks.length > 0)
                  ? ("待補交 " + summary.missingTasks.length + " 項")
                  : "作業全數繳齊";
                logParentView(stu.classPrefix, stu, "💬 LINE 主動查詢", qNote);

                replyLines.push("👦 學生：【" + stu.className + "】" + stu.id + "號 " + maskStudentName(stu.name));
                if (summary.missingTasks.length > 0) {
                  replyLines.push("🚨 待補交（共 " + summary.missingTasks.length + " 項）：");
                  for (var m = 0; m < summary.missingTasks.length; m++) {
                    var mt = summary.missingTasks[m];
                    var rg = mt.range ? " (" + mt.range + ")" : "";
                    replyLines.push("‧ 【" + mt.subject + "】" + mt.taskName + rg);
                  }
                } else {
                  replyLines.push("✨ 目前各科作業皆已準時繳交，無缺交！🎉");
                }
                var lateTip = summary.lateCount > 0 ? "，遲交 " + summary.lateCount + " 次" : "";
                replyLines.push("📊 作業準時率：" + summary.onTimeRate + " (已登記 " + summary.totalCount + " 項作業" + lateTip + ")");
                replyLines.push("🔗 專屬手札：" + portalUrl + "\n");
              }
              replyLines.push("👉 點擊上方手札連結可隨時查看完整每日打卡時序日誌與常遲到排行！");
              replyLine(replyToken, replyLines.join("\n"));
            } else {
              replyLine(replyToken, "⚠️ 您尚未綁定任何學生！\n\n請直接回傳孩子的【查詢代碼】（例如：V9UPK4）進行綁定，日後即可接收缺交通知與隨時查詢！");
            }
            continue;
          }

          // (2) 取消綁定 / 解除綁定指令
          var lowerMsg = userMsg.toLowerCase();
          if (userMsg === "取消綁定" || userMsg === "解除綁定" || userMsg === "解綁" || lowerMsg === "unbind" ||
              userMsg.indexOf("取消綁定") === 0 || userMsg.indexOf("解除綁定") === 0 || userMsg.indexOf("解綁") === 0) {
            var param = userMsg.replace(/^(取消綁定|解除綁定|解綁|unbind)\s*/i, "").trim().toUpperCase();
            var allSheets = ss.getSheets();
            var unboundStudents = [];

            for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
              var sName = allSheets[sIdx].getName();
              if (sName.indexOf("LINE用戶綁定") !== -1) {
                var bSheet = allSheets[sIdx];
                var bData = bSheet.getDataRange().getDisplayValues();
                var sPrefix = sName.replace("LINE用戶綁定", "").replace(/\[|\]/g, "").trim();

                for (var bRow = 1; bRow < bData.length; bRow++) {
                  var rowUid = bData[bRow][3] ? bData[bRow][3].trim() : "";
                  var rowSid = bData[bRow][0] ? bData[bRow][0].trim() : "";
                  var rowTok = bData[bRow][2] ? bData[bRow][2].trim().toUpperCase() : "";

                  if (rowUid === userId) {
                    if (param && param !== rowSid && param !== (rowSid + "號") && param !== rowTok) {
                      continue;
                    }
                    unboundStudents.push({
                      className: sPrefix || "本班",
                      id: bData[bRow][0],
                      name: bData[bRow][1]
                    });
                    bSheet.getRange(bRow + 1, 4, 1, 3).setValues([["", Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss"), "已解除"]]);
                  }
                }
              }
            }

            if (unboundStudents.length > 0) {
              var stuListStr = unboundStudents.map(function(u) {
                return "👦 【" + u.className + "】" + u.id + "號 " + u.name;
              }).join("\n");
              replyLine(replyToken, "✅ 【LINE 綁定已成功解除】\n\n已為您解除以下學生之通知綁定：\n" + stuListStr + "\n\n日後系統將不再向您發送該生的缺交私訊通知。\n若日後欲重新綁定，隨時傳送孩子的小卡代碼即可重新綁定！");
            } else {
              replyLine(replyToken, "ℹ️ 您目前沒有符合條件的已綁定學生紀錄。\n\n若欲綁定，請直接傳送孩子的專屬查詢代碼（例如：V9UPK4）。");
            }
            continue;
          }

          // (3) 代碼綁定與作業現況直現
          var isExplicitBind = /^綁定\s*/i.test(userMsg);
          var codeToMatch = userMsg.replace(/^綁定\s*/i, "").trim().toUpperCase();

          // 判斷是否為「疑似代碼」：
          // a. 家長主動輸入「綁定 XXX」
          // b. 或者是純 5~8 碼純英數字（例如 V9UPK4、STU012），且不含中文、空格或標點符號
          var isLikelyCode = isExplicitBind || (/^[A-Z0-9]{5,8}$/.test(codeToMatch));

          if (!isLikelyCode) {
            // 家長傳送的是一般問候、日常請假或親師提問（如：「老師好」、「今天小明發燒請假」）
            // 系統完全靜默不回覆，絕不亂回「查無此代碼」，保留給導師親自與家長 1 對 1 溝通！
            continue;
          }

          var found = findStudentByToken(codeToMatch, "");
          if (found) {
            var matchedStudent = found.student;
            var matchedClassPrefix = found.classPrefix;
            var cLabel = matchedClassPrefix.replace(/\[|\]/g, "").trim() || "本班";

            var bindSheetName = matchedClassPrefix + "LINE用戶綁定";
            var bindSheet = ensureSheetAndColor(bindSheetName);
            if (bindSheet.getLastRow() === 0) {
              bindSheet.appendRow(["座號", "姓名", "防偽代碼", "LINE User ID", "綁定時間", "狀態"]);
              bindSheet.getRange("A1:F1").setBackground("#34a853").setFontColor("#ffffff").setFontWeight("bold");
            }

            var bValues = bindSheet.getDataRange().getDisplayValues();
            var existingRow = -1;
            for (var b = 1; b < bValues.length; b++) {
              if (bValues[b][0].toString().trim() === matchedStudent.id.toString()) {
                existingRow = b + 1;
                break;
              }
            }

            var nowStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
            if (existingRow > 0) {
              bindSheet.getRange(existingRow, 1, 1, 6).setValues([[
                matchedStudent.id, matchedStudent.name, matchedStudent.token, userId, nowStr, "已綁定"
              ]]);
            } else {
              bindSheet.appendRow([matchedStudent.id, matchedStudent.name, matchedStudent.token, userId, nowStr, "已綁定"]);
            }

            var directUrl = getPortalUrl(cLabel, matchedStudent.token);
            var summary = getStudentStatusSummary(matchedClassPrefix, matchedStudent);

            var bNote = "LINE綁定成功 (" + (summary.missingTasks.length > 0 ? ("待補交 " + summary.missingTasks.length + " 項") : "作業全齊") + ")";
            logParentView(matchedClassPrefix, matchedStudent, "💬 LINE 綁定登入", bNote);

            var replyLines = [
              "🎉 【LINE 綁定成功・作業現況回報】\n",
              "家長您好，已成功為您綁定：",
              "👦 學生：【" + cLabel + "】" + matchedStudent.id + "號 " + maskStudentName(matchedStudent.name) + "\n"
            ];

            if (summary.missingTasks.length > 0) {
              replyLines.push("🚨 【今日待補交作業（共 " + summary.missingTasks.length + " 項）】");
              for (var mi = 0; mi < summary.missingTasks.length; mi++) {
                var mt = summary.missingTasks[mi];
                var rgStr = mt.range ? " (" + mt.range + ")" : "";
                replyLines.push("‧ 【" + mt.subject + "】" + mt.taskName + rgStr);
              }
              replyLines.push("👉 請家長今晚撥冗提醒孩子補齊並攜帶！\n");
            } else {
              replyLines.push("✨ 【今日作業繳交狀況】");
              replyLines.push("太棒了！今日各科作業皆已全數準時繳交，表現優異無缺交！🎉\n");
            }

            var lateTip = summary.lateCount > 0 ? "，遲交 " + summary.lateCount + " 次" : "";
            replyLines.push("📊 作業準時率：" + summary.onTimeRate + " (已登記 " + summary.totalCount + " 項作業" + lateTip + ")\n");
            replyLines.push("🔗 點此秒開專屬作業學習手札：");
            replyLines.push(directUrl);
            replyLines.push("\n（免帳密！隨時點開可查閱每日作業繳交足跡與常遲到排行）");

            replyLine(replyToken, replyLines.join("\n"));
          } else if (isExplicitBind) {
            replyLine(replyToken, "⚠️ 查無此專屬代碼之學生！\n\n請確認孩子作業小卡上的代碼（例如：V9UPK4）是否輸入正確。");
          }
        }
      }
      return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
    }

    if (payload.action === 'ping') {
      var config = null;
      var configSheet = ss.getSheetByName("SystemConfig");
      if (configSheet) {
        var configStr = configSheet.getRange("A1").getValue();
        if (configStr) {
          try { config = JSON.parse(configStr); } catch (err) {}
        }
      }
      var disc = discoverAllClasses(config);

      // 自動同步為試算表內所有班級分頁加上色彩 (包含 LINE用戶綁定、各科分頁等)
      var allSh = ss.getSheets();
      for (var si = 0; si < allSh.length; si++) {
        var curSh = allSh[si];
        var shM = curSh.getName().match(/^\[([^\]]+)\]/);
        if (shM) {
          var tCol = getColorForPrefix(shM[1]);
          if (tCol) {
            try { if (curSh.getTabColor() !== tCol) curSh.setTabColor(tCol); } catch(err) {}
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        sheetUrl: ss.getUrl(),
        config: disc.config
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 如果有傳入 classPrefix，就在所有分頁名稱加上前綴，例如 "[112上-三年甲班] "
    var rawPrefix = (payload.classPrefix || "").toString().trim();
    if (rawPrefix.indexOf("[") === 0 && rawPrefix.lastIndexOf("]") === rawPrefix.length - 1) {
      rawPrefix = rawPrefix.substring(1, rawPrefix.length - 1).trim();
    }
    var prefix = rawPrefix ? "[" + rawPrefix + "] " : "";

    // ==========================================
    // LINE 設定儲存、查詢綁定、發送今日缺交推播
    // ==========================================
    if (payload.action === 'line_save_config') {
      var configSheet = ss.getSheetByName("SystemConfig");
      if (!configSheet) configSheet = ss.insertSheet("SystemConfig");
      var existingCfg = {};
      try {
        var str = configSheet.getRange("A1").getValue();
        if (str) existingCfg = JSON.parse(str);
      } catch(e) {}
      if (payload.lineChannelAccessToken !== undefined) existingCfg.lineChannelAccessToken = payload.lineChannelAccessToken;
      if (payload.lineBotBasicId !== undefined) existingCfg.lineBotBasicId = payload.lineBotBasicId;
      configSheet.getRange("A1").setValue(JSON.stringify(existingCfg));
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'line_get_status') {
      var configSheet = ss.getSheetByName("SystemConfig");
      var lineCfg = { isConfigured: false, botBasicId: '' };
      if (configSheet) {
        try {
          var cfg = JSON.parse(configSheet.getRange("A1").getValue());
          if (cfg && cfg.lineChannelAccessToken) {
            lineCfg.isConfigured = true;
            lineCfg.botBasicId = cfg.lineBotBasicId || '';
          }
        } catch(e) {}
      }

      var bindSheetName = prefix + "LINE用戶綁定";
      var bindSheet = ss.getSheetByName(bindSheetName);
      if (bindSheet) {
        var tCol = getColorForPrefix(prefix);
        if (tCol) {
          try { if (bindSheet.getTabColor() !== tCol) bindSheet.setTabColor(tCol); } catch(e) {}
        }
      }
      var bindings = [];
      if (bindSheet && bindSheet.getLastRow() > 1) {
        var bData = bindSheet.getDataRange().getDisplayValues();
        for (var b = 1; b < bData.length; b++) {
          bindings.push({
            studentId: bData[b][0],
            studentName: bData[b][1],
            token: bData[b][2],
            lineUserId: bData[b][3],
            boundAt: bData[b][4],
            isBound: !!(bData[b][3] && bData[b][3].trim())
          });
        }
      }
      var viewData = getParentViewData(prefix);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        config: lineCfg,
        bindings: bindings,
        parentViewStats: viewData.stats,
        parentViewLogs: viewData.logs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'line_push_missing') {
      var configSheet = ss.getSheetByName("SystemConfig");
      var tokenToUse = payload.lineChannelAccessToken || "";
      if (!tokenToUse && configSheet) {
        try {
          var cfg = JSON.parse(configSheet.getRange("A1").getValue());
          if (cfg && cfg.lineChannelAccessToken) tokenToUse = cfg.lineChannelAccessToken;
        } catch(e) {}
      }

      if (!tokenToUse) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '尚未設定 LINE Channel Access Token！' })).setMimeType(ContentService.MimeType.JSON);
      }

      var bindSheetName = prefix + "LINE用戶綁定";
      var bindSheet = ss.getSheetByName(bindSheetName);
      if (bindSheet) {
        var tCol = getColorForPrefix(prefix);
        if (tCol) {
          try { if (bindSheet.getTabColor() !== tCol) bindSheet.setTabColor(tCol); } catch(e) {}
        }
      }
      var userMap = {};
      if (bindSheet && bindSheet.getLastRow() > 1) {
        var bData = bindSheet.getDataRange().getDisplayValues();
        for (var b = 1; b < bData.length; b++) {
          var sid = bData[b][0].toString().trim();
          var uid = bData[b][3] ? bData[b][3].toString().trim() : '';
          if (sid && uid) userMap[sid] = uid;
        }
      }

      var targets = payload.targets || [];
      var successCount = 0;
      var failCount = 0;
      var skippedCount = 0;

      for (var t = 0; t < targets.length; t++) {
        var tgt = targets[t];
        var uid = userMap[tgt.studentId.toString()] || tgt.lineUserId;
        if (!uid) {
          skippedCount++;
          continue;
        }

        var portalUrl = getPortalUrl(prefix, tgt.token);
        var msgText = "";
        if (tgt.customMessage && tgt.customMessage.toString().trim() !== "") {
          msgText = tgt.customMessage.toString();
        } else {
          var taskLines = [];
          (tgt.missingTasks || []).forEach(function(mt) {
            var rg = mt.range ? " (" + mt.range + ")" : "";
            taskLines.push("‧ 【" + mt.subject + "】" + mt.taskName + rg);
          });
          if (taskLines.length === 0) taskLines.push("‧ 請參閱作業手札待補交清單");

          msgText = "🚨 【作業待補交提醒】\n\n" +
            maskStudentName(tgt.studentName) + " 家長您好：\n" +
            "今日學校清點作業，孩子尚有 " + (tgt.missingTasks ? tgt.missingTasks.length : 0) + " 項作業待補交：\n" +
            taskLines.join("\n") + "\n\n" +
            "請您今晚撥冗提醒並陪伴孩子於明日到校前補齊！\n\n" +
            "🔗 點此秒開專屬手札查看明細：\n" + portalUrl + "\n\n" +
            "（由 班級作業管理系統 自動推播）";
        }

        try {
          var pushResp = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + tokenToUse
            },
            payload: JSON.stringify({
              to: uid,
              messages: [{ type: "text", text: msgText }]
            }),
            muteHttpExceptions: true
          });
          if (pushResp.getResponseCode() === 200) {
            successCount++;
          } else {
            console.error("Push failed for " + tgt.studentName + ": " + pushResp.getContentText());
            failCount++;
          }
        } catch(pushErr) {
          console.error("Push error: " + pushErr);
          failCount++;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        successCount: successCount,
        failCount: failCount,
        skippedCount: skippedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'line_unbind_student') {
      var bindSheetName = prefix + "LINE用戶綁定";
      var bindSheet = ss.getSheetByName(bindSheetName);
      if (bindSheet) {
        var tCol = getColorForPrefix(prefix);
        if (tCol) {
          try { if (bindSheet.getTabColor() !== tCol) bindSheet.setTabColor(tCol); } catch(e) {}
        }
      }
      var studentId = (payload.studentId || "").toString().trim();
      var unboundName = "";
      if (bindSheet && bindSheet.getLastRow() > 1) {
        var bData = bindSheet.getDataRange().getDisplayValues();
        for (var b = 1; b < bData.length; b++) {
          if (bData[b][0].toString().trim() === studentId) {
            unboundName = bData[b][1];
            bindSheet.getRange(b + 1, 4, 1, 3).setValues([["", Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss"), "教師手動解除"]]);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', studentName: unboundName })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'hide_class_tabs') {
      if (!prefix) return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'No prefix provided'})).setMimeType(ContentService.MimeType.JSON);
      var sheets = ss.getSheets();
      var count = 0;
      for (var i = 0; i < sheets.length; i++) {
        var s = sheets[i];
        if (s.getName().indexOf(prefix) === 0) {
          s.hideSheet();
          count++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success', hiddenCount: count})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (payload.action === 'show_class_tabs') {
      if (!prefix) return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'No prefix provided'})).setMimeType(ContentService.MimeType.JSON);
      var sheets = ss.getSheets();
      var count = 0;
      var tCol = getColorForPrefix(prefix);
      for (var i = 0; i < sheets.length; i++) {
        var s = sheets[i];
        if (s.getName().indexOf(prefix) === 0) {
          s.showSheet();
          if (tCol) {
            try { if (s.getTabColor() !== tCol) s.setTabColor(tCol); } catch(err) {}
          }
          count++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success', shownCount: count})).setMimeType(ContentService.MimeType.JSON);
    }
    
    var studentSheetName = prefix + "學生名單";
    var logSheetName = prefix + "所有掃描紀錄";

    // 取得設定與學生名單 (具備班級自動發現與容錯機制)
    if (payload.action === 'get_students') {
      // 1. 讀取全域設定檔 (不加前綴)
      var config = null;
      var configSheet = ss.getSheetByName("SystemConfig");
      if (configSheet) {
        var configStr = configSheet.getRange("A1").getValue();
        if (configStr) {
          try { config = JSON.parse(configStr); } catch (err) {}
        }
      }

      // 2. 自動掃描所有班級
      var disc = discoverAllClasses(config);
      config = disc.config;
      var discovered = disc.discovered;
      var allSheets = ss.getSheets();

      // 自動檢查並為所有班級分頁加上色彩標籤 (包含 LINE用戶綁定 等分頁)
      for (var si = 0; si < allSheets.length; si++) {
        var curSh = allSheets[si];
        var shM = curSh.getName().match(/^\[([^\]]+)\]/);
        if (shM) {
          var scCol = getColorForPrefix(shM[1]);
          if (scCol) {
            try { if (curSh.getTabColor() !== scCol) curSh.setTabColor(scCol); } catch(err) {}
          }
        }
      }

      // 3. 尋找目標學生名單分頁
      var studentSheet = null;
      
      // (a) 若有傳入前綴，先找精確匹配
      if (prefix) {
        studentSheet = ss.getSheetByName(studentSheetName);
        if (!studentSheet) {
          // 模糊搜尋包含 rawPrefix 的學生名單分頁
          for (var i = 0; i < allSheets.length; i++) {
            var n = allSheets[i].getName();
            if (n.indexOf(rawPrefix) !== -1 && n.indexOf("學生名單") !== -1) {
              studentSheet = allSheets[i];
              break;
            }
          }
        }
      }

      // (b) 若無前綴或未找到，依據 config.activeClassId 尋找
      if (!studentSheet && config && config.activeClassId && config.classes) {
        for (var c = 0; c < config.classes.length; c++) {
          if (config.classes[c].id === config.activeClassId) {
            var targetPrefix = config.classes[c].prefix || config.classes[c].label;
            studentSheet = ss.getSheetByName("[" + targetPrefix + "] 學生名單");
            if (!studentSheet) {
              for (var i = 0; i < allSheets.length; i++) {
                var n = allSheets[i].getName();
                if (n.indexOf(targetPrefix) !== -1 && n.indexOf("學生名單") !== -1) {
                  studentSheet = allSheets[i];
                  break;
                }
              }
            }
            break;
          }
        }
      }

      // (c) 若仍未找到，直接取試算表第一個發現的學生名單分頁
      if (!studentSheet && discovered.length > 0) {
        studentSheet = ss.getSheetByName(discovered[0].sheetName);
        // 同步將該班設為作用中班級
        if (config && config.classes && config.classes.length > 0) {
          var matchedCls = config.classes.find(function(c) { return c.prefix === discovered[0].prefix || c.label === discovered[0].label; });
          if (matchedCls) config.activeClassId = matchedCls.id;
        }
      }

      // (d) 若試算表中完全不存在任何學生名單分頁
      if (!studentSheet) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: '試算表中找不到任何「學生名單」分頁。請先在「0. 資料建置」建立班級與學生後點擊「備份至雲端」！'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var data = studentSheet.getDataRange().getDisplayValues();
      if (data.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({status: 'success', students: [], config: config})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var headers = data[0];
      var idIndex = headers.indexOf("座號");
      var nameIndex = headers.indexOf("姓名");
      var tokenIndex = headers.indexOf("防偽碼");
      if (tokenIndex === -1) tokenIndex = headers.indexOf("系統代碼");
      var saltIndex = headers.indexOf("系統暗碼(勿動)");
      
      if (idIndex === -1) idIndex = 0;
      if (nameIndex === -1) nameIndex = 1;
      
      var students = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var id = row[idIndex];
        var name = row[nameIndex];
        var token = (tokenIndex !== -1 && row[tokenIndex]) ? row[tokenIndex].toString().trim() : '';
        var salt = (saltIndex !== -1 && row[saltIndex]) ? row[saltIndex].toString().trim() : '';
        if (id && name) {
          students.push({ id: id.toString().trim(), name: name.toString().trim(), token: token, salt: salt });
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success', students: students, config: config})).setMimeType(ContentService.MimeType.JSON);
    }

    // 取得家長閱覽即時足跡與歷程
    if (payload.action === 'get_parent_views') {
      var viewData = getParentViewData(prefix);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        stats: viewData.stats,
        logs: viewData.logs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 家長端專屬查詢 (僅支援小卡專屬 QR Code 代碼，保護學生隱私)
    if (payload.action === 'parent_query') {
      var queryToken = (payload.token || '').toString().trim().toUpperCase();
      
      if (!queryToken) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '為保護學生隱私，請掃描小卡專屬 QR Code 登入'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var found = findStudentByToken(queryToken, prefix);
      if (!found) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '查無此專屬代碼之學生資料，請確認小卡是否正確。'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var targetStudent = found.student;
      var matchedPrefix = found.classPrefix;
      var classLabel = matchedPrefix ? matchedPrefix.replace(/\[|\]/g, '').trim() : '目前班級';
      
      // 讀取該學生的各科作業紀錄與彙總
      var summary = getStudentStatusSummary(matchedPrefix, targetStudent);

      // 自動記錄家長閱覽足跡
      var viewNote = (summary.missingTasks && summary.missingTasks.length > 0)
        ? ("待補交 " + summary.missingTasks.length + " 項")
        : "作業全數繳齊";
      logParentView(matchedPrefix, targetStudent, payload.source || "📱 手機手札 (QR掃碼)", viewNote);
      
      // 讀取該學生的近期打卡紀錄 (所有掃描紀錄)，並對照各科目分頁校正遲交與截止日狀態
      var logSheetName = matchedPrefix + "所有掃描紀錄";
      var logSheet = ss.getSheetByName(logSheetName);
      var recentLogs = [];
      if (logSheet && logSheet.getLastRow() > 1) {
        var logValues = logSheet.getDataRange().getDisplayValues();
        for (var l = logValues.length - 1; l >= 1; l--) {
          var lRow = logValues[l];
          if (lRow[5] && lRow[5].toString().trim() === targetStudent.name) {
            var matchTask = null;
            for (var st = 0; st < summary.tasks.length; st++) {
              var stk = summary.tasks[st];
              if (stk.subject === lRow[2] && stk.taskName === lRow[3]) {
                if (!lRow[4] || stk.range === lRow[4] || !stk.range) {
                  matchTask = stk;
                  break;
                }
              }
            }

            // 狀態判定優先權：
            // 1. 若該科目分頁中老師有登記或判定為「[遲交]」，連動校正為遲交（解決老師在分頁標記遲交後足跡顯示不一致問題）
            // 2. 若該科目分頁為假別（事假、病假等），顯示假別
            // 3. 若「所有掃描紀錄」中打卡狀態登記為「遲交」，則為遲交
            // 4. 其餘正常打卡紀錄皆為「已繳交」(準時)
            var finalStatus = lRow[6] || '已繳交';
            
            if (matchTask && matchTask.status) {
              if (matchTask.status.indexOf('[遲交]') !== -1 || matchTask.status.indexOf('遲交') !== -1 || matchTask.status.toLowerCase().indexOf('late') !== -1) {
                finalStatus = '遲交';
              } else if (['事假', '病假', '公假', '喪假', '免交', '請假', '其他'].indexOf(matchTask.status) !== -1) {
                finalStatus = matchTask.status;
              }
            } else if (finalStatus.indexOf('[遲交]') !== -1 || finalStatus.indexOf('遲交') !== -1 || finalStatus.toLowerCase().indexOf('late') !== -1) {
              finalStatus = '遲交';
            }

            recentLogs.push({
              timestamp: lRow[0],
              subject: lRow[2],
              taskName: lRow[3],
              range: lRow[4],
              status: finalStatus
            });
            if (recentLogs.length >= 25) break;
          }
        }
      }
      
      // 讀取 LINE Bot Basic ID (供家長端一秒深層連結)
      var botBasicId = "";
      var configSheet = ss.getSheetByName("SystemConfig");
      if (configSheet) {
        try {
          var cfg = JSON.parse(configSheet.getRange("A1").getValue());
          if (cfg && cfg.lineBotBasicId) botBasicId = cfg.lineBotBasicId;
        } catch(e) {}
      }

      // 檢查此學生是否已經有 LINE 家長綁定
      var isLineBound = false;
      var bindSheetName = matchedPrefix + "LINE用戶綁定";
      var bindSheet = ss.getSheetByName(bindSheetName);
      if (bindSheet && bindSheet.getLastRow() > 1) {
        var bData = bindSheet.getDataRange().getDisplayValues();
        for (var b = 1; b < bData.length; b++) {
          var bSid = (bData[b][0] || '').toString().trim();
          var bTok = (bData[b][2] || '').toString().trim().toUpperCase();
          var bUid = (bData[b][3] || '').toString().trim();
          var bStatus = (bData[b][5] || '').toString().trim();
          var isMatchStudent = (bSid === targetStudent.id.toString().trim()) || 
                               (bTok && targetStudent.token && bTok === targetStudent.token.toString().trim().toUpperCase());
          if (isMatchStudent && bUid !== '' && bStatus !== '已解除' && bStatus !== '教師手動解除') {
            isLineBound = true;
            break;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        syncedAt: new Date().toISOString(),
        student: {
          id: targetStudent.id,
          name: maskStudentName(targetStudent.name),
          token: targetStudent.token
        },
        className: classLabel,
        lineBotBasicId: botBasicId,
        isLineBound: isLineBound,
        tasks: summary.tasks,
        recentLogs: recentLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 從雲端拉取所有繳交紀錄
    if (payload.action === 'pull_sync') {
      var sheetNames = getSheetNames(ss);
      var sheetsData = [];
      
      for (var i = 0; i < sheetNames.length; i++) {
        var sheetName = sheetNames[i];
        
        // 過濾邏輯：
        // 1. 忽略全域的 SystemConfig
        // 2. 如果有 prefix，只抓取以 prefix 開頭的。如果是向後相容模式 (沒有 prefix)，則排除所有帶有 "[" 開頭的分頁 (代表那些是新制班級)
        if (sheetName === "SystemConfig") continue;
        
        if (prefix !== "") {
          if (sheetName.indexOf(prefix) !== 0) continue; // 必須是以該班級前綴開頭
        } else {
          if (sheetName.indexOf("[") === 0) continue; // 舊模式不抓取新制分頁
        }
        
        // 忽略該班級的學生名單、所有掃描紀錄、統計分頁
        var baseName = sheetName;
        if (prefix !== "") {
           baseName = sheetName.substring(prefix.length);
        }
        
        if (baseName === "學生名單" || baseName === "所有掃描紀錄" || baseName.indexOf("統計") !== -1 || baseName === "LINE用戶綁定" || baseName === "家長閱覽紀錄") {
          continue;
        }
        
        var targetSheet = ss.getSheetByName(sheetName);
        if (targetSheet) {
            var data = targetSheet.getDataRange().getDisplayValues();
            if (data.length >= 4) {
              sheetsData.push({
                name: baseName, // 回傳給前端時拔掉前綴，這樣前端才認得
                data: data
              });
            }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', sheetsData: sheetsData})).setMimeType(ContentService.MimeType.JSON);
    }

    // 備份全系統設定與學生名單
    if (payload.action === 'sync_students') {
      var studentSheet = ensureSheetAndColor(studentSheetName);
      studentSheet.clear();
      
      var students = payload.students || [];
      var dataToPush = [["座號", "姓名", "系統代碼", "系統暗碼(勿動)"]];
      
      students.forEach(function(s) {
        dataToPush.push([s.id, s.name, s.token || '', s.salt || '']);
      });
      
      studentSheet.getRange(1, 1, dataToPush.length, 4).setValues(dataToPush);
      studentSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
      studentSheet.setFrozenRows(1);
      try { studentSheet.showColumns(4); } catch(err) {} // 確保 D 欄不被隱藏
      
      if (payload.config) {
        var configSheet = ss.getSheetByName("SystemConfig");
        if (!configSheet) {
          configSheet = ss.insertSheet("SystemConfig");
          configSheet.hideSheet();
        }
        configSheet.getRange("A1").setValue(JSON.stringify(payload.config));
      }

      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (payload.action === 'upload_records' || payload.action === 'full_sync') {
      var records = payload.records || [];
      if (records.length > 0) {
        var logSheet = ensureSheetAndColor(logSheetName);
        if (logSheet.getLastRow() === 0) {
          logSheet.appendRow(["打卡時間", "班級", "科目", "作業名稱", "範圍", "學生姓名", "狀態"]);
          logSheet.setFrozenRows(1);
        }
        records.forEach(function(row) {
          logSheet.appendRow([row.timestamp, row.className || '', row.subject, row.taskName, row.range, row.studentName, row.status]);
        });
      }
      
      if (payload.action === 'full_sync' && payload.sheets) {
        payload.sheets.forEach(function(sheetObj) {
          // 加上前綴再存進雲端
          var name = prefix + sheetObj.name;
          var data = sheetObj.data;
          if (data && data.length > 0) {
            var targetSheet = ensureSheetAndColor(name);
            targetSheet.clear();
            targetSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
            
            targetSheet.setFrozenColumns(1);
            if (name.indexOf("統計報表") !== -1) {
              // 確保只有第一行被凍結及加粗
              try { targetSheet.setFrozenRows(1); } catch(err) {}
              
              var headers = data[0];
              var numRows = data.length;
              var currentSubject = "";
              var isGray = false;
              var colorWhite = "#ffffff";
              var colorGray = "#f3f4f6";
              
              // 標題加粗
              targetSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
              
              for (var c = 0; c < headers.length; c++) {
                var colIndex = c + 1;
                var headerName = headers[c];
                
                // 決定隸屬的大科目
                var subjectGroup = headerName;
                if (headerName.indexOf("整體_") !== -1) {
                    subjectGroup = headerName.split("整體_")[0];
                } else if (headerName.indexOf("_") !== -1) {
                    subjectGroup = headerName.split("_")[0];
                }
                
                if (subjectGroup !== currentSubject && c > 0) {
                    currentSubject = subjectGroup;
                    isGray = !isGray; // 切換底色
                    
                    // 畫左側粗黑線
                    targetSheet.getRange(1, colIndex, numRows, 1).setBorder(null, true, null, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
                } else if (c === 0) {
                    currentSubject = "姓名";
                }
                
                // 上底色
                targetSheet.getRange(1, colIndex, numRows, 1).setBackground(isGray ? colorGray : colorWhite);
                
                // 隱藏非整體的細項
                if (c > 0) {
                    if (headerName.indexOf("_") !== -1 && headerName.indexOf("整體_") === -1) {
                      try { targetSheet.hideColumns(colIndex); } catch (err) {}
                    } else {
                      try { targetSheet.showColumns(colIndex); } catch (err) {}
                    }
                }
              }
            } else {
              try { targetSheet.setFrozenRows(3); } catch(err) {}
              targetSheet.getRange(1, 1, 3, data[0].length).setFontWeight("bold").setBackground("#f3f4f6");
            }
            
            var rules = [];
            var range = targetSheet.getDataRange();
            var ruleRed1 = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("缺交").setFontColor("#ef4444").setBold(true).setRanges([range]).build();
            var ruleRed3 = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("沒帶").setFontColor("#ef4444").setBold(true).setRanges([range]).build();
            var ruleRed2 = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("曠課").setFontColor("#ef4444").setBold(true).setRanges([range]).build();
            
            var ruleLowOntime = SpreadsheetApp.newConditionalFormatRule()
              .whenFormulaSatisfied('=AND(REGEXMATCH(A$1, "準時率"), IFERROR(VALUE(A1), 1) < 0.8, A1<>"")')
              .setFontColor("#ef4444")
              .setBold(true)
              .setRanges([range])
              .build();
              
            rules.push(ruleRed1, ruleRed2, ruleRed3, ruleLowOntime);
            
            var leaves = ["事假", "病假", "公假", "喪假", "其他"];
            leaves.forEach(function(leave) {
               var rulePurple = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(leave).setFontColor("#7e22ce").setBold(true).setRanges([range]).build();
               rules.push(rulePurple);
            });
            
            targetSheet.setConditionalFormatRules(rules);
          }
        });
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
