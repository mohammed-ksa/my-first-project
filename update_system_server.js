const fs = require('fs');

// Read HTML
let html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');

// We need to extract the existing INIT_PATIENTS and INIT_VISITS and put them into database.json
const pStart = html.indexOf('var INIT_PATIENTS = ');
if (pStart !== -1) {
    const pEnd = html.indexOf(';\n    var INIT_VISITS = ', pStart);
    if (pEnd !== -1) {
        const patientsJsonStr = html.substring(pStart + 20, pEnd);
        const vStart = html.indexOf('var INIT_VISITS = ') + 18;
        const vEnd = html.indexOf(';\n\n    const GOV', vStart);
        if (vEnd !== -1) {
            const visitsJsonStr = html.substring(vStart, vEnd);
            fs.writeFileSync('database.json', `{"patients": ${patientsJsonStr}, "visits": ${visitsJsonStr}}`, 'utf8');
            console.log("Exported initial data to database.json");
        }
    }
}

// Modify loadData to fetch from server
const oldLoadData = `async function loadData() {
      await openDB(); const p = await dbGet("patients").catch(() => null); const v = await dbGet("visits").catch(() => null);
      P = p || INIT_PATIENTS; V = v || INIT_VISITS; uB()
    }`;

const newLoadData = `async function loadData() {
      await openDB();
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const data = await res.json();
          P = Object.keys(data.patients).length > 0 ? data.patients : INIT_PATIENTS;
          V = data.visits.length > 0 ? data.visits : INIT_VISITS;
          await dbPut("patients", P); await dbPut("visits", V);
        } else throw new Error();
      } catch (e) {
        const p = await dbGet("patients").catch(() => null); const v = await dbGet("visits").catch(() => null);
        P = p || INIT_PATIENTS; V = v || INIT_VISITS;
      }
      uB()
    }`;

if (html.includes(oldLoadData)) {
    html = html.replace(oldLoadData, newLoadData);
}

// Modify doSave to post to server
const oldSaveStr = `await dbPut("patients", P); await dbPut("visits", V);`;
const newSaveStr = `await dbPut("patients", P); await dbPut("visits", V); try{await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patients:P,visits:V})})}catch(e){console.error("Server sync failed")}`;

if (html.includes(oldSaveStr)) {
    html = html.replace(oldSaveStr, newSaveStr);
}

// Modify Backup (Export JSON) to also download what is in memory, this is already fine because doExport uses P and V.

// Rewrite HTML
fs.writeFileSync('IMS_Medical_System_4.html', html, 'utf8');
console.log("HTML modified successfully for Server Sync.");
