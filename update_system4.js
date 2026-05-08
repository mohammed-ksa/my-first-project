const fs = require('fs');

// 1. Read backup file and HTML file
const backup = JSON.parse(fs.readFileSync('IMS_Backup_2026-04-26.json', 'utf8'));
let html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');

// The backup might contain old gender values ("ذكر", "انثى"). We should migrate them just in case.
Object.values(backup.patients).forEach(p => {
    if (p.gender === "ذكر" || p.gender === "ط°ظƒط±") p.gender = "Male";
    if (p.gender === "انثى" || p.gender === "ط§ظ†ط«ظ‰" || p.gender === "أنثى" || p.gender === "ط£ظ†ط«ظ‰") p.gender = "Female";
});
backup.visits.forEach(v => {
    if (v.gender === "ذكر" || v.gender === "ط°ظƒط±") v.gender = "Male";
    if (v.gender === "انثى" || v.gender === "ط§ظ†ط«ظ‰" || v.gender === "أنثى" || v.gender === "ط£ظ†ط«ظ‰") v.gender = "Female";
});

const patientsStr = JSON.stringify(backup.patients);
const visitsStr = JSON.stringify(backup.visits);

// 2. Replace INIT_PATIENTS and INIT_VISITS
html = html.replace(/const INIT_PATIENTS=\{.*?\};/, `const INIT_PATIENTS=${patientsStr};`);
html = html.replace(/const INIT_VISITS=\[.*?\];/, `const INIT_VISITS=${visitsStr};`);

// 3. Update Search UI
const oldSearchUI = `<div class="srch"><input id="sI" placeholder="بحث بالاسم أو رقم الهوية..." oninput="rList()"></div>`;
const newSearchUI = `<div class="srch" style="flex-wrap:wrap; gap:8px;"><input id="sI" placeholder="بحث بالاسم، رقم الهوية، أو الهاتف..." oninput="rList()" style="flex:1; min-width: 200px;"><input id="sDate" type="date" onchange="rList()" style="padding:10px 14px; border:1.5px solid var(--b); border-radius:var(--rd); font-family:inherit; background:var(--c); outline:none;"><select id="sSrv" onchange="rList()" style="padding:10px 14px; border:1.5px solid var(--b); border-radius:var(--rd); font-family:inherit; background:var(--c); outline:none;"><option value="">جميع الخدمات</option><option value="FM">طبيب عام (FM)</option><option value="SRH">صحة إنجابية (SRH)</option><option value="Wound">غيار جروح</option><option value="Breast">فحص ثدي</option><option value="Mal">سوء تغذية</option></select></div>`;

if (html.includes(oldSearchUI)) {
    html = html.replace(oldSearchUI, newSearchUI);
} else {
    // try a regex in case of minor whitespace changes
    html = html.replace(/<div class="srch">.*?<\/div>/, newSearchUI);
}

// 4. Update rList logic
const oldRList = `function rList(){const q=($("sI").value||"").trim();const f=V.filter(v=>!q||v.fullName.includes(q)||v.idNumber.includes(q));`;
const newRList = `function rList(){const q=($("sI").value||"").trim();const dF=$("sDate")?$("sDate").value:"";const sF=$("sSrv")?$("sSrv").value:"";const f=V.filter(v=>{if(q&&!v.fullName.includes(q)&&!v.idNumber.includes(q)&&!(v.phone&&v.phone.includes(q)))return false;if(dF&&v.visitDate!==dF)return false;if(sF){if(sF==="FM"&&!v.fmService)return false;if(sF==="SRH"&&!v.srhService)return false;if(sF==="Wound"&&!v.woundCare)return false;if(sF==="Breast"&&!v.breastCancer)return false;if(sF==="Mal"&&!v.malnutrition)return false;}return true;});`;

if (html.includes(oldRList)) {
    html = html.replace(oldRList, newRList);
} else {
    html = html.replace(/function rList\(\)\{const q=\(\$\("sI"\)\.value\|\|""\)\.trim\(\);const f=V\.filter\(v=>!q\|\|v\.fullName\.includes\(q\)\|\|v\.idNumber\.includes\(q\)\);/, newRList);
}

fs.writeFileSync('IMS_Medical_System_4.html', html, 'utf8');
console.log("Done");
