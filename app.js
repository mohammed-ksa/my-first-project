
    var INIT_PATIENTS = {};
    var INIT_VISITS = [];

    const GOV = ["Alnussirat", "Alburaij", "Alzawida", "Almaghazi", "Dier Albalah", "Gaza City"];
    const SOC = ["Single", "Married", "Divorced", "Widowed"];
    const GEN=["Male", "Female"]; const DISP = ["Displaced", "Host Community"];
    const DTA = ["إعاقة جسدية", "إعاقة بصرية", "إعاقة سمعية", "إعاقة ذهنية", "أخرى"];
    const DTE = ["Physical Disability", "Visual Disability", "Hearing Disability", "Mental Disability", "Other"];
    const FMS = ["FM- NCD", "FM- CD", "ENT", "Derma"]; const SRHS = ["ANC", "PNC", "FP", "GYN"];
    const WCS = ["Dressing", "Follow-up Dressing", "Wound Cleaning", "Suture Removal"];
    const BCS = ["Screening", "Screening and Referral"]; const MALS = ["Screening", "SAM referral", "MAM referral"];

    // ═══ IndexedDB Storage ═══
    const DB_NAME = "IMS_DB", DB_VER = 1;
    let db = null;
    function openDB() { return new Promise((ok, err) => { const r = indexedDB.open(DB_NAME, DB_VER); r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains("data")) d.createObjectStore("data") }; r.onsuccess = e => { db = e.target.result; ok(db) }; r.onerror = e => err(e) }) }
    function dbGet(k) { return new Promise((ok, err) => { const tx = db.transaction("data", "readonly"); const s = tx.objectStore("data"); const r = s.get(k); r.onsuccess = () => ok(r.result); r.onerror = e => err(e) }) }
    function dbPut(k, v) { return new Promise((ok, err) => { const tx = db.transaction("data", "readwrite"); const s = tx.objectStore("data"); const r = s.put(v, k); r.onsuccess = () => ok(); r.onerror = e => err(e) }) }

    let P = {}, V = [];
    let F = { gender: "انثى", disability: "No", disabilityType: "", displacement: "نازح", fmService: "", srhService: "", woundCare: "", breastCancer: "", malnutrition: "" };
    let eId = null, chD = null, chM = null, saveCount = 0;

    async function loadData() {
      await openDB();
      let p = await dbGet("patients").catch(() => null);
      let v = await dbGet("visits").catch(() => null);
      
      try {
        const res = await fetch(window.location.origin + '/api/data');
        if (res.ok) {
          const srv = await res.json();
          if (srv && srv.patients) {
             p = srv.patients; v = srv.visits;
             await dbPut("patients", p); await dbPut("visits", v);
          }
        }
      } catch (e) { console.warn("Server load fail", e) }

      P = p || INIT_PATIENTS;
      V = v || INIT_VISITS;
      // Also save to IndexedDB if first time
      if (!p) { await dbPut("patients", P); await dbPut("visits", V) }
      uB();
    }

    async function persist() {
      try { await dbPut("patients", P); await dbPut("visits", V) } catch (e) { console.warn("IndexedDB save failed:", e) }
      // Backup to localStorage too
      try { localStorage.setItem("ims-bk-p", JSON.stringify(P)); localStorage.setItem("ims-bk-v", JSON.stringify(V)) } catch (e) { }
      
      try {
        const res = await fetch(window.location.origin + '/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patients: P, visits: V })
        });
        if (res.ok) {
          const out = await res.json();
          if (out.dbData && out.dbData.patients) {
            P = out.dbData.patients;
            V = out.dbData.visits;
            await dbPut("patients", P); await dbPut("visits", V);
            localStorage.removeItem('ims-offline-dirty');
          }
        } else {
          localStorage.setItem('ims-offline-dirty', 'true');
        }
      } catch (e) { 
        console.warn("Server sync fail", e);
        localStorage.setItem('ims-offline-dirty', 'true');
      }
    }

    window.addEventListener('online', () => {
      if (localStorage.getItem('ims-offline-dirty')) {
        console.log("🌐 Network restored! Syncing offline changes...");
        persist();
      }
    });

    setInterval(() => {
      if (navigator.onLine && localStorage.getItem('ims-offline-dirty')) persist();
    }, 30000);

    function td() { return new Date().toISOString().split("T")[0] }
    function formatPhone(el) { let v = el.value.replace(/\D/g, ''); if (v.length > 0) { if (v[0] !== '0') v = '05' + v; else if (v.length > 1 && v[1] !== '5') v = '05' + v.substring(1); } el.value = v.substring(0, 10); }
    function updateIDProg(el) { let v = el.value.replace(/\D/g, ""); el.value = v; let len = v.length; let pct = Math.min(100, (len / 9) * 100); $("idProgBar").style.width = pct + "%"; $("idProgBar").style.background = len === 9 ? "var(--g)" : (len > 9 ? "var(--r)" : "var(--p)"); }
    function cA(dob) { if (!dob) return null; const b = new Date(dob), n = new Date(); let y = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) y--; return y }
    function aG(a) { if (a == null) return ""; if (a <= 5) return "0-5"; if (a <= 18) return "6-18"; if (a <= 60) return "19-60"; return "+60" }
    function fmD(v) { if (!v) return ""; if (v instanceof Date) return v.toISOString().split("T")[0]; if (typeof v === "number") return new Date((v - 25569) * 864e5).toISOString().split("T")[0]; let s = String(v).trim(); return s.length >= 10 && s.includes("-") ? s.substring(0, 10) : "" }
    function dBtw(a, b) { return Math.floor((new Date(b) - new Date(a)) / 864e5) }
    function fl(m, t) { const e = $("toast"); e.textContent = m; e.className = "toast " + t; e.classList.remove("hidden"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.add("hidden"), 2500) }
    function $(id) { return document.getElementById(id) }
    function sh(e) { e.classList.remove("hidden") }
    function hi(e) { e.classList.add("hidden") }
    function uB() { $("cB").textContent = V.length; $("dNum").textContent = V.filter(v => v.visitDate === td()).length + 1; $("dDate").textContent = td() }
    function fSel(id, items, empty) { $(id).innerHTML = (empty ? '<option value="">' + empty + '</option>' : "") + items.map(i => '<option value="' + i + '">' + i + '</option>').join("") }
    function bP(c, items, fk, labels) { const el = $(c); el.innerHTML = ""; items.forEach((item, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "sp" + (F[fk] === item ? " on" : ""); b.textContent = labels ? labels[i] : item; b.onclick = () => { F[fk] = F[fk] === item ? "" : item; bP(c, items, fk, labels); if (fk === "disability") { F.disabilityType = ""; F.disability === "Yes" ? sh($("fDT")) : hi($("fDT")) } }; el.appendChild(b) }) }

    function autoSocial(gender, age) {
      if (age == null || age === "") return "";
      if (age < 16) return "Single"; if (age <= 25) return "Single"; if (age <= 60) return "Married"; if (age > 70) return "Widowed"; return "Married";
    }

    function bPgen() {
      const el = $("gP"); el.innerHTML = ""; GEN.forEach((g, idx) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "sp" + (F.gender === g ? " on" : ""); b.textContent = ["ذكر", "أنثى"][idx];
        b.onclick = () => {
          F.gender = F.gender === g ? "" : g; bPgen();
          const age = parseInt($("fAY").value) || 0;
          if (age > 0) { const curSoc = $("fSo").value; if (!curSoc || curSoc === "") { const as = autoSocial(F.gender, age); if (as) $("fSo").value = as } }
        };
        el.appendChild(b)
      })
    }

    function bPsrh() {
      const el = $("srP"); el.innerHTML = ""; SRHS.forEach(s => {
        const b = document.createElement("button"); b.type = "button"; b.className = "sp" + (F.srhService === s ? " on" : ""); b.textContent = s; b.onclick = () => {
          F.srhService = F.srhService === s ? "" : s; bPsrh();
          if (F.srhService === "ANC" && !F.malnutrition) { F.malnutrition = "Screening"; bP("mlP", MALS, "malnutrition") }
        }; el.appendChild(b)
      })
    }

    function rP() { bPgen(); bP("dP", ["No", "Yes"], "disability", ["لا", "نعم"]); bP("dpP", DISP, "displacement", ["نازح", "مقيم / مجتمع مضيف"]); bP("fmP", FMS, "fmService"); bPsrh(); bP("wcP", WCS, "woundCare"); bP("bcP", BCS, "breastCancer"); bP("mlP", MALS, "malnutrition") }

    function init() {
      fSel("fG", GOV, "— اختر —"); fSel("fSo", SOC, "— اختر —"); fSel("fDT", DTA, "— نوع الإعاقة —"); $("fVD").value = td(); rP(); hi($("fDT"));
      fSel("eGo", GOV, "— اختر —"); fSel("eSo", SOC, "— اختر —"); fSel("eDT", DTA, "— النوع —"); fSel("eFM", FMS, "— بدون —"); fSel("eSR", SRHS, "— بدون —"); fSel("eWC", WCS, "— بدون —"); fSel("eBC", BCS, "— بدون —"); fSel("eML", MALS, "— بدون —");
      loadData().then(() => { uB(); $("idI").focus() });
      // Check backup reminder
      checkBackup()
    }

    function calcAgeFromDOB() {
      const dob = $("fDOB").value;
      if (dob) {
        const b = new Date(dob), n = new Date(); let y = n.getFullYear() - b.getFullYear(); let m = n.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && n.getDate() < b.getDate())) { y--; m += 12; }
        if (n.getDate() < b.getDate()) { m--; } if (m < 0) m += 12;
        $("fAY").value = y; $("fAM").value = m; uDOBUI(y);
      } else { $("fAY").value = ""; $("fAM").value = ""; hi($("dD")); }
    }
    function calcDOBFromAge() {
      const y = parseInt($("fAY").value) || 0; const m = parseInt($("fAM").value) || 0;
      if (y || m) {
        const n = new Date(); n.setFullYear(n.getFullYear() - y); n.setMonth(n.getMonth() - m);
        $("fDOB").value = n.toISOString().split("T")[0]; uDOBUI(y);
      } else { $("fDOB").value = ""; hi($("dD")); }
    }
    function uDOBUI(age) {
      sh($("dD")); $("aT").textContent = "الفئة: " + aG(age);
      const curSoc = $("fSo").value;
      if (!curSoc || curSoc === "— اختر —" || curSoc === "") { const as = autoSocial(F.gender, age); if (as) $("fSo").value = as }
    }

    // ═══ Backup Reminder ═══
    function checkBackup() {
      const last = localStorage.getItem("ims-last-export") || ""; const lastDate = last ? new Date(last) : null; const now = new Date();
      // Show if never exported or last export was yesterday+
      if (!lastDate || now.toDateString() !== lastDate.toDateString()) { const sc = parseInt(localStorage.getItem("ims-save-count") || "0"); if (sc >= 50) sh($("bkBar")) }
    }
    function hideBk() { hi($("bkBar")); localStorage.setItem("ims-save-count", "0") }

    // ═══ LOOKUP ═══
    function lookup() {
      const id = $("idI").value.trim(); if (!id) return; $("idI").disabled = true; hi($("idSB")); sh($("idCB")); hi($("bW"));
      const pv = V.filter(v => v.idNumber === id).sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)); const lv = pv[0]; if(lv&&lv.visitDate){const d=dBtw(lv.visitDate,td());if(d>=0){const dayText=d===0?"اليوم":d===1?"أمس":d===2?"قبل يومين":"قبل "+d+" أيام";$("bW").innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;width:100%"><div>⚠️ تنبيه: آخر زيارة كانت '+dayText+' بتاريخ '+lv.visitDate+' ('+(lv.fmService||lv.srhService||'زيارة')+')</div></div>';sh($("bW"))}}
      if (P[id]) {
        const p = P[id]; const age = cA(p.dob);
        $("fN").value = p.fullName || "";
        if (p.dob && p.dob.length >= 10) {
          $("fDOB").value = p.dob; calcAgeFromDOB();
        } else if (age != null) {
          $("fAY").value = age; $("fAM").value = ""; calcDOBFromAge();
        } else { $("fDOB").value = ""; $("fAY").value = ""; $("fAM").value = ""; hi($("dD")); }
        let g = p.gender || ""; if(g==="ذكر") g="Male"; else if(g==="انثى"||g==="أنثى") g="Female"; F.gender = g;
        F.disability = p.disability || "No"; F.disabilityType = p.disabilityType || ""; 
        let dp = p.displacement || "Displaced"; if(dp==="نازح") dp="Displaced"; else if(dp==="مقيم") dp="Host Community"; F.displacement = dp;
        F.fmService = ""; F.srhService = ""; F.woundCare = ""; F.breastCancer = ""; F.malnutrition = "";
        $("fPh").value = p.phone || ""; $("fG").value = p.governorate || "Alnussirat";
        const autoSoc = p.socialStatus || autoSocial(F.gender, age); $("fSo").value = autoSoc;
        F.disability === "Yes" ? sh($("fDT")) : hi($("fDT")); rP();
        let h = '✓ مريض مسجل — <strong>' + p.fullName + '</strong><button class="bn-x" onclick="hi(this.parentElement)">✕</button>';
        if (lv && lv.visitDate) h += '<span class="bn-last">📅 آخر زيارة: ' + lv.visitDate + (lv.fmService ? ' | ' + lv.fmService : '') + (lv.srhService ? ' | ' + lv.srhService : '') + ' — الزيارات: ' + pv.length + '</span>';
        $("bF").innerHTML = h; sh($("bF")); hi($("bN"));
        if (lv && lv.visitDate) {
          const d = dBtw(lv.visitDate, td()); if (d >= 0 && d < 10) {
            const dayText = d === 0 ? "اليوم" : d === 1 ? "أمس" : "قبل " + d + " أيام";
            $("bW").innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;width:100%"><div>⚠️ تنبيه: آخر زيارة كانت <strong>' + dayText + '</strong> بتاريخ ' + lv.visitDate + (lv.fmService ? " (" + lv.fmService + ")" : "") + (lv.srhService ? " (" + lv.srhService + ")" : "") + (d === 0 ? "<br><strong style=\'color:#dc2626\'>المريض زار اليوم بالفعل!</strong>" : "") + '</div><button class="bn-x" onclick="hi(this.parentElement)">✕</button></div>';
            sh($("bW"))
          }
        }
        fl("✓ تم العثور", "ok")
      }
      else {
        F = { gender: "Female", disability: "No", disabilityType: "", displacement: "Displaced", fmService: "", srhService: "", woundCare: "", breastCancer: "", malnutrition: "" }; rP(); sh($("bN")); hi($("bF")); $("fG").value = "Alnussirat";
        fl("مريض جديد", "new"); setTimeout(() => $("fN").focus(), 100)
      }
      sh($("fS"))
    }

    function reset() {
      $("idI").value = ""; $("idI").disabled = false; sh($("idSB")); hi($("idCB")); hi($("bF")); hi($("bN")); hi($("bW")); hi($("fS"));
      updateIDProg($("idI"));
      $("fN").value = ""; $("fDOB").value = ""; $("fAY").value = ""; $("fAM").value = ""; $("fPh").value = ""; $("fG").value = "Alnussirat"; $("fSo").value = ""; $("fFU").value = ""; $("fVD").value = td(); $("fRef").value = "";
      hi($("dD")); hi($("fDT")); F = { gender: "Female", disability: "No", disabilityType: "", displacement: "Displaced", fmService: "", srhService: "", woundCare: "", breastCancer: "", malnutrition: "" };
      rP(); uB(); setTimeout(() => $("idI").focus(), 50)
    }

    // ═══ SAVE ═══
    function doSave() {
      const id = $("idI").value.trim(), nm = $("fN").value.trim(); if (!id || !nm || !F.gender) { fl("أكمل: الهوية + الاسم + الجنس", "err"); return }
      let dob = $("fDOB").value;
      if (!dob && P[id]) dob = P[id].dob || "";
      const age = cA(dob), ag = aG(age), vd = $("fVD").value || td();
      let dt = F.disability === "Yes" ? $("fDT").value : ""; const ai = DTA.indexOf(dt); if (ai >= 0) dt = DTE[ai];
      P[id] = { fullName: nm, dob, gender: F.gender, phone: $("fPh").value, governorate: $("fG").value, socialStatus: $("fSo").value, disability: F.disability, disabilityType: dt, displacement: F.displacement, lastVisitDate: vd };
      V.push({ id: Date.now(), idNumber: id, fullName: nm, visitDate: vd, lastVisitDate: "", dob, age, ageGroup: ag, gender: F.gender, genderN: F.gender === "Male" ? "male" : "female", phone: $("fPh").value, governorate: $("fG").value, socialStatus: $("fSo").value, disability: F.disability, disabilityType: dt, displacement: F.displacement, fmService: F.fmService, srhService: F.srhService, woundCare: F.woundCare, breastCancer: F.breastCancer, malnutrition: F.malnutrition, referral: $("fRef").value, followUpDate: $("fFU").value });
      persist();
      try {
          let names = nm.split(' ');
          let first = names[0] || '';
          let second = names[1] || '';
          let third = names[2] || '';
          let family = names.length > 3 ? names.slice(3).join(' ') : (names[3] || '');
          
          fetch(window.location.origin + "/api/addCitizen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: id, first: first, second: second, third: third, family: family, dob: dob, gender: F.gender, governorate: $("fG").value })
          }).catch(e => console.error(e));
      } catch(e) {}
      // Backup counter
      saveCount++; const sc = parseInt(localStorage.getItem("ims-save-count") || "0") + 1; localStorage.setItem("ims-save-count", String(sc));
      if (sc % 50 === 0) { sh($("bkBar")); fl("⚠️ يُنصح بتصدير نسخة احتياطية (" + sc + " حالة جديدة)", "new") }
      const num = V.filter(v => v.visitDate === vd).length;
      fl("✅ تم حفظ المريض رقم " + num + " لليوم", "ok"); reset()
    }

    // ═══ TABS ═══
    function sw(n) { document.querySelectorAll(".tab").forEach((t, i) => t.classList.toggle("on", ["entry", "stats", "list"][i] === n));["entry", "stats", "list"].forEach(x => { x === n ? sh($("tab-" + x)) : hi($("tab-" + x)) }); if (n === "stats") rStats(); if (n === "list") rList() }

    // ═══ STATS ═══
    function rStats() {
      const t = td();
      const dfFrom = $("stFrom") ? $("stFrom").value : "";
      const dfTo   = $("stTo")   ? $("stTo").value   : "";
      let tv;
      if (dfFrom || dfTo) {
        tv = V.filter(v => {
          if (!v.visitDate) return false;
          if (dfFrom && v.visitDate < dfFrom) return false;
          if (dfTo   && v.visitDate > dfTo)   return false;
          return true;
        });
      } else {
        tv = V.filter(v => v.visitDate === t);
      }
      const rangeLabel = (dfFrom || dfTo) 
        ? `📅 ${dfFrom || "..."} ← ${dfTo || "..."} (${tv.length} زيارة)`
        : `📊 اليوم ${t} (${tv.length})`;

      const fN = tv.filter(v => v.fmService === "FM- NCD").length;
      const fC = tv.filter(v => v.fmService === "FM- CD").length;
      const fE = tv.filter(v => v.fmService === "ENT").length;
      const fDm= tv.filter(v => v.fmService === "Derma").length;
      const fT = fN + fC + fE + fDm;
      const sA = tv.filter(v => v.srhService === "ANC").length;
      const sP = tv.filter(v => v.srhService === "PNC").length;
      const sG = tv.filter(v => v.srhService === "GYN").length;
      const sF = tv.filter(v => v.srhService === "FP").length;
      const sM = sA + sP + sG;
      const vDisp  = tv.filter(v => v.displacement === "Displaced").length;
      const vHost  = tv.filter(v => v.displacement === "Host Community").length;
      const vDisab = tv.filter(v => v.disability === "Yes").length;

      // Helper: render a value nicely — show emoji if zero
      function dv(n, emoji) { return n > 0 ? `<div class="dv">${n}</div>` : `<div class="dv" style="font-size:28px;opacity:.45">${emoji || "—"}</div>`; }

      $("sC").innerHTML = `
<div class="ds-title">${rangeLabel}</div><div class="ds">
  <div class="dsc blue">${dv(tv.length,'📭')}<div class="dl">الإجمالي</div></div>
  <div class="dsc green">${dv(tv.filter(v=>v.gender==="Male").length,'👤')}<div class="dl">ذكور</div></div>
  <div class="dsc orange">${dv(tv.filter(v=>v.gender==="Female").length,'👤')}<div class="dl">إناث</div></div>
</div>
<div class="ds-title">🏠 النزوح والإعاقة</div><div class="ds">
  <div class="dsc blue">${dv(vDisp,'🏕️')}<div class="dl">نازحين</div></div>
  <div class="dsc blue">${dv(vHost,'🏡')}<div class="dl">مقيمين</div></div>
  <div class="dsc orange">${dv(vDisab,'♿')}<div class="dl">ذوي إعاقة</div></div>
</div>
<div class="ds-title">🩺 FM (${fT})</div><div class="ds">
  <div class="dsc blue">${dv(fT,'🩺')}<div class="dl">الكلي</div></div>
  <div class="dsc blue">${dv(fN,'💊')}<div class="dl">NCD</div></div>
  <div class="dsc blue">${dv(fC,'🦠')}<div class="dl">CD</div></div>
</div><div class="ds" style="margin-top:3px">
  <div class="dsc blue">${dv(fE,'👂')}<div class="dl">ENT</div></div>
  <div class="dsc blue">${dv(fDm,'🌿')}<div class="dl">Derma</div></div>
  <div class="dsc"></div>
</div>
<div class="ds-title">🤰 ANC+PNC+GYN (${sM})</div><div class="ds">
  <div class="dsc green">${dv(sM,'🤰')}<div class="dl">مجموع</div></div>
  <div class="dsc green">${dv(sA,'🩻')}<div class="dl">ANC</div></div>
  <div class="dsc green">${dv(sP,'🍼')}<div class="dl">PNC</div></div>
</div><div class="ds" style="margin-top:3px">
  <div class="dsc green">${dv(sG,'🏥')}<div class="dl">GYN</div></div>
  <div class="dsc"></div><div class="dsc"></div>
</div>
<div class="ds-title">💊 FP</div><div class="ds">
  <div class="dsc orange">${dv(sF,'💊')}<div class="dl">${(dfFrom||dfTo)?'الفترة':'اليوم'}</div></div>
  <div class="dsc orange">${dv(V.filter(v=>v.srhService==="FP").length,'📦')}<div class="dl">الكلي</div></div>
  <div class="dsc"></div>
</div>
<div class="ds-title">🩹 أخرى</div><div class="ds">
  <div class="dsc red">${dv(tv.filter(v=>v.woundCare).length,'🩹')}<div class="dl">جروح</div></div>
  <div class="dsc red">${dv(tv.filter(v=>v.breastCancer).length,'🎀')}<div class="dl">ثدي</div></div>
  <div class="dsc red">${dv(tv.filter(v=>v.malnutrition).length,'🍎')}<div class="dl">سوء تغذية</div></div>
</div>
<div class="ds-title">🍎 تفاصيل سوء التغذية</div><div class="ds">
  <div class="dsc orange">${dv(tv.filter(v=>v.malnutrition&&v.srhService==="ANC").length,'🤰')}<div class="dl">حوامل ANC</div></div>
  <div class="dsc orange">${dv(tv.filter(v=>v.malnutrition&&v.age!=null&&v.age<6&&v.fmService).length,'👶')}<div class="dl">أطفال &lt;6 + طبيب</div></div>
  <div class="dsc orange">${dv(tv.filter(v=>v.malnutrition&&v.age!=null&&v.age<6&&!v.fmService).length,'🔍')}<div class="dl">أطفال &lt;6 فحص</div></div>
</div>
<div class="ds-title">📈 إجماليات الكلية</div><div class="ds">
  <div class="dsc blue">${dv(V.length,'📋')}<div class="dl">زيارات</div></div>
  <div class="dsc green">${dv(Object.keys(P).length,'👥')}<div class="dl">مرضى</div></div>
  <div class="dsc orange">${dv(new Set(V.map(v=>v.visitDate)).size,'📅')}<div class="dl">أيام</div></div>
</div>`;
      bCharts(dfFrom, dfTo);
    }

    function bCharts(dfFrom, dfTo) {
      // Daily chart: if range selected, expand to all dates in range; else last 14 days
      let dates = [];
      if (dfFrom || dfTo) {
        const start = dfFrom ? new Date(dfFrom) : new Date(dfTo);
        const end   = dfTo   ? new Date(dfTo)   : new Date(dfFrom);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split("T")[0]);
        }
        if (dates.length > 60) dates = dates.slice(-60); // cap at 60 days
      } else {
        const now = new Date(); for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); dates.push(d.toISOString().split("T")[0]); }
      }
      const fm = dates.map(d => V.filter(v => v.visitDate === d && v.fmService).length);
      const sr = dates.map(d => V.filter(v => v.visitDate === d && ["ANC", "PNC", "GYN"].includes(v.srhService)).length);
      const fp = dates.map(d => V.filter(v => v.visitDate === d && v.srhService === "FP").length);
      const lb = dates.map(d => d.substring(5));
      if (chD) chD.destroy();
      chD = new Chart($("chD"), { type: "bar", data: { labels: lb, datasets: [{ label: "FM عام", data: fm, backgroundColor: "rgba(0,89,179,.7)", borderRadius: 3 }, { label: "نساء ANC+PNC+GYN", data: sr, backgroundColor: "rgba(0,135,90,.7)", borderRadius: 3 }, { label: "قابلة FP", data: fp, backgroundColor: "rgba(230,119,0,.7)", borderRadius: 3 }] }, options: { responsive: true, plugins: { legend: { position: "bottom", labels: { font: { family: "Tajawal", size: 11 } } } }, scales: { x: { ticks: { font: { family: "Tajawal", size: 9 } } }, y: { beginAtZero: true } } } });
      const mo = {}; V.forEach(v => { if (!v.visitDate) return; if (dfFrom && v.visitDate < dfFrom) return; if (dfTo && v.visitDate > dfTo) return; const m = v.visitDate.substring(0, 7); if (!mo[m]) mo[m] = { fm: 0, sr: 0, fp: 0 }; if (v.fmService) mo[m].fm++; if (["ANC", "PNC", "GYN"].includes(v.srhService)) mo[m].sr++; if (v.srhService === "FP") mo[m].fp++ });
      const mk = Object.keys(mo).sort().slice(-12);
      if (chM) chM.destroy();
      chM = new Chart($("chM"), { type: "line", data: { labels: mk, datasets: [{ label: "FM عام", data: mk.map(k => mo[k].fm), borderColor: "#0059b3", backgroundColor: "rgba(0,89,179,.08)", fill: true, tension: .3, pointRadius: 3 }, { label: "نساء", data: mk.map(k => mo[k].sr), borderColor: "#00875a", backgroundColor: "rgba(0,135,90,.08)", fill: true, tension: .3, pointRadius: 3 }, { label: "FP", data: mk.map(k => mo[k].fp), borderColor: "#e67700", backgroundColor: "rgba(230,119,0,.08)", fill: true, tension: .3, pointRadius: 3 }] }, options: { responsive: true, plugins: { legend: { position: "bottom", labels: { font: { family: "Tajawal", size: 11 } } } }, scales: { x: { ticks: { font: { family: "Tajawal", size: 9 } } }, y: { beginAtZero: true } } } })
    }

    // ═══ LIST ═══
    function rList(){const q=($("sI").value||"").trim();const dF=$("sDate")?$("sDate").value:"";const sF=$("sSrv")?$("sSrv").value:"";const f=V.filter(v=>{if(q&&!v.fullName.includes(q)&&!v.idNumber.includes(q)&&!(v.phone&&v.phone.includes(q)))return false;if(dF&&v.visitDate!==dF)return false;if(sF){if(sF==="FM"&&!v.fmService)return false;if(sF==="SRH"&&!v.srhService)return false;if(sF==="Wound"&&!v.woundCare)return false;if(sF==="Breast"&&!v.breastCancer)return false;if(sF==="Mal"&&!v.malnutrition)return false;}return true;}); const l = [...f].sort((a,b) => { const d1 = new Date(a.visitDate||"1970-01-01").getTime(); const d2 = new Date(b.visitDate||"1970-01-01").getTime(); return d2===d1 ? b.id-a.id : d2-d1; });
      if (!l.length) { $("lC").innerHTML = '<div style="text-align:center;padding:40px;color:var(--s)"><div style="font-size:40px;opacity:.3;margin-bottom:10px">📂</div>' + (q ? "لا توجد نتائج" : "لا توجد سجلات") + '</div>'; return }
      const numStart = f.length;
      // Compute daily number for each visit
      const dailyMap = {}; V.forEach(v => { const d = v.visitDate || ""; if (!dailyMap[d]) dailyMap[d] = []; dailyMap[d].push(v.id) });
      function getDayNum(v) { const arr = dailyMap[v.visitDate || ""] || []; return arr.indexOf(v.id) + 1 }
      $("lC").innerHTML = '<div style="text-align:center;padding:4px;color:var(--s);font-size:11px">إجمالي السجلات المعروضة: ' + f.length + '</div>' + l.map(v => { const dn = getDayNum(v); return '<div class="rc" style="display:flex;gap:12px;align-items:flex-start"><div style="min-width:50px;text-align:center;padding-top:4px"><div style="font-size:28px;font-weight:900;color:var(--p);line-height:1">' + dn + '</div><div style="font-size:9px;color:var(--s);margin-top:2px">' + ((v.visitDate || "").substring(5) || "") + '</div></div><div style="flex:1"><div class="rt"><div><div class="rn"><span style="background:var(--p);color:#fff;padding:1px 8px;border-radius:6px;font-size:11px;margin-left:6px">#' + (numStart - l.indexOf(v)) + '</span> ' + v.fullName + '</div><div class="ri">' + v.idNumber + ' | ' + v.gender + ' | ' + (v.age != null ? v.age + ' (' + v.ageGroup + ')' : '') + '</div></div><span class="rd">' + (v.visitDate || '—') + '</span></div><div class="rts">' + (v.fmService ? '<span class="tg tb">' + v.fmService + '</span>' : '') + (v.srhService ? '<span class="tg tgg">' + v.srhService + '</span>' : '') + (v.woundCare ? '<span class="tg to">' + v.woundCare + '</span>' : '') + (v.breastCancer ? '<span class="tg tr">' + v.breastCancer + '</span>' : '') + (v.malnutrition ? '<span class="tg to">' + v.malnutrition + '</span>' : '') + (v.referral ? '<span class="tg tb">' + v.referral + '</span>' : '') + '</div><div class="rm"><span>📍 ' + (v.governorate || '') + '</span><span>🏠 ' + (v.displacement || '') + '</span>' + (v.phone ? '<span>📞 ' + v.phone + '</span>' : '') + '</div><div class="rc-act"><button class="rbtn rbtn-e" onclick="opE(' + v.id + ')">✏️ تعديل</button><button class="rbtn" style="background:var(--gl);color:var(--g)" onclick="addVisitFrom(\'' + v.idNumber + '\')">➕ زيارة</button><button class="rbtn rbtn-d" onclick="dlV(' + v.id + ')">🗑️</button></div></div></div>' }).join("")
    }

    function dlV(id) { if (!confirm("حذف هذا السجل؟")) return; V = V.filter(v => v.id !== id); persist(); uB(); rList(); fl("تم الحذف", "err") }
    function clrAll() { if (!confirm("حذف جميع السجلات نهائياً؟")) return; V = []; P = {}; persist(); uB(); rList(); fl("تم المسح", "err") }

    // ═══ EDIT ═══
    function opE(vid) {
      const v = V.find(x => x.id === vid); if (!v) return; eId = vid;
      const p = P[v.idNumber] || {};
      $("eN").value = v.fullName || p.fullName || ""; $("eVD").value = v.visitDate || ""; 
      let g = v.gender || p.gender || ""; if(g==="ذكر") g="Male"; else if(g==="انثى"||g==="أنثى") g="Female"; $("eG").value = g;
      const dob = v.dob || p.dob || "";
      $("eDOB").value = dob;
      const age = v.age != null ? v.age : cA(dob);
      $("eA").value = age != null ? age : "";
      $("eAG").value = aG(age);
      $("ePh").value = v.phone || p.phone || ""; $("eGo").value = v.governorate || p.governorate || ""; $("eSo").value = v.socialStatus || p.socialStatus || ""; 
      let dp = v.displacement || p.displacement || "Displaced"; if(dp==="نازح") dp="Displaced"; else if(dp==="مقيم") dp="Host Community"; $("eDp").value = dp;
      $("eDs").value = v.disability || p.disability || "No";
      let dt = v.disabilityType || p.disabilityType || ""; const ei = DTE.indexOf(dt); if (ei >= 0) dt = DTA[ei]; $("eDT").value = dt;
      $("eFM").value = v.fmService || ""; $("eSR").value = v.srhService || ""; $("eWC").value = v.woundCare || ""; $("eBC").value = v.breastCancer || ""; $("eML").value = v.malnutrition || ""; $("eRf").value = v.referral || ""; $("eFU").value = v.followUpDate || ""; sh($("eM"))
    }
    window.calcAgeFromEdit = function() {
      const dob = $("eDOB").value;
      if (dob) { const age = cA(dob); $("eA").value = age != null ? age : ""; $("eAG").value = aG(age); } 
      else { $("eA").value = ""; $("eAG").value = ""; }
    };
    window.calcDOBFromEdit = function() {
      const y = parseInt($("eA").value);
      if (!isNaN(y) && y >= 0) { const n = new Date(); n.setFullYear(n.getFullYear() - y); $("eDOB").value = n.toISOString().split("T")[0]; $("eAG").value = aG(y); } 
      else { $("eDOB").value = ""; $("eAG").value = ""; }
    };
    function clsE() { hi($("eM")); eId = null }
    function svE() {
      if (!eId) return; const i = V.findIndex(v => v.id === eId); if (i === -1) return; const v = V[i]; 
      const age = parseInt($("eA").value); const dob = $("eDOB").value;
      let dt = $("eDT").value; const ai = DTA.indexOf(dt); if (ai >= 0) dt = DTE[ai];
      V[i] = { ...v, fullName: $("eN").value.trim() || v.fullName, visitDate: $("eVD").value || v.visitDate, gender: $("eG").value, genderN: $("eG").value === "Male" ? "male" : "female", age: isNaN(age) ? null : age, ageGroup: $("eAG").value || aG(age), dob, phone: $("ePh").value, governorate: $("eGo").value, socialStatus: $("eSo").value, displacement: $("eDp").value, disability: $("eDs").value, disabilityType: dt, fmService: $("eFM").value, srhService: $("eSR").value, woundCare: $("eWC").value, breastCancer: $("eBC").value, malnutrition: $("eML").value, referral: $("eRf").value, followUpDate: $("eFU").value };
      const id = V[i].idNumber; if (P[id]) Object.assign(P[id], { fullName: V[i].fullName, gender: V[i].gender, phone: V[i].phone, governorate: V[i].governorate, socialStatus: V[i].socialStatus, displacement: V[i].displacement, disability: V[i].disability, disabilityType: V[i].disabilityType, dob });
      persist();
      try {
          let names = V[i].fullName.split(' ');
          let first = names[0] || '';
          let second = names[1] || '';
          let third = names[2] || '';
          let family = names.length > 3 ? names.slice(3).join(' ') : (names[3] || '');
          fetch("http://localhost:3000/api/editCitizen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: id, first: first, second: second, third: third, family: family, dob: dob, gender: V[i].gender, governorate: V[i].governorate })
          }).catch(e => console.error(e));
      } catch(e) {} rList(); clsE(); fl("✅ تم التحديث", "ok")
    }

    // ═══ IMPORT (DEDUP) — supports XLSX and JSON ═══
    function impFile(e) {
      const file = e.target.files[0]; if (!file) return;
      const impDateFrom = $("impFrom").value, impDateTo = $("impTo").value;
      const impRF = parseInt($("impRowFrom").value) || 0, impRT = parseInt($("impRowTo").value) || 0;

      if (file.name.endsWith(".json")) {
        const r = new FileReader(); r.onload = ev => {
          try {
            const d = JSON.parse(ev.target.result); if (d.patients && d.visits) {
              let added = 0; const ek = new Set(V.map(v => v.idNumber + "|" + v.visitDate)); d.visits.forEach(v => {
                const k = v.idNumber + "|" + v.visitDate;
                if (impDateFrom && v.visitDate && v.visitDate < impDateFrom) return;
                if (impDateTo && v.visitDate && v.visitDate > impDateTo) return;
                if (!ek.has(k)) { ek.add(k); V.push({ ...v, id: Date.now() + added }); added++; if (!P[v.idNumber]) P[v.idNumber] = { fullName: v.fullName, dob: v.dob, gender: v.gender, phone: v.phone, governorate: v.governorate, socialStatus: v.socialStatus, disability: v.disability, disabilityType: v.disabilityType, displacement: v.displacement, lastVisitDate: v.visitDate } }
              }); persist(); uB(); rList(); fl("✅ استعادة " + added + " سجل", "ok")
            } else fl("ملف غير صالح", "err")
          } catch { fl("خطأ", "err") }
        }; r.readAsText(file); e.target.value = ""; return
      }
      const reader = new FileReader(); reader.onload = function (evt) {
        try {
          const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true }); const ws = wb.Sheets["IMS"] || wb.Sheets[wb.SheetNames[0]]; const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          let hI = -1; for (let i = 0; i < Math.min(15, raw.length); i++) { if (raw[i] && raw[i].some(c => String(c).includes("Full Name") || String(c).includes("الإسم الكامل"))) { hI = i; break } }
          if (hI === -1) { fl("لا يوجد عناوين", "err"); return }
          const ek = new Set(V.map(v => v.idNumber + "|" + v.visitDate)); let imp = 0, dup = 0, skip = 0;
          const startRow = impRF > 0 ? (hI + impRF) : (hI + 1);
          const endRow = impRT > 0 ? Math.min(hI + impRT + 1, raw.length) : raw.length;
          for (let i = startRow; i < endRow; i++) {
            const r = raw[i]; const nm = String(r[1] || "").trim(); let idN = ""; try { idN = String(parseInt(parseFloat(r[4]))) } catch { }; if (!nm || !idN || idN === "NaN") continue;
            const vD = fmD(r[2]);
            if (impDateFrom && vD && vD < impDateFrom) { skip++; continue }
            if (impDateTo && vD && vD > impDateTo) { skip++; continue }
            if (ek.has(idN + "|" + vD)) { dup++; continue } ek.add(idN + "|" + vD);
            const dob = fmD(r[5]); let age = null; try { age = parseInt(parseFloat(r[6])) } catch { };
            const g = String(r[8] || "").trim().replace(/\s/g, ""); const gen = (g === "أنثى" || g === "انثى" || g === "Female") ? "Female" : ((g === "ذكر" || g === "Male") ? "Male" : g);
            let ph = ""; try { ph = String(parseInt(parseFloat(r[10]))) } catch { }; if (ph === "NaN") ph = "";
            const gov = String(r[11] || "").trim(), soc = String(r[12] || "").trim();
            let dis = String(r[13] || "").trim(); dis = dis === "لا" || dis === "No" || dis === "no" ? "No" : dis === "نعم" || dis === "Yes" || dis === "yes" ? "Yes" : dis;
            const disT = String(r[14] || "").trim(); let disp = String(r[15] || "").trim(); disp = disp === "Displaced" || disp === "نازح" ? "Displaced" : disp === "Host Community" || disp === "مقيم" ? "Host Community" : (disp || "Displaced");
            const fm = String(r[16] || "").trim(), srh = String(r[17] || "").trim(), wc = String(r[18] || "").trim(), bc = String(r[19] || "").trim(), mal = String(r[20] || "").trim(), ref = String(r[21] || "").trim(), fu = fmD(r[22]);
            if (!P[idN]) P[idN] = { fullName: nm, dob, gender: gen, phone: ph, governorate: gov, socialStatus: soc, disability: dis, disabilityType: disT, displacement: disp, lastVisitDate: vD };
            V.push({ id: Date.now() + i, idNumber: idN, fullName: nm, visitDate: vD || td(), lastVisitDate: "", dob, age, ageGroup: aG(age), gender: gen, genderN: gen === "Male" ? "male" : "female", phone: ph, governorate: gov, socialStatus: soc, disability: dis, disabilityType: disT, displacement: disp, fmService: fm, srhService: srh, woundCare: wc, breastCancer: bc, malnutrition: mal, referral: ref, followUpDate: fu }); imp++
          }
          persist(); uB(); rList(); fl("✅ " + imp + " جديد" + (dup ? " | " + dup + " مكرر" : "") + (skip ? " | " + skip + " خارج الفترة" : ""), "ok");
        } catch (err) { console.error(err); fl("خطأ", "err") }
      }; reader.readAsArrayBuffer(file); e.target.value = ""
    }

    // ═══ EXPORT XLSX ═══
    let expType = "all";
    function showExpModal() {
      expType = "all";
      $("expFrom").value = ""; $("expTo").value = td();
      buildExpPills(); updateExpInfo(); sh($("expM"))
    }
    function buildExpPills() {
      const c = $("expTypePills"); c.innerHTML = "";
      [["all", "الكل"], ["today", "اليوم"], ["range", "فترة محددة"]].forEach(([k, l]) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "sp" + (expType === k ? " on" : ""); b.textContent = l;
        b.onclick = () => {
          expType = k; buildExpPills(); updateExpInfo();
          expType === "range" ? sh($("expDateFields")) : hi($("expDateFields"))
        }; c.appendChild(b)
      });
      expType === "range" ? sh($("expDateFields")) : hi($("expDateFields"))
    }
    function updateExpInfo() { let data = getExpData(); $("expInfo").textContent = "سيتم تحميل " + data.length + " سجل" }
    function getExpData() {
      if (expType === "all") return V;
      if (expType === "today") return V.filter(v => v.visitDate === td());
      const f = $("expFrom").value, t = $("expTo").value;
      return V.filter(v => { if (!v.visitDate) return false; if (f && v.visitDate < f) return false; if (t && v.visitDate > t) return false; return true })
    }
    function doExport() {
      const data = getExpData(); if (!data.length) { fl("لا بيانات في الفترة المحددة", "err"); return }
      hi($("expM")); writeXLSX(data)
    }
    function writeXLSX(data) {
      const mt = [["(Partner Name) in partnership with Medical Aid for Palestinians- MAP UK"], ["Project: ", "", "Improving Access to Comprehensive Primary Health Care and Protection in Gaza"], ["Partner:"], ["Medical Point:"], ["Month"], ["Governorate"]];
      const hd = ["#", "Full Name/الإسم الكامل", "Visit Date/تاريخ الزيارة", "Last Visit Date/تاريخ آخر زيارة", "ID N./رقم الهوية", "Date of Birth/ تاريخ الميلاد", "Age/العمر", "Age Group/الفئة العمرية", "Gender/الجنس", "Gender_N", "Phone N./الهاتف", "Governorate/المحافظة", "Social Status/الحالة الاجتماعية", "Disability Status/الإعاقة", "Disability Type/نوع الإعاقة", "Displacment Tracker", "FM services", "SRH services", "Wound Care", "Breast Cancer", "Mal-Nutirition", "Referral/التحويلات", "Follow-up Date/موعد المتابعة"];
      const rows = data.map((v, i) => [i + 1, v.fullName, v.visitDate, v.lastVisitDate, v.idNumber, v.dob, v.age, v.ageGroup, v.gender, v.genderN, v.phone, v.governorate, v.socialStatus, v.disability, v.disabilityType, v.displacement, v.fmService, v.srhService, v.woundCare, v.breastCancer, v.malnutrition, v.referral, v.followUpDate]);
      const ws = XLSX.utils.aoa_to_sheet([...mt, hd, ...rows]); ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "IMS"); XLSX.writeFile(wb, "IMS_Export_" + td() + ".xlsx");
      localStorage.setItem("ims-last-export", new Date().toISOString()); localStorage.setItem("ims-save-count", "0");
      fl("✅ تم تحميل " + data.length + " سجل", "ok")
    }

    // ═══ EXPORT/IMPORT JSON Backup ═══
    function expJSON() {
      const d = JSON.stringify({ patients: P, visits: V }); const b = new Blob([d], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "IMS_Backup_" + td() + ".json"; a.click();
      localStorage.setItem("ims-last-export", new Date().toISOString()); localStorage.setItem("ims-save-count", "0");
      fl("✅ تم حفظ النسخة الاحتياطية", "ok")
    }

    // Add event listeners for export date fields
    document.addEventListener('DOMContentLoaded', function () {
      var ef = $("expFrom"), et = $("expTo");
      if (ef) ef.addEventListener("change", updateExpInfo);
      if (et) et.addEventListener("change", updateExpInfo);
    });

    function showImpModal() {
      $("impFrom").value = ""; $("impTo").value = ""; $("impRowFrom").value = ""; $("impRowTo").value = "";
      sh($("impM"))
    }


    // ═══ ARABIC TEXT NORMALIZATION (Frontend) ═══
    function normalizeArabic(text) {
        if (!text) return '';
        return text
            .replace(/[\u0623\u0625\u0622]/g, '\u0627') // أ إ آ → ا
            .replace(/\u0629/g, '\u0647')               // ة → ه
            .replace(/\u064A/g, '\u0649')               // ي → ى
            .trim();
    }

    // ═══ LOCAL PATIENT SEARCH BY NAME (with Arabic normalization) ═══
    window.searchLocalByName = function(first, second, third, family) {
        var results = [];
        var keys = Object.keys(P);
        for (var i = 0; i < keys.length; i++) {
            var id = keys[i];
            var p = P[id];
            if (!p.fullName) continue;
            var parts = p.fullName.split(/\s+/);
            var normParts = parts.map(normalizeArabic);
            var match = true;
            if (first && normalizeArabic(first) && normParts[0] && normParts[0].indexOf(normalizeArabic(first)) < 0) match = false;
            if (second && normalizeArabic(second) && normParts[1] && normParts[1].indexOf(normalizeArabic(second)) < 0) match = false;
            if (third && normalizeArabic(third) && normParts[2] && normParts[2].indexOf(normalizeArabic(third)) < 0) match = false;
            if (family && normalizeArabic(family)) {
                var familyNorm = normalizeArabic(family);
                var lastParts = normParts.slice(3).join(' ');
                if (lastParts.indexOf(familyNorm) < 0 && (!normParts[3] || normParts[3].indexOf(familyNorm) < 0)) match = false;
            }
            if (match) {
                results.push({ id: id, fullName: p.fullName, dob: p.dob || '', gender: p.gender || '', governorate: p.governorate || '', socialStatus: p.socialStatus || '', source: 'local' });
            }
            if (results.length >= 50) break;
        }
        return results;
    };

    // ═══ CIVIL REGISTRY SEARCH ═══
    window.searchCivilRegistryAdvanced = function() {
        var idN = $("idI").value.trim();
        var first = $("adv_first") ? $("adv_first").value.trim() : "";
        var second = $("adv_second") ? $("adv_second").value.trim() : "";
        var third = $("adv_third") ? $("adv_third").value.trim() : "";
        var family = $("adv_family") ? $("adv_family").value.trim() : "";
        
        if(!idN && !first && !second && !third && !family) { 
            fl("يرجى إدخال رقم الهوية أو أي من حقول الاسم للبحث", "err"); 
            return; 
        }
        
        // --- البحث المحلي في البرنامج أولاً ---
        var localResults = [];
        if (first || second || third || family) {
            localResults = window.searchLocalByName(first, second, third, family);
        } else if (idN && P[idN]) {
            var p = P[idN];
            localResults = [{ id: idN, fullName: p.fullName, dob: p.dob || '', gender: p.gender || '', governorate: p.governorate || '', socialStatus: p.socialStatus || '', source: 'local' }];
        }
        
        console.log('[doSearch] Sending:', { id: idN, first: first, second: second, third: third, family: family });
        fl("جاري البحث الشامل...", "ok");
        
        var serverUrl = window.location.origin + '/api/searchAdvanced';
        
        try {
            fetch(serverUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: idN, first: first, second: second, third: third, family: family })
            })
            .then(function(response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function(data) {
                var allResults = localResults;
                if (data.found && data.results) {
                    var localIds = new Set(localResults.map(r => String(r.id)));
                    data.results.forEach(r => {
                        if (!localIds.has(String(r.id))) {
                            r.source = 'civil';
                            allResults.push(r);
                        }
                    });
                }
                window.receiveCivilRegistryResults({ found: allResults.length > 0, results: allResults });
            })
            .catch(function(err) {
                console.error('[doSearch] Error:', err);
                // في حال فشل السجل المدني، اعرض النتائج المحلية على الأقل
                window.receiveCivilRegistryResults({ found: localResults.length > 0, results: localResults });
                fl("نتائج البحث (محلي فقط): " + err.message, "err");
            });
        } catch(e) {
            window.receiveCivilRegistryResults({ found: localResults.length > 0, results: localResults });
        }
    };

    window.doSearch = function() {
        console.log('[doSearch] Button clicked');
        var idN = $("idI").value.trim();
        var first = $("adv_first") ? $("adv_first").value.trim() : "";
        var second = $("adv_second") ? $("adv_second").value.trim() : "";
        var third = $("adv_third") ? $("adv_third").value.trim() : "";
        var family = $("adv_family") ? $("adv_family").value.trim() : "";

        if(!idN && !first && !second && !third && !family) {
            fl("يرجى إدخال رقم الهوية أو أي من حقول الاسم للبحث", "err");
            return;
        }

        // If only ID is provided and it exists locally, use local lookup
        if (idN && !first && !second && !third && !family && P[idN]) {
            lookup();
            return;
        }

        // Always search the Civil Registry
        window.searchCivilRegistryAdvanced();
    };

    window.clearSearch = function() {
        $("idI").value = "";
        $("idI").disabled = false;
        updateIDProg($("idI"));
        if($("adv_first")) $("adv_first").value = "";
        if($("adv_second")) $("adv_second").value = "";
        if($("adv_third")) $("adv_third").value = "";
        if($("adv_family")) $("adv_family").value = "";
        var container = $("cr_results_container");
        if(container) { container.innerHTML = ""; container.style.display = 'none'; }
        // Task 3: تنظيف البحث دون مسح نموذج المريض
        hi($("bF")); hi($("bN")); hi($("bW")); 
        sh($("idSB")); hi($("idCB"));
        fl("تم تنظيف حقول البحث", "ok");
    };

    window.receiveCivilRegistryResults = function(data) {
        console.log('[results] Data:', data);
        if (data.error) { fl("خطأ: " + data.message, "err"); return; }
        var container = $("cr_results_container");
        if(!container) { console.error('Container not found!'); return; }
        
        if (data.found && data.results && data.results.length > 0) {
            fl("تم العثور على " + data.results.length + " نتيجة", "ok");
            var html = '<div style="font-weight:700;color:var(--p);margin-bottom:10px;font-size:14px">📋 نتائج البحث (' + data.results.length + ')</div>';
            data.results.forEach(function(r, idx) {
                var genderAr = r.gender === "Male" ? "ذكر" : (r.gender === "Female" ? "أنثى" : (r.gender || "—"));
                var safeId = (r.id || '').toString().replace(/'/g, "\\'");
                var safeName = (r.fullName || '').replace(/'/g, "\\'");
                var safeDob = (r.dob || '').replace(/'/g, "\\'");
                var safeGender = (r.gender || '').replace(/'/g, "\\'");
                var safeGov = (r.governorate || '').replace(/'/g, "\\'");
                var safeSoc = (r.socialStatus || '').replace(/'/g, "\\'");
                
                var isLocal = r.source === 'local';
                var sourceTag = isLocal ? '<span style="font-size:10px;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-weight:600">مريض بالبرنامج</span>' 
                                       : '<span style="font-size:10px;background:var(--pl);color:var(--p);padding:2px 8px;border-radius:10px;font-weight:600">سجل مدني</span>';
                
                html += '<div class="rc" style="margin:8px 0; border-right:4px solid '+(isLocal?'#10b981':'var(--p)')+'; padding:12px 16px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
                        '<div>' +
                            '<div style="font-size:15px;font-weight:700">' + 
                                '<span style="background:'+(isLocal?'#10b981':'var(--p)')+';color:#fff;padding:1px 8px;border-radius:6px;font-size:11px;margin-left:6px">#' + (idx+1) + '</span> ' + 
                                (r.fullName || '—') + 
                            '</div>' +
                            '<div style="font-size:12px;color:var(--s);margin-top:3px">🆔 ' + (r.id || '—') + '</div>' +
                        '</div>' + sourceTag +
                    '</div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:10px 0;font-size:13px;color:var(--t)">' +
                        '<div>📅 <strong>الميلاد:</strong> ' + (r.dob || '—') + '</div>' +
                        '<div>👤 <strong>الجنس:</strong> ' + genderAr + '</div>' +
                        '<div>📍 <strong>المحافظة:</strong> ' + (r.governorate || '—') + '</div>' +
                        (r.socialStatus ? '<div>💍 <strong>الحالة:</strong> ' + r.socialStatus + '</div>' : '') +
                    '</div>' +
                    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
                        (isLocal ? 
                          '<button class="rbtn" style="background:var(--gl);color:var(--g);padding:6px 16px;font-size:12px" ' +
                            "onclick=\"sw('entry');$('idI').value='" + safeId + "';lookup()\">➕ إضافة زيارة</button>" +
                          '<button class="rbtn rbtn-e" style="padding:6px 16px;font-size:12px" ' +
                            "onclick=\"sw('entry');$('idI').value='" + safeId + "';lookup()\">✏️ تعديل</button>" +
                          '<button class="rbtn rbtn-d" style="padding:6px 16px;font-size:12px" ' +
                            "onclick=\"dlP('" + safeId + "')\">🗑️ حذف</button>" 
                        : 
                          '<button class="rbtn" style="background:var(--gl);color:var(--g);padding:6px 16px;font-size:12px" ' +
                            "onclick=\"fillFromCR({id:'" + safeId + "',fullName:'" + safeName + "',dob:'" + safeDob + "',gender:'" + safeGender + "',governorate:'" + safeGov + "',socialStatus:'" + safeSoc + "'})\">➕ إضافة زيارة</button>" +
                          '<button class="rbtn rbtn-e" style="padding:6px 16px;font-size:12px" ' +
                            "onclick=\"editCivilRecord('" + safeId + "')\">✏️ تعديل</button>" 
                        ) +
                    '</div>' +
                '</div>';
            });
            container.innerHTML = html;
            container.style.display = 'block';
        } else {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--s)"><div style="font-size:40px;opacity:.3;margin-bottom:8px">🔍</div>لم يتم العثور على بيانات مطابقة</div>';
            container.style.display = 'block';
            fl("لم يتم العثور على سجلات مطابقة", "err");
        }
    };

    window.editCivilRecord = function(id) {
        fl("جاري تحميل بيانات السجل للتعديل...", "ok");
        fetch(window.location.origin + '/api/searchAdvanced', {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.found && data.results && data.results.length > 0) {
                var rec = data.results[0];
                var newName = prompt("تعديل الاسم الكامل:", rec.fullName);
                if (newName !== null && newName.trim()) {
                    var names = newName.trim().split(' ');
                    fetch(window.location.origin + '/api/editCitizen', {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: id, first: names[0]||'', second: names[1]||'', third: names[2]||'', family: names.slice(3).join(' ')||'', dob: rec.dob, gender: rec.gender, governorate: rec.governorate })
                    })
                    .then(function(r) { return r.json(); })
                    .then(function(res) {
                        if (res.success) { fl("✅ تم تحديث السجل بنجاح", "ok"); window.doSearch(); }
                        else fl("خطأ: " + (res.message || 'فشل التحديث'), "err");
                    })
                    .catch(function(e) { fl("خطأ في الاتصال", "err"); });
                }
            }
        })
        .catch(function(e) { fl("تعذر تحميل البيانات", "err"); });
    };

    window.fillFromCR = function(r) {
        console.log('[fillFromCR] Data:', r);
        if(r.id) { $("idI").value = r.id; $("idI").disabled = true; hi($("idSB")); sh($("idCB")); }
        if(r.fullName) $("fN").value = r.fullName;
        
        if(r.dob) { 
            let dStr = r.dob.trim();
            if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dStr)) {
                let p = dStr.split(/[\/\-]/);
                dStr = p[2] + "-" + p[1].padStart(2, '0') + "-" + p[0].padStart(2, '0');
            } else if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dStr)) {
                let p = dStr.split(/[\/\-]/);
                dStr = p[0] + "-" + p[1].padStart(2, '0') + "-" + p[2].padStart(2, '0');
            }
            $("fDOB").value = dStr; 
            calcAgeFromDOB(); 
        }
        
        if (r.gender) {
            var g = r.gender;
            if(g === "ذكر" || g === "Male") g = "Male"; 
            else if(g === "أنثى" || g === "انثى" || g === "Female") g = "Female";
            F.gender = g; bPgen();
        }
        
        if (r.governorate) {
            var govStr = r.governorate.trim();
            var govMap = { "النصيرات": "Alnussirat", "البريج": "Alburaij", "الزوايدة": "Alzawida", "المغازي": "Almaghazi", "دير البلح": "Dier Albalah", "غزة": "Gaza City", "مدينة غزة": "Gaza City", "خانيونس": "Khan Younis", "رفح": "Rafah", "شمال غزة": "North Gaza" };
            
            var foundGov = "";
            if (GOV.includes(govStr)) {
                foundGov = govStr;
            } else if (govMap[govStr]) {
                foundGov = govMap[govStr];
            } else {
                for (var k in govMap) {
                    if (govStr.includes(k) || k.includes(govStr)) {
                        foundGov = govMap[k];
                        break;
                    }
                }
            }
            if (foundGov) $("fG").value = foundGov;
        }
        
        if (r.socialStatus) {
            var socStr = r.socialStatus.trim();
            var socMap = { "أعزب": "Single", "عزباء": "Single", "انسة": "Single", "أنسة": "Single", "متزوج": "Married", "متزوجة": "Married", "مطلق": "Divorced", "مطلقة": "Divorced", "أرمل": "Widowed", "أرملة": "Widowed" };
            
            var foundSoc = "";
            if (SOC.includes(socStr)) {
                foundSoc = socStr;
            } else if (socMap[socStr]) {
                foundSoc = socMap[socStr];
            } else {
                for (var k in socMap) {
                    if (socStr.includes(k) || k.includes(socStr)) {
                        foundSoc = socMap[k];
                        break;
                    }
                }
            }
            if (foundSoc) $("fSo").value = foundSoc;
        }
        
        hi($("bN")); 
        $("bF").innerHTML = '✓ تم ملء البيانات من السجل المدني — <strong>' + (r.fullName || '') + '</strong><button class="bn-x" onclick="hi(this.parentElement)">✕</button>';
        sh($("bF"));
        sh($("fS"));
        fl("✅ تم ملء البيانات من السجل المدني بنجاح", "ok");
    };


    function addVisitFrom(idN) { sw("entry"); $("idI").value = idN; lookup() }
    
    window.dlP = function(id) {
        if (!confirm("هل أنت متأكد من حذف هذا المريض وجميع زياراته نهائياً؟")) return;
        delete P[id];
        V = V.filter(v => v.idNumber !== id);
        persist(); uB(); rList();
        window.searchCivilRegistryAdvanced();
        fl("تم حذف المريض بنجاح", "err");
    };
    init();
  