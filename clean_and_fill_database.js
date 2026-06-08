/**
 * clean_and_fill_database.js
 * =========================
 * يقوم هذا السكربت بالآتي:
 * 1. نسخ احتياطي لقاعدة البيانات النشطة `database_nuseirat.json`.
 * 2. تعبئة تواريخ الميلاد المفقودة من السجل المدني (persons في citizenDB.db) حتى مواليد 2026.
 * 3. توحيد تنسيق الجنس (Male/Female) وحقل genderN (male/female).
 * 4. توحيد أرقام الهواتف الخلوية لتكون 10 أرقام تبدأ بـ 05 (مثل 598777594 -> 0598777594).
 * 5. توحيد حالة النزوح إلى Displaced أو Host Community.
 * 6. إعادة حساب العمر بدقة متناهية وقت الزيارة (visitDate - dob) وتحديث الفئة العمرية.
 * 7. حذف بيانات الاختبار (المعرف 999999).
 * 8. مزامنة الزيارات المنظفة مباشرة مع قاعدة بيانات SQLite (جدول local_visits) لضمان اتساق البحث.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DATABASE_FILE = 'database_nuseirat.json';
const DATABASE_PATH = path.join(__dirname, DATABASE_FILE);
const CIVIL_DB_PATH = path.join(__dirname, 'citizenDB.db');
const BACKUP_PATH = path.join(__dirname, `database_backup_nuseirat_before_cleanup_${Date.now()}.json`);

// ─────────────────────────────────────────────
// دوال المساعدة والتوحيد
// ─────────────────────────────────────────────

function normalizeGender(val) {
    if (!val) return '';
    const s = String(val).trim().replace(/\s+/g,'');
    if (['ذكر','Male','male','MALE','M'].includes(s)) return 'Male';
    if (['انثى','أنثى','اانثى','انثي','نثى','Female','female','FEMALE','F',
         'اانثي','أنثى ','انثى '].some(x => s.includes(x.replace(/\s/g,'')))) return 'Female';
    if (s === 'طفل') return 'Male';
    return '';
}

function normalizeDisplacement(val) {
    if (!val) return 'Displaced'; // الافتراضي
    const s = String(val).trim();
    const displacedTerms = ['نازح','نازج','نازحة','Displaced','displaced','تازح'];
    const hostTerms = ['مقيم','مقيمة','مفيم','Host Community','host','مستضيف','مجتمع مضيف'];
    if (displacedTerms.some(t => s.includes(t))) return 'Displaced';
    if (hostTerms.some(t => s.includes(t))) return 'Host Community';
    return 'Displaced';
}

function normalizePhone(val) {
    if (!val) return '';
    let v = String(val).replace(/\D/g, '');
    if (v.length === 0) return '';
    
    // إذا كان 9 أرقام ويبدأ بـ 5، أضف 0 في البداية ليصبح 059...
    if (v.length === 9 && v[0] === '5') {
        v = '0' + v;
    }
    
    // تطبيق المعايير القياسية للهواتف الخلوية
    if (v[0] !== '0') v = '05' + v;
    else if (v.length > 1 && v[1] !== '5') v = '05' + v.substring(1);
    
    return v.substring(0, 10);
}

function civilDateToISO(dateStr) {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    // صيغة DD/MM/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const year = parseInt(m[3]);
        if (year < 1900 || year > 2026) return ''; // التحقق حتى 2026
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    // صيغة YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const year = parseInt(s.substring(0, 4));
        if (year < 1900 || year > 2026) return '';
        return s;
    }
    return '';
}

function calcAgeAtVisit(dob, visitDate) {
    if (!dob || !visitDate) return null;
    const b = new Date(dob);
    const v = new Date(visitDate);
    if (isNaN(b.getTime()) || isNaN(v.getTime())) return null;
    
    let age = v.getFullYear() - b.getFullYear();
    if (v.getMonth() < b.getMonth() || (v.getMonth() === b.getMonth() && v.getDate() < b.getDate())) {
        age--;
    }
    return age < 0 ? 0 : age;
}

function ageGroup(age) {
    if (age == null) return '';
    if (age <= 5) return '0-5';
    if (age <= 18) return '6-18';
    if (age <= 60) return '19-60';
    return '+60';
}

// ─────────────────────────────────────────────
// الدالة الرئيسية
// ─────────────────────────────────────────────

async function run() {
    console.log('🔄 البدء في تنظيف وتحديث قاعدة البيانات...\n');

    if (!fs.existsSync(DATABASE_PATH)) {
        console.error(`❌ لم يتم العثور على قاعدة البيانات النشطة: ${DATABASE_FILE}`);
        return;
    }

    // 1. قراءة قاعدة البيانات الحالية
    const rawData = fs.readFileSync(DATABASE_PATH, 'utf-8');
    const db = JSON.parse(rawData);

    // 2. أخذ نسخة احتياطية
    fs.writeFileSync(BACKUP_PATH, rawData, 'utf-8');
    console.log(`💾 تم أخذ نسخة احتياطية بنجاح في: ${path.basename(BACKUP_PATH)}\n`);

    const originalPatientsCount = Object.keys(db.patients || {}).length;
    const originalVisitsCount = (db.visits || []).length;
    console.log(`📊 البيانات الحالية: ${originalPatientsCount} مريض، ${originalVisitsCount} زيارة`);

    // 3. جمع المعرفات التي تحتاج تعبئة تاريخ الميلاد (DOB)
    const idsNeedDob = new Set();
    Object.entries(db.patients || {}).forEach(([id, p]) => {
        const idStr = String(id).trim();
        if (idStr === '999999' || idStr === 'رقم الهوية' || idStr === 'NaN' || idStr === 'undefined' || idStr === 'null' || idStr === '') return;
        if (!p.dob || p.dob.trim() === '') idsNeedDob.add(id);
    });
    (db.visits || []).forEach(v => {
        const idStr = String(v.idNumber).trim();
        if (idStr === '999999' || idStr === 'رقم الهوية' || idStr === 'NaN' || idStr === 'undefined' || idStr === 'null' || idStr === '') return;
        if (!v.dob || v.dob.trim() === '') idsNeedDob.add(v.idNumber);
    });

    console.log(`🔍 عدد السجلات الطبية التي تفتقد لتاريخ الميلاد: ${idsNeedDob.size}`);

    // 4. الاستعلام عن تاريخ الميلاد من السجل المدني
    const dobMap = new Map();
    if (idsNeedDob.size > 0 && fs.existsSync(CIVIL_DB_PATH)) {
        const civilDb = new sqlite3.Database(CIVIL_DB_PATH);
        const idList = [...idsNeedDob];
        const BATCH_SIZE = 500;
        let queried = 0;

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

            queried += batch.length;
            if (queried % 2000 === 0 || queried >= idList.length) {
                console.log(`   تم فحص ${queried}/${idList.length} سجل مدني | تم مطابقة: ${dobMap.size}`);
            }
        }
        civilDb.close();
        console.log(`✅ تم استرداد ${dobMap.size} تاريخ ميلاد من السجل المدني.`);
    }

    // 5. تنظيف وتحديث المرضى (Patients)
    console.log('\n🧹 تنظيف سجلات المرضى...');
    let patientDobsFilled = 0;
    let patientGenderFixed = 0;
    let patientDisplacementFixed = 0;
    let patientPhoneFixed = 0;

    // حذف مريض الاختبار والبيانات الشائبة غير الصالحة
    const invalidPatientKeys = ['999999', 'رقم الهوية', 'NaN', 'undefined', 'null', ''];
    invalidPatientKeys.forEach(k => {
        if (db.patients[k]) {
            delete db.patients[k];
            console.log(`🗑️ تم حذف سجل مريض غير صالح: (${k})`);
        }
    });

    Object.keys(db.patients || {}).forEach(id => {
        const p = db.patients[id];
        
        // تعبئة تاريخ الميلاد
        if ((!p.dob || p.dob.trim() === '') && dobMap.has(id)) {
            p.dob = dobMap.get(id);
            patientDobsFilled++;
        }

        // توحيد الجنس
        const normGender = normalizeGender(p.gender);
        if (p.gender !== normGender) {
            p.gender = normGender;
            patientGenderFixed++;
        }

        // توحيد النزوح
        const normDisp = normalizeDisplacement(p.displacement);
        if (p.displacement !== normDisp) {
            p.displacement = normDisp;
            patientDisplacementFixed++;
        }

        // توحيد الهاتف
        const normPhone = normalizePhone(p.phone);
        if (p.phone !== normPhone) {
            p.phone = normPhone;
            patientPhoneFixed++;
        }
    });

    // 6. تنظيف وتحديث الزيارات (Visits)
    console.log('🧹 تنظيف وتوحيد سجلات الزيارات...');
    let visitDobsFilled = 0;
    let visitGenderFixed = 0;
    let visitAgeRecalculated = 0;
    let visitPhoneFixed = 0;
    let visitDisplacementFixed = 0;

    const initialVisitsLength = db.visits.length;
    
    // تصفية الزيارات لحذف سجلات مريض الاختبار والبيانات الشائبة غير الصالحة
    db.visits = db.visits.filter(v => {
        const idStr = String(v.idNumber).trim();
        return idStr !== '999999' && idStr !== 'رقم الهوية' && idStr !== 'NaN' && idStr !== 'undefined' && idStr !== 'null' && idStr !== '';
    });
    const removedTestVisitsCount = initialVisitsLength - db.visits.length;
    if (removedTestVisitsCount > 0) {
        console.log(`🗑️ تم حذف ${removedTestVisitsCount} زيارة غير صالحة أو اختبارية.`);
    }

    db.visits = db.visits.map(v => {
        const p = db.patients[v.idNumber] || {};
        let changed = false;

        // 1. مزامنة وتوحيد تاريخ الميلاد
        let dob = v.dob || '';
        if (dob === '' && dobMap.has(v.idNumber)) {
            dob = dobMap.get(v.idNumber);
            visitDobsFilled++;
            changed = true;
        }
        if (dob === '' && p.dob) {
            dob = p.dob;
            visitDobsFilled++;
            changed = true;
        }

        // 2. توحيد الجنس ومزامنته
        const gender = normalizeGender(v.gender || p.gender);
        const genderN = gender === 'Male' ? 'male' : (gender === 'Female' ? 'female' : '');
        if (v.gender !== gender || v.genderN !== genderN) {
            v.gender = gender;
            v.genderN = genderN;
            visitGenderFixed++;
        }

        // 3. توحيد الهاتف
        const phone = normalizePhone(v.phone || p.phone);
        if (v.phone !== phone) {
            v.phone = phone;
            visitPhoneFixed++;
        }

        // 4. توحيد النزوح
        const displacement = normalizeDisplacement(v.displacement || p.displacement);
        if (v.displacement !== displacement) {
            v.displacement = displacement;
            visitDisplacementFixed++;
        }

        // 5. إعادة حساب العمر بدقة تاريخية (وقت الزيارة)
        if (dob && v.visitDate) {
            const age = calcAgeAtVisit(dob, v.visitDate);
            const grp = ageGroup(age);
            if (v.age !== age || v.ageGroup !== grp || changed) {
                v.age = age;
                v.ageGroup = grp;
                visitAgeRecalculated++;
            }
        }

        v.dob = dob;
        return v;
    });

    // 7. حفظ النتائج في ملف JSON
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2), 'utf-8');
    console.log(`\n💾 تم كتابة التحديثات المنظفة في ${DATABASE_FILE} بنجاح.`);

    // 8. المزامنة المباشرة مع SQLite لتحديث محرك البحث السريع
    console.log('🔄 بدء مزامنة التغييرات مع قاعدة بيانات SQLite...');
    if (fs.existsSync(CIVIL_DB_PATH)) {
        const civilDb = new sqlite3.Database(CIVIL_DB_PATH);
        
        await new Promise((resolve, reject) => {
            civilDb.serialize(() => {
                // مسح الزيارات القديمة للنصيرات فقط
                civilDb.run(`DELETE FROM local_visits WHERE pointId = 'nuseirat'`, (err) => {
                    if (err) return reject(err);
                    
                    civilDb.run("BEGIN TRANSACTION", (txErr) => {
                        if (txErr) return reject(txErr);
                        
                        const stmt = civilDb.prepare(`INSERT OR REPLACE INTO local_visits (
                            id, idNumber, fullName, phone, visitDate, gender, age, ageGroup,
                            governorate, displacement, socialStatus, disability, fmService,
                            srhService, woundCare, breastCancer, malnutrition, referral, followUp, pointId
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nuseirat')`);
                        
                        db.visits.forEach(v => {
                            const p = db.patients[v.idNumber] || {};
                            stmt.run(
                                v.id,
                                v.idNumber || "",
                                v.fullName || p.fullName || "",
                                v.phone || "",
                                v.visitDate || "",
                                v.gender || "",
                                v.age != null ? v.age : null,
                                v.ageGroup || "",
                                v.governorate || p.governorate || "",
                                v.displacement || "",
                                v.socialStatus || p.socialStatus || "",
                                v.disability || "",
                                v.fmService || "",
                                v.srhService || "",
                                v.woundCare || "",
                                v.breastCancer || "",
                                v.malnutrition || "",
                                v.referral || "",
                                v.followUp || ""
                            );
                        });
                        
                        stmt.finalize(() => {
                            civilDb.run("COMMIT", (commitErr) => {
                                if (commitErr) reject(commitErr);
                                else resolve();
                            });
                        });
                    });
                });
            });
        });
        civilDb.close();
        console.log(`✅ تم مزامنة ${db.visits.length} زيارة بنجاح مع SQLite.`);
    }

    // إحصاءات نهائية
    const finalPatientsCount = Object.keys(db.patients).length;
    const finalVisitsCount = db.visits.length;

    console.log('\n🎉 ====================================================');
    console.log('✅ اكتمل تنظيف وتحديث وتعبئة البيانات بنجاح!');
    console.log('----------------------------------------------------');
    console.log('👥 إحصاءات المرضى (Patients):');
    console.log(`   - تواريخ ميلاد تم تعبئتها من السجل المدني: ${patientDobsFilled}`);
    console.log(`   - سجلات مريض تم توحيد جنسها:          ${patientGenderFixed}`);
    console.log(`   - سجلات مريض تم توحيد هواتفها:        ${patientPhoneFixed}`);
    console.log(`   - سجلات مريض تم توحيد حالة نزوحها:     ${patientDisplacementFixed}`);
    console.log(`   - الإجمالي النهائي للمرضى:            ${finalPatientsCount}`);
    console.log('----------------------------------------------------');
    console.log('📋 إحصاءات الزيارات (Visits):');
    console.log(`   - تواريخ ميلاد تم سحبها/تعبئتها للزيارات:  ${visitDobsFilled}`);
    console.log(`   - زيارات تم توحيد وتنسيق الجنس فيها:      ${visitGenderFixed}`);
    console.log(`   - زيارات تم توحيد رقم الهاتف فيها:        ${visitPhoneFixed}`);
    console.log(`   - زيارات تم توحيد حالة النزوح فيها:       ${visitDisplacementFixed}`);
    console.log(`   - زيارات تم إعادة حساب العمر بدقة للزيارة: ${visitAgeRecalculated}`);
    console.log(`   - الإجمالي النهائي للزيارات:           ${finalVisitsCount}`);
    console.log('====================================================\n');
}

run().catch(err => console.error('❌ حدث خطأ غير متوقع:', err));
