/**
 * fill_dob_from_civil.js
 * =====================
 * يجلب تاريخ الميلاد المفقود من السجل المدني (citizenDB.db)
 * ويحسب العمر والفئة العمرية لكل زيارة ومريض
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATABASE_PATH = path.join(__dirname, 'database.json');
const CIVIL_DB_PATH = path.join(__dirname, 'citizenDB.db');

function calcAge(dob) {
    if (!dob) return null;
    const b = new Date(dob);
    if (isNaN(b.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
    return age < 0 ? 0 : age;
}

function ageGroup(age) {
    if (age == null) return '';
    if (age <= 5) return '0-5';
    if (age <= 18) return '6-18';
    if (age <= 60) return '19-60';
    return '+60';
}

/**
 * تحويل تاريخ السجل المدني DD/MM/YYYY إلى YYYY-MM-DD
 */
function civilDateToISO(dateStr) {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    // صيغة DD/MM/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const year = parseInt(m[3]);
        if (year < 1900 || year > 2025) return ''; // تاريخ غير واقعي
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    // صيغة YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return '';
}

async function run() {
    console.log('🔄 بدء تعبئة تواريخ الميلاد من السجل المدني...\n');

    // 1. قراءة database.json
    const raw = fs.readFileSync(DATABASE_PATH, 'utf-8');
    const db = JSON.parse(raw);
    
    // نسخة احتياطية
    fs.writeFileSync(
        path.join(__dirname, `database_backup_before_dob_fill_${Date.now()}.json`),
        raw, 'utf-8'
    );
    console.log('💾 تم أخذ نسخة احتياطية\n');

    // 2. جمع كل الأرقام التي تحتاج DOB
    const idsNeedDob = new Set();
    Object.entries(db.patients).forEach(([id, p]) => {
        if (!p.dob || p.dob.trim() === '') idsNeedDob.add(id);
    });
    db.visits.forEach(v => {
        if (!v.dob || v.dob.trim() === '') idsNeedDob.add(v.idNumber);
    });

    console.log(`📊 عدد أرقام الهوية التي تحتاج تاريخ ميلاد: ${idsNeedDob.size}`);

    // 3. البحث في السجل المدني على دفعات
    const civilDb = new sqlite3.Database(CIVIL_DB_PATH);
    
    const idList = [...idsNeedDob];
    const dobMap = new Map(); // id -> ISO date
    
    const BATCH_SIZE = 500;
    let queriedTotal = 0;
    
    for (let i = 0; i < idList.length; i += BATCH_SIZE) {
        const batch = idList.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '?').join(',');
        const query = `SELECT CI_ID_NUM, CI_BIRTH_DT FROM persons WHERE CI_ID_NUM IN (${placeholders})`;
        
        const rows = await new Promise((resolve, reject) => {
            civilDb.all(query, batch, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        rows.forEach(row => {
            const id = String(row.CI_ID_NUM);
            const dob = civilDateToISO(row.CI_BIRTH_DT);
            if (dob) dobMap.set(id, dob);
        });
        
        queriedTotal += batch.length;
        if (queriedTotal % 2000 === 0 || queriedTotal >= idList.length) {
            console.log(`  🔍 تم البحث عن ${queriedTotal}/${idList.length} | وُجد: ${dobMap.size}`);
        }
    }
    
    civilDb.close();
    
    console.log(`\n✅ تم العثور على ${dobMap.size} تاريخ ميلاد من أصل ${idsNeedDob.size} مطلوب`);

    // 4. تحديث المرضى
    let updatedPatients = 0;
    Object.keys(db.patients).forEach(id => {
        const p = db.patients[id];
        if ((!p.dob || p.dob.trim() === '') && dobMap.has(id)) {
            db.patients[id].dob = dobMap.get(id);
            updatedPatients++;
        }
    });

    // 5. تحديث الزيارات: DOB + العمر + الفئة العمرية
    let updatedVisitsDob = 0;
    let updatedVisitsAge = 0;
    
    db.visits = db.visits.map(v => {
        let changed = false;
        let dob = v.dob;
        
        // تعبئة DOB المفقود
        if ((!dob || dob.trim() === '') && dobMap.has(v.idNumber)) {
            dob = dobMap.get(v.idNumber);
            updatedVisitsDob++;
            changed = true;
        }
        
        // أيضاً جلب DOB من بيانات المريض إذا لم يكن في السجل المدني
        if ((!dob || dob.trim() === '') && db.patients[v.idNumber] && db.patients[v.idNumber].dob) {
            dob = db.patients[v.idNumber].dob;
            updatedVisitsDob++;
            changed = true;
        }
        
        // حساب العمر من DOB (بدلاً من الاعتماد على العمر القديم)
        if (dob) {
            const age = calcAge(dob);
            if (age !== null && (v.age == null || v.age === '' || isNaN(v.age) || changed)) {
                updatedVisitsAge++;
                return {
                    ...v,
                    dob: dob,
                    age: age,
                    ageGroup: ageGroup(age)
                };
            }
            if (changed) return { ...v, dob: dob };
        }
        
        return v;
    });

    // 6. حفظ النتيجة
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2), 'utf-8');

    // 7. إحصاء نهائي
    const remainingPNoDob = Object.entries(db.patients).filter(([id, p]) => !p.dob || p.dob.trim() === '').length;
    const remainingVNoDob = db.visits.filter(v => !v.dob || v.dob.trim() === '').length;
    const remainingNoAge = db.visits.filter(v => v.age == null || v.age === '' || isNaN(v.age)).length;

    console.log('\n🎉 ====================================================');
    console.log('✅ اكتملت تعبئة تواريخ الميلاد بنجاح!');
    console.log(`👥 مرضى تم تحديث DOB لهم:    ${updatedPatients}`);
    console.log(`📋 زيارات تم تحديث DOB لها:   ${updatedVisitsDob}`);
    console.log(`🎂 زيارات تم حساب العمر لها:  ${updatedVisitsAge}`);
    console.log('----------------------------------------------------');
    console.log(`⚠️ مرضى لا يزالون بدون DOB:   ${remainingPNoDob}`);
    console.log(`⚠️ زيارات لا تزال بدون DOB:    ${remainingVNoDob}`);
    console.log(`⚠️ زيارات لا تزال بدون عمر:    ${remainingNoAge}`);
    console.log('====================================================\n');
}

run().catch(err => console.error('❌ خطأ:', err));
