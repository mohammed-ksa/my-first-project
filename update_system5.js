const fs = require('fs');
const backup = JSON.parse(fs.readFileSync('IMS_Backup_2026-04-26.json', 'utf8'));
let html = fs.readFileSync('app.js', 'utf8');

Object.values(backup.patients).forEach(p => {
    if (p.gender === "ذكر" || p.gender === "ط°ظƒط±" || p.gender === "MALE" || p.gender === "Male") p.gender = "Male";
    if (p.gender === "انثى" || p.gender === "ط§ظ†ط«ظ‰" || p.gender === "أنثى" || p.gender === "ط£ظ†ط«ظ‰" || p.gender === "FEMALE" || p.gender === "Female") p.gender = "Female";
});
backup.visits.forEach(v => {
    if (v.gender === "ذكر" || v.gender === "ط°ظƒط±" || v.gender === "MALE" || v.gender === "Male") v.gender = "Male";
    if (v.gender === "انثى" || v.gender === "ط§ظ†ط«ظ‰" || v.gender === "أنثى" || v.gender === "ط£ظ†ط«ظ‰" || v.gender === "FEMALE" || v.gender === "Female") v.gender = "Female";
});

const patientsStr = JSON.stringify(backup.patients);
const visitsStr = JSON.stringify(backup.visits);

const pStart = html.indexOf('var INIT_PATIENTS = ');
const vStart = html.indexOf('var INIT_VISITS = ');
const afterVisits = html.indexOf('const GOV');

if (pStart !== -1 && vStart !== -1 && afterVisits !== -1) {
    const before = html.substring(0, pStart);
    const newMiddle = `var INIT_PATIENTS = ${patientsStr};\nvar INIT_VISITS = ${visitsStr};\n\n\n`;
    html = before + newMiddle + html.substring(afterVisits);
    fs.writeFileSync('app.js', html, 'utf8');
    console.log("Data replaced successfully");
} else {
    console.log("Could not find delimiters", pStart, vStart, afterVisits);
}
