function(e, ss, getSheetNames) {
  try {
    var payload = JSON.parse(e.postData.contents);
    
    if (payload.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 如果有傳入 classPrefix，就在所有分頁名稱加上前綴，例如 "[112上-三年甲班] "
    var prefix = "";
    if (payload.classPrefix) {
      prefix = "[" + payload.classPrefix + "] ";
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

    // 取得設定與學生名單
    if (payload.action === 'get_students') {
      var studentSheet = ss.getSheetByName(studentSheetName);
      if (!studentSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '找不到名為「' + studentSheetName + '」的分頁'})).setMimeType(ContentService.MimeType.JSON);
      }
      
      // 讀取全域設定檔 (不加前綴)
      var config = null;
      var configSheet = ss.getSheetByName("SystemConfig");
      if (configSheet) {
        var configStr = configSheet.getRange("A1").getValue();
        if (configStr) {
          try { config = JSON.parse(configStr); } catch (err) {}
        }
      }

      var data = studentSheet.getDataRange().getDisplayValues();
      if (data.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({status: 'success', students: [], config: config})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var headers = data[0];
      var idIndex = headers.indexOf("座號");
      var nameIndex = headers.indexOf("姓名");
      var tokenIndex = headers.indexOf("防偽碼");
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
      var dataToPush = [["座號", "姓名", "防偽碼", "系統暗碼(勿動)"]];
      
      students.forEach(function(s) {
        dataToPush.push([s.id, s.name, s.token || '', s.salt || '']);
      });
      
      studentSheet.getRange(1, 1, dataToPush.length, 4).setValues(dataToPush);
      studentSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
      studentSheet.setFrozenRows(1);
      try { studentSheet.hideColumns(4); } catch(err) {} // 隱藏暗碼欄位，保持畫面清爽
      
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
            var targetSheet = ss.getSheetByName(name);
            if (!targetSheet) { targetSheet = ensureSheetAndColor(name); }
            targetSheet.clear();
            targetSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
            
            targetSheet.setFrozenRows(3);
            targetSheet.setFrozenColumns(1);
            targetSheet.getRange(1, 1, 3, data[0].length).setFontWeight("bold").setBackground("#f3f4f6");
            
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
