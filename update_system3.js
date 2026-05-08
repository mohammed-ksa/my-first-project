const fs = require('fs');
const html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');

let newHtml = html;

// Replace gender string literals in stats
newHtml = newHtml.replace(/v=>v\.gender==="ط°ظƒط±"/g, 'v=>v.gender==="Male"');
newHtml = newHtml.replace(/v=>v\.gender==="ذكر"/g, 'v=>v.gender==="Male"');
newHtml = newHtml.replace(/v=>v\.gender==="ط§ظ†ط«ظ‰"/g, 'v=>v.gender==="Female"');
newHtml = newHtml.replace(/v=>v\.gender==="انثى"/g, 'v=>v.gender==="Female"');

// Replace autoSocial gender checks
newHtml = newHtml.replace(/gender==="ط°ظƒط±"/g, 'gender==="Male"');
newHtml = newHtml.replace(/gender==="ط§ظ†ط«ظ‰"/g, 'gender==="Female"');
newHtml = newHtml.replace(/gender==="ذكر"/g, 'gender==="Male"');
newHtml = newHtml.replace(/gender==="انثى"/g, 'gender==="Female"');

// Update Import Excel gender parsing
const oldImportGender = `const g=String(r[8]||"").trim().replace(/\\s/g,"");const gen=(g==="ط£ظ†ط«ظ‰"||g==="ط§ظ†ط«ظ‰")?"ط§ظ†ط«ظ‰":(g==="ط°ظƒط±"?"ط°ظƒط±":g);`;
const newImportGender = `const g=String(r[8]||"").trim().replace(/\\s/g,"");const gen=(g==="ط£ظ†ط«ظ‰"||g==="ط§ظ†ط«ظ‰"||g==="أنثى"||g==="انثى"||g==="Female")?"Female":(g==="ط°ظƒط±"||g==="ذكر"||g==="Male"?"Male":g);`;
newHtml = newHtml.replace(oldImportGender, newImportGender);

// Update genderN initialization if any remains
newHtml = newHtml.replace(/gen==="ط°ظƒط±"/g, 'gen==="Male"');
newHtml = newHtml.replace(/gen==="ذكر"/g, 'gen==="Male"');

// Add Migration inside loadData
const oldLoadData = `  if(!p){await dbPut("patients",P);await dbPut("visits",V)}
  uB();`;
const newLoadData = `  let migrated = false;
  Object.values(P).forEach(patient => {
    if (patient.gender === "ذكر" || patient.gender === "ط°ظƒط±") { patient.gender = "Male"; migrated = true; }
    if (patient.gender === "انثى" || patient.gender === "ط§ظ†ط«ظ‰" || patient.gender === "أنثى" || patient.gender === "ط£ظ†ط«ظ‰") { patient.gender = "Female"; migrated = true; }
  });
  V.forEach(visit => {
    if (visit.gender === "ذكر" || visit.gender === "ط°ظƒط±") { visit.gender = "Male"; migrated = true; }
    if (visit.gender === "انثى" || visit.gender === "ط§ظ†ط«ظ‰" || visit.gender === "أنثى" || visit.gender === "ط£ظ†ط«ظ‰") { visit.gender = "Female"; migrated = true; }
  });
  if(!p || migrated){await dbPut("patients",P);await dbPut("visits",V)}
  uB();`;
newHtml = newHtml.replace(oldLoadData, newLoadData);

// Also need to make sure we replace the English labels in List rendering if it was rendering "ط°ظƒط±" before.
// Actually, v.gender will now contain "Male" or "Female", so the list will show "Male" or "Female". 
// If the user wants the UI to display "ذكر" / "أنثى" in the List (as opposed to export files), 
// we should map it in rList: v.gender==='Male'?'ذكر':'أنثى'
const oldListRender = `v.gender+' | '`;
const newListRender = `(v.gender==='Male'?'ذكر':v.gender==='Female'?'أنثى':v.gender)+' | '`;
newHtml = newHtml.replace(oldListRender, newListRender);

// Also for the UI in edit mode (eG):
// We changed eG options to <option value="Male">ذكر</option> etc., so $eG.value="Male" works perfectly.

fs.writeFileSync('IMS_Medical_System_4.html', newHtml, 'utf8');
console.log("Migration and Gender Logic Complete.");
