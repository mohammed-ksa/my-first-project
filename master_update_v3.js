const fs = require('fs');
const xlsx = require('xlsx');

// 1. Read JSON Backup
const backup = JSON.parse(fs.readFileSync('IMS_Backup_2026-04-26 (1).json', 'utf8'));

// Function to normalize gender
function normGender(g) {
    if (!g) return "";
    g = String(g).trim();
    if (g === "ذكر" || g === "ط°ظƒط±" || g.toLowerCase() === "male") return "Male";
    if (g === "انثى" || g === "أنثى" || g === "ط§ظ†ط«ظ‰" || g.toLowerCase() === "female") return "Female";
    return g;
}

// Ensure JSON backup has normalized genders
Object.values(backup.patients).forEach(p => p.gender = normGender(p.gender));
backup.visits.forEach(v => v.gender = normGender(v.gender));

// 2. Read Excel File
function excelDateToJSDate(serial) {
    if (!serial) return "";
    if (typeof serial === 'string') {
        const d = new Date(serial);
        if(!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        return serial;
    }
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().split('T')[0];
}

const wb = xlsx.readFile('بيانات 2025+2026.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // ['الرقم', 'التاريخ', 'الاسم ', 'الجنس', 'العمر', 'الحالة الاجتماعية ', 'رقم الهوية ', 'رقم الجوال', 'مقيم / نازح', 'ذوي الاعاقة', 'التشخيص', 'CD/NCD', 'الخدمة قدمة ', 'الثلث', 'الادوية', 'الاحالة ']
    const vDate = excelDateToJSDate(row[1]);
    const fName = String(row[2] || "").trim();
    const gender = normGender(row[3]);
    const age = row[4];
    let socStatus = String(row[5] || "").trim();
    // Map Arabic to English for socialStatus:
    if(socStatus === "اعزب") socStatus = "Single";
    else if(socStatus === "متزوج") socStatus = "Married";
    else if(socStatus === "مطلق") socStatus = "Divorced";
    else if(socStatus === "ارمل") socStatus = "Widowed";
    
    const id = String(row[6] || "").trim();
    if (!id || id === "undefined" || id === "null") continue;
    
    const phone = String(row[7] || "").trim();
    const displacement = String(row[8] || "").trim();
    const disability = String(row[9] || "").trim(); // "لا" or "نعم"
    const disMapped = disability === "نعم" ? "Yes" : "No";
    const diagnosis = String(row[10] || "").trim();
    const cdNcd = String(row[11] || "").trim();
    const serviceProv = String(row[12] || "").trim();
    const trimester = String(row[13] || "").trim();
    const meds = String(row[14] || "").trim();
    const referral = String(row[15] || "").trim();
    
    let fmService = "";
    let srhService = "";
    if (cdNcd) fmService = `FM- ${cdNcd}`; // "FM- CD" or "FM- NCD"
    
    // approximation for Service logic
    if (!fmService && serviceProv === "عام") fmService = diagnosis || "FM- NCD"; 
    if (serviceProv === "تنظيم اسرة" || serviceProv === "رعاية حوامل" || serviceProv === "صحة إنجابية") srhService = serviceProv;
    else if (diagnosis.includes("حامل") || diagnosis.includes("ولادة")) srhService = "ANC";

    // Build Patient
    if (!backup.patients[id] || (vDate && (!backup.patients[id].lastVisitDate || new Date(vDate) > new Date(backup.patients[id].lastVisitDate)))) {
        backup.patients[id] = {
            fullName: fName,
            dob: backup.patients[id] ? backup.patients[id].dob : "", // maintain old DOB if exists
            gender: gender,
            phone: phone,
            governorate: backup.patients[id] ? backup.patients[id].governorate : "Alnussirat",
            socialStatus: socStatus,
            disability: disMapped,
            disabilityType: "",
            displacement: displacement || "نازح",
            lastVisitDate: vDate || (backup.patients[id] ? backup.patients[id].lastVisitDate : "")
        };
    }
    
    // Build Visit
    const visitId = Date.now() + i; // unique ID
    backup.visits.push({
        id: visitId,
        idNumber: id,
        fullName: fName,
        visitDate: vDate,
        lastVisitDate: "", 
        dob: backup.patients[id].dob,
        age: age,
        ageGroup: age < 5 ? "<5" : (age <= 18 ? "5-18" : (age <= 60 ? "19-60" : "60+")),
        gender: gender,
        genderN: gender === "Male" ? "male" : "female",
        phone: phone,
        governorate: backup.patients[id].governorate,
        socialStatus: socStatus,
        disability: disMapped,
        disabilityType: "",
        displacement: displacement,
        fmService: fmService,
        srhService: srhService,
        woundCare: serviceProv.includes("جروح") || diagnosis.includes("جروح"),
        breastCancer: serviceProv.includes("ثدي") || diagnosis.includes("ثدي"),
        malnutrition: serviceProv.includes("تغذية") || diagnosis.includes("تغذية"),
        consultation: diagnosis || serviceProv,
        referral: referral,
        followUpDate: "",
        medicines: meds
    });
}

// 3. Inject into HTML
let html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');

// Replace DB_NAME
html = html.replace(/const DB_NAME="IMS_DB",DB_VER=1;/, 'const DB_NAME="IMS_DB_V3",DB_VER=1;');

// Replace Phone Validation
html = html.replace(/<input id="fPh".*?>/, `<input id="fPh" type="tel" placeholder="05..." inputmode="tel" maxlength="10" oninput="let v=this.value.replace(/\\D/g,''); if(v.length>0 && !v.startsWith('05')) v='05'+v.replace(/^0+/,''); this.value=v.substring(0,10);">`);
html = html.replace(/<input id="ePh".*?>/, `<input id="ePh" type="tel" placeholder="05..." inputmode="tel" maxlength="10" oninput="let v=this.value.replace(/\\D/g,''); if(v.length>0 && !v.startsWith('05')) v='05'+v.replace(/^0+/,''); this.value=v.substring(0,10);">`);

// Update Search UI
const oldSearchUI = `<div class="srch"><input id="sI" placeholder="بحث بالاسم أو رقم الهوية..." oninput="rList()"></div>`;
const newSearchUI = `<div class="srch" style="flex-wrap:wrap; gap:8px;"><input id="sI" placeholder="بحث بالاسم، رقم الهوية، أو الهاتف..." oninput="rList()" style="flex:1; min-width: 200px;"><input id="sDate" type="date" onchange="rList()" style="padding:10px 14px; border:1.5px solid var(--b); border-radius:var(--rd); font-family:inherit; background:var(--c); outline:none;"><select id="sSrv" onchange="rList()" style="padding:10px 14px; border:1.5px solid var(--b); border-radius:var(--rd); font-family:inherit; background:var(--c); outline:none;"><option value="">جميع الخدمات</option><option value="FM">طبيب عام (FM)</option><option value="SRH">صحة إنجابية (SRH)</option><option value="Wound">غيار جروح</option><option value="Breast">فحص ثدي</option><option value="Mal">سوء تغذية</option></select></div>`;
if (html.includes(oldSearchUI)) html = html.replace(oldSearchUI, newSearchUI);

// Re-add Gender arrays and Gender Logic
html = html.replace(/const GEN = \["ذكر", "انثى"\];/, 'const GEN=[{v:"Male", l:"ذكر"},{v:"Female", l:"أنثى"}];');
html = html.replace(/v => v\.gender === "ذكر"/g, 'v => v.gender === "Male"');
html = html.replace(/v => v\.gender === "انثى"/g, 'v => v.gender === "Female"');
html = html.replace(/gender === "ذكر"/g, 'gender === "Male"');
html = html.replace(/gender === "انثى"/g, 'gender === "Female"');

// Fix bPgen function
const oldbPgen = `function bPgen() {
      const el = $("gP"); el.innerHTML = ""; GEN.forEach(g => {
        const b = document.createElement("button"); b.type = "button"; b.className = "sp" + (F.gender === g ? " on" : ""); b.textContent = g;
        b.onclick = () => {
          F.gender = F.gender === g ? "" : g; bPgen();
          const autoSoc = autoSocial(F.gender, parseInt($("fAY").value) || null); $("fSo").value = autoSoc;
        }; el.appendChild(b)
      })
    }`;
const newbPgen = `function bPgen() {
      const el = $("gP"); el.innerHTML = ""; GEN.forEach(g => {
        const b = document.createElement("button"); b.type = "button"; b.className = "sp" + (F.gender === g.v ? " on" : ""); b.textContent = g.l;
        b.onclick = () => {
          F.gender = F.gender === g.v ? "" : g.v; bPgen();
          const autoSoc = autoSocial(F.gender, parseInt($("fAY").value) || null); $("fSo").value = autoSoc;
        }; el.appendChild(b)
      })
    }`;
if(html.includes(oldbPgen)) html = html.replace(oldbPgen, newbPgen);

// Add default values to load
html = html.replace(/F\.disability = p\.disability \|\| "";/, 'F.disability = p.disability || "No";');
html = html.replace(/F\.displacement = p\.displacement \|\| "";/, 'F.displacement = p.displacement || "نازح";');
html = html.replace(/F\.disability = "No"; F\.disabilityType = ""; F\.displacement = "";/, 'F.disability = "No"; F.disabilityType = ""; F.displacement = "نازح";');

// Re-add rList filter logic
const oldRList = `function rList() {
      const q = ($("sI").value || "").trim(); const f = V.filter(v => !q || v.fullName.includes(q) || v.idNumber.includes(q));`;
const newRList = `function rList(){const q=($("sI").value||"").trim();const dF=$("sDate")?$("sDate").value:"";const sF=$("sSrv")?$("sSrv").value:"";const f=V.filter(v=>{if(q&&!v.fullName.includes(q)&&!v.idNumber.includes(q)&&!(v.phone&&v.phone.includes(q)))return false;if(dF&&v.visitDate!==dF)return false;if(sF){if(sF==="FM"&&!v.fmService)return false;if(sF==="SRH"&&!v.srhService)return false;if(sF==="Wound"&&!v.woundCare)return false;if(sF==="Breast"&&!v.breastCancer)return false;if(sF==="Mal"&&!v.malnutrition)return false;}return true;});`;
if (html.includes(oldRList)) html = html.replace(oldRList, newRList);

// Re-add Last Visit Alert
const alertLogic = `const d=dBtw(lv.visitDate,td());if(d>=0){const dayText=d===0?"اليوم":d===1?"أمس":d===2?"قبل يومين":"قبل "+d+" أيام";$("bW").innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;width:100%"><div>⚠️ تنبيه: آخر زيارة كانت '+dayText+' بتاريخ '+lv.visitDate+' ('+(lv.fmService||lv.srhService||'زيارة')+)</div></div>';sh($("bW"))}`;
// Insert this inside lookup()
html = html.replace(/const lv = pv\[0\];/, `const lv = pv[0]; if(lv&&lv.visitDate){${alertLogic}}`);

// Replace data stringifier
const pStart = html.indexOf('var INIT_PATIENTS = ');
const vStart = html.indexOf('var INIT_VISITS = ');
const afterVisits = html.indexOf('const GOV = ');
if (pStart !== -1 && afterVisits !== -1) {
    const before = html.substring(0, pStart);
    const newMiddle = `var INIT_PATIENTS = ${JSON.stringify(backup.patients)};\n    var INIT_VISITS = ${JSON.stringify(backup.visits)};\n\n    `;
    html = before + newMiddle + html.substring(afterVisits);
}

fs.writeFileSync('IMS_Medical_System_4.html', html, 'utf8');
console.log("Done");
