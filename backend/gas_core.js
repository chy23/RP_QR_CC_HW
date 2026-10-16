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

    function getColorForPrefix(p) {
      if (!p) return null;
      var colors = ['#ea4335', '#fbbc04', '#34a853', '#4285f4', '#ff6d01', '#46bdc6', '#7baaf7', '#d01884', '#00bfa5', '#9c27b0', '#e91e63', '#673ab7'];
      var hash = 0;
      for (var i = 0; i < p.length; i++) {
        hash = p.charCodeAt(i) + ((hash << 5) - hash);
      }
      hash = Math.abs(hash);
      return colors[hash % colors.length];
    }
    
    function ensureSheetAndColor(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      var tabColor = getColorForPrefix(payload.classPrefix || "");
      if (tabColor) {
        try { if (sheet.getTabColor() !== tabColor) sheet.setTabColor(tabColor); } catch(err) {}
      }
      return sheet;
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
      for (var i = 0; i < sheets.length; i++) {
        var s = sheets[i];
        if (s.getName().indexOf(prefix) === 0) {
          s.showSheet();
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

    // 家長端專屬查詢 (僅支援小卡專屬 QR Code 代碼，保護學生隱私)
    if (payload.action === 'parent_query') {
      var queryToken = (payload.token || '').toString().trim().toUpperCase();
      
      if (!queryToken) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '為保護學生隱私，請掃描小卡專屬 QR Code 登入'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var allSheets = ss.getSheets();
      var targetStudent = null;
      var matchedPrefix = prefix;
      
      // 1. 尋找學生 (若有指定班級前綴先查該班，否則搜尋所有學生名單分頁)
      for (var i = 0; i < allSheets.length; i++) {
        var sName = allSheets[i].getName();
        if (sName.indexOf("學生名單") !== -1) {
          if (prefix && sName.indexOf(prefix) !== 0) continue;
          
          var sData = allSheets[i].getDataRange().getDisplayValues();
          if (sData.length > 1) {
            var h = sData[0];
            var idIdx = h.indexOf("座號") !== -1 ? h.indexOf("座號") : 0;
            var nameIdx = h.indexOf("姓名") !== -1 ? h.indexOf("姓名") : 1;
            var tokIdx = h.indexOf("防偽碼") !== -1 ? h.indexOf("防偽碼") : h.indexOf("系統代碼");
            
            for (var r = 1; r < sData.length; r++) {
              var row = sData[r];
              var rId = row[idIdx].toString().trim();
              var rName = row[nameIdx].toString().trim();
              var rTok = (tokIdx !== -1 && row[tokIdx]) ? row[tokIdx].toString().trim().toUpperCase() : '';
              
              var isMatch = false;
              if (queryToken && rTok && rTok === queryToken) isMatch = true;
              else if (queryToken && !rTok && ('STU' + ('00' + rId).slice(-3)).toUpperCase() === queryToken) isMatch = true;
              
              if (isMatch) {
                targetStudent = { id: rId, name: rName, token: rTok || ('STU' + ('00' + rId).slice(-3)) };
                matchedPrefix = sName.replace("學生名單", "");
                break;
              }
            }
          }
          if (targetStudent) break;
        }
      }
      
      if (!targetStudent) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '查無此代碼或學生，請確認代碼是否正確。'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      // 2. 取得班級資訊
      var classLabel = matchedPrefix ? matchedPrefix.replace(/\[|\]/g, '').trim() : '目前班級';
      
      // 3. 讀取該班級的各科目分頁資料 (抓取該學生的作業紀錄)
      var studentTasks = [];
      for (var j = 0; j < allSheets.length; j++) {
        var sheet = allSheets[j];
        var sName2 = sheet.getName();
        if (matchedPrefix && sName2.indexOf(matchedPrefix) !== 0) continue;
        if (!matchedPrefix && sName2.indexOf("[") === 0) continue;
        
        var baseName = matchedPrefix ? sName2.substring(matchedPrefix.length) : sName2;
        if (baseName === "學生名單" || baseName === "所有掃描紀錄" || baseName.indexOf("統計") !== -1 || baseName === "SystemConfig") continue;
        
        var sheetValues = sheet.getDataRange().getDisplayValues();
        if (sheetValues.length >= 4) {
          var headerTaskNames = sheetValues[0];
          var headerRanges = sheetValues[1];
          var headerDates = sheetValues[2];
          
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

              // 檢查該作業欄位在全班是否有任何登記資料 (是否有任何學生在該欄位有紀錄)
              var colHasAnyStudentData = false;
              for (var rowCheck = 3; rowCheck < sheetValues.length; rowCheck++) {
                if (sheetValues[rowCheck][col] && sheetValues[rowCheck][col].toString().trim() !== '') {
                  colHasAnyStudentData = true;
                  break;
                }
              }

              // 若全班沒有任何學生在該作業有紀錄，且試算表欄位未設定範圍或日期，代表尚未開始清點，不計入準時率！
              if (!colHasAnyStudentData && !tRange && !tDate) {
                continue;
              }

              var tStatus = studentRowValues[col] || '';
              if (!tStatus) tStatus = '缺交';
              
              studentTasks.push({
                subject: baseName,
                taskName: tName,
                range: tRange,
                date: tDate,
                status: tStatus
              });
            }
          }
        }
      }
      
      // 4. 讀取該學生的近期打卡紀錄 (所有掃描紀錄)
      var logSheetName = matchedPrefix + "所有掃描紀錄";
      var logSheet = ss.getSheetByName(logSheetName);
      var recentLogs = [];
      if (logSheet && logSheet.getLastRow() > 1) {
        var logValues = logSheet.getDataRange().getDisplayValues();
        for (var l = logValues.length - 1; l >= 1; l--) {
          var lRow = logValues[l];
          if (lRow[5] && lRow[5].toString().trim() === targetStudent.name) {
            recentLogs.push({
              timestamp: lRow[0],
              subject: lRow[2],
              taskName: lRow[3],
              range: lRow[4],
              status: lRow[6]
            });
            if (recentLogs.length >= 25) break;
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        syncedAt: new Date().toISOString(),
        student: targetStudent,
        className: classLabel,
        tasks: studentTasks,
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
        
        if (baseName === "學生名單" || baseName === "所有掃描紀錄" || baseName.indexOf("統計") !== -1) {
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
