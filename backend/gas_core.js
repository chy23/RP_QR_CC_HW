// 這份檔案的內容會被直接 eval 插入到 Wrapper 的 doPost(e) 中執行
var payload = JSON.parse(e.postData.contents);
var ss = SpreadsheetApp.getActiveSpreadsheet();

if (payload.action === 'ping') {
  // 注意，這裡回傳的結果會成為 eval 的最終回傳值
  ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
} else if (payload.action === 'get_students') {
  var studentSheet = ss.getSheetByName("學生名單");
  if (!studentSheet) {
    ContentService.createTextOutput(JSON.stringify({status: 'error', message: '找不到名為「學生名單」的分頁'})).setMimeType(ContentService.MimeType.JSON);
  } else {
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
      ContentService.createTextOutput(JSON.stringify({status: 'success', students: [], config: config})).setMimeType(ContentService.MimeType.JSON);
    } else {
      var headers = data[0];
      var idIndex = headers.indexOf("座號");
      var nameIndex = headers.indexOf("姓名");
      var tokenIndex = headers.indexOf("防偽碼");
      
      if (idIndex === -1) idIndex = 0;
      if (nameIndex === -1) nameIndex = 1;
      
      var students = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var id = row[idIndex];
        var name = row[nameIndex];
        var token = (tokenIndex !== -1 && row[tokenIndex]) ? row[tokenIndex].toString().trim() : '';
        if (id && name) {
          students.push({ id: id.toString().trim(), name: name.toString().trim(), token: token });
        }
      }
      ContentService.createTextOutput(JSON.stringify({status: 'success', students: students, config: config})).setMimeType(ContentService.MimeType.JSON);
    }
  }
} else if (payload.action === 'pull_sync') {
  var allSheets = ss.getSheets();
  var sheetsData = [];
  
  for (var i = 0; i < allSheets.length; i++) {
    var sheetName = allSheets[i].getName();
    if (sheetName === "學生名單" || sheetName === "SystemConfig" || sheetName === "所有掃描紀錄" || sheetName.indexOf("統計") !== -1) {
      continue;
    }
    
    var data = allSheets[i].getDataRange().getDisplayValues();
    if (data.length >= 4) {
      sheetsData.push({
        name: sheetName,
        data: data
      });
    }
  }
  
  ContentService.createTextOutput(JSON.stringify({status: 'success', sheetsData: sheetsData})).setMimeType(ContentService.MimeType.JSON);
} else if (payload.action === 'sync_students') {
  var studentSheet = ss.getSheetByName("學生名單");
  if (!studentSheet) {
    studentSheet = ss.insertSheet("學生名單");
  }
  studentSheet.clear();
  
  var students = payload.students || [];
  var dataToPush = [["座號", "姓名", "防偽碼"]];
  
  students.forEach(function(s) {
    dataToPush.push([s.id, s.name, s.token || '']);
  });
  
  studentSheet.getRange(1, 1, dataToPush.length, 3).setValues(dataToPush);
  studentSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f3f4f6");
  studentSheet.setFrozenRows(1);
  
  if (payload.config) {
    var configSheet = ss.getSheetByName("SystemConfig");
    if (!configSheet) {
      configSheet = ss.insertSheet("SystemConfig");
      configSheet.hideSheet();
    }
    configSheet.getRange("A1").setValue(JSON.stringify(payload.config));
  }

  ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
} else if (payload.action === 'upload_records' || payload.action === 'full_sync') {
  var records = payload.records || [];
  if (records.length > 0) {
    var logSheet = ss.getSheetByName("所有掃描紀錄");
    if (!logSheet) {
      logSheet = ss.insertSheet("所有掃描紀錄");
      logSheet.appendRow(["打卡時間", "班級", "科目", "作業名稱", "範圍", "學生姓名", "狀態"]);
      logSheet.setFrozenRows(1);
    }
    records.forEach(function(row) {
      logSheet.appendRow([row.timestamp, row.className || '', row.subject, row.taskName, row.range, row.studentName, row.status]);
    });
  }
  
  if (payload.action === 'full_sync' && payload.sheets) {
    payload.sheets.forEach(function(sheetObj) {
      var name = sheetObj.name;
      var data = sheetObj.data;
      if (data && data.length > 0) {
        var targetSheet = ss.getSheetByName(name);
        if (!targetSheet) { targetSheet = ss.insertSheet(name); }
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
  ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
} else {
  ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Unknown action"})).setMimeType(ContentService.MimeType.JSON);
}
