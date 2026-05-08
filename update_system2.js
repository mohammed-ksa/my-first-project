const fs = require('fs');
const html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');

// Last Visit Alert logic update
let newHtml = html;

// 1. Phone validation:
newHtml = newHtml.replace(
  /<input id="fPh" type="tel" placeholder="05..." inputmode="tel">/,
  '<input id="fPh" type="tel" placeholder="05..." inputmode="tel" maxlength="10" oninput="let v=this.value.replace(/\\D/g,\'\'); if(v.length>0 && !v.startsWith(\'05\')) v=\'05\'+v.replace(/^0+/,\'\'); this.value=v.substring(0,10);">'
);

// We should also replace ePh if it exists
newHtml = newHtml.replace(
  /<input id="ePh".*?>/,
  match => match.replace('>', ' maxlength="10" oninput="let v=this.value.replace(/\\D/g,\'\'); if(v.length>0 && !v.startsWith(\'05\')) v=\'05\'+v.replace(/^0+/,\'\'); this.value=v.substring(0,10);">')
);

// 2. Gender Data Mapping
newHtml = newHtml.replace(
  /const GEN=\["ذكر","انثى"\];/,
  'const GEN=[{v:"Male", l:"ذكر"},{v:"Female", l:"أنثى"}];'
);

newHtml = newHtml.replace(
  /function bPgen\(\)\{const el=\$\("gP"\);el\.innerHTML="";GEN\.forEach\(g=>\{.*?el\.appendChild\(b\)\}\)\}/s,
  `function bPgen(){const el=$("gP");el.innerHTML="";GEN.forEach(g=>{const b=document.createElement("button");b.type="button";b.className="sp"+(F.gender===g.v?" on":"");b.textContent=g.l;b.onclick=()=>{F.gender=F.gender===g.v?"":g.v;bPgen();const age=parseInt($("fAY").value)||0;if(age>0){const curSoc=$("fSo").value;if(!curSoc||curSoc===""){const as=autoSocial(F.gender,age);if(as)$("fSo").value=as}}};el.appendChild(b)})}`
);

// Update doSave gender logic
newHtml = newHtml.replace(
  /genderN:F\.gender==="ذكر"\?"male":"female"/g,
  'genderN:F.gender==="Male"?"male":"female"'
);
newHtml = newHtml.replace(
  /gender:\$\("eG"\)\.value,genderN:\$\("eG"\)\.value==="ذكر"\?"male":"female"/g,
  'gender:$("eG").value,genderN:$("eG").value==="Male"?"male":"female"'
);

// Update eG options
newHtml = newHtml.replace(
  /<select id="eG">.*?<\/select>/,
  '<select id="eG"><option value="Male">ذكر</option><option value="Female">أنثى</option></select>'
);

// Update F initialization
newHtml = newHtml.replace(/gender:"انثى"/g, 'gender:"Female"');
newHtml = newHtml.replace(/gender:"ط§ظ†ط«ظ‰"/g, 'gender:"Female"');

// 3. Defaults for disability and displacement
// Ensure default is No and نازح
newHtml = newHtml.replace(/disability:""/g, 'disability:"No"');
newHtml = newHtml.replace(/displacement:""/g, 'displacement:"نازح"');
// They are mostly already set, but let's be sure.

// 4. Age & DOB Handling
// In lookup:
// Old logic:
// if(p.dob&&p.dob.length>=10){ $("fAY").value="";$("fAM").value="";$("fAD").value=""; sh($("dD"));$("dT").textContent="تاريخ الميلاد: "+p.dob;$("aT").textContent="العمر: "+(age!=null?age:"")+" | الفئة: "+aG(age); }else if(age!=null){$("fAY").value=age;$("fAM").value="";$("fAD").value="";uDOB() }else{$("fAY").value="";$("fAM").value="";$("fAD").value=""}
const oldDobLogic = `if(p.dob&&p.dob.length>=10){
  $("fAY").value="";$("fAM").value="";$("fAD").value="";
  sh($("dD"));$("dT").textContent="تاريخ الميلاد: "+p.dob;$("aT").textContent="العمر: "+(age!=null?age:"")+" | الفئة: "+aG(age);
}else if(age!=null){$("fAY").value=age;$("fAM").value="";$("fAD").value="";uDOB()
}else{$("fAY").value="";$("fAM").value="";$("fAD").value=""}`;

const newDobLogic = `if(p.dob&&p.dob.length>=10){
  $("fAY").value=age!=null?age:"";$("fAM").value="";$("fAD").value="";
  sh($("dD"));$("dT").textContent="تاريخ الميلاد: "+p.dob;$("aT").textContent="العمر: "+(age!=null?age:"")+" | الفئة: "+aG(age);
}else if(age!=null){$("fAY").value=age;$("fAM").value="";$("fAD").value="";uDOB()
}else{$("fAY").value="";$("fAM").value="";$("fAD").value=""}`;

// Using Regex to replace the DOB logic, as it might have formatting differences
newHtml = newHtml.replace(
  /if\(p\.dob&&p\.dob\.length>=10\)\{.*?\}\s*else if\(age!=null\)\{.*?uDOB\(\)\s*\}\s*else\{.*?\}/s,
  newDobLogic
);

// 5. Last Visit Alert
const oldAlertLogic = `if(lv&&lv.visitDate){const d=dBtw(lv.visitDate,td());if(d>=0&&d<10){
const dayText=d===0?"اليوم":d===1?"أمس":"قبل "+d+" أيام";
$("bW").innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;width:100%"><div>⚠️ تنبيه: آخر زيارة كانت <strong>'+dayText+'</strong> بتاريخ '+lv.visitDate+(lv.fmService?" ("+lv.fmService+")":"")+(lv.srhService?" ("+lv.srhService+")":"")+(d===0?"<br><strong style=\\'color:#dc2626\\'>المريض زار اليوم بالفعل!</strong>":"")+ '</div><button class="bn-x" onclick="hi(this.parentElement)">✕</button></div>';
sh($("bW"))}}`;

const newAlertLogic = `if(lv&&lv.visitDate){const d=dBtw(lv.visitDate,td());if(d>=0){
const dayText=d===0?"اليوم":d===1?"أمس":d===2?"قبل يومين":"قبل "+d+" أيام";
$("bW").innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;width:100%"><div>⚠️ تنبيه: آخر زيارة كانت '+dayText+' بتاريخ '+lv.visitDate+(lv.fmService?" ("+lv.fmService+")":"")+(lv.srhService?" ("+lv.srhService+")":"")+(d===0?"<br><strong style=\\'color:#dc2626\\'>المريض زار اليوم بالفعل!</strong>":"")+ '</div><button class="bn-x" onclick="hi(this.parentElement)">✕</button></div>';
sh($("bW"))}}`;

newHtml = newHtml.replace(
  /if\(lv&&lv\.visitDate\)\{const d=dBtw\(lv\.visitDate,td\(\)\);if\(d>=0&&d<10\)\{.*?sh\(\$\("bW"\)\)\}\}/s,
  newAlertLogic
);

fs.writeFileSync('IMS_Medical_System_4.html', newHtml, 'utf8');
console.log("Done");
