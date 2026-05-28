/**
 * migrate_excel_fixed.js
 * =====================
 * سكربت استيراد شامل ومُصحَّح يفهم بنية كل ملف Excel بشكل صحيح
 * 
 * يعالج الملفات الثلاثة:
 * 1. 2025+2026.xlsx  — الهيدر في الصف الأول، الأعمدة عربية
 * 2. 10-1.xlsx       — الهيدر في الصف رقم 8 (index 7)، الأعمدة عربية
 * 3. IMS4.xlsx       — الهيدر في الصف رقم 7 (index 6)، أعمدة مختلطة
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const EXCEL_FOLDER = path.join(__dirname, 'excel_data');
const DATABASE_PATH = path.join(__dirname, 'database.json');
const BACKUP_PATH = path.join(__dirname, `database_backup_before_excel_${Date.now()}.json`);

// ─────────────────────────────────────────────
// دوال مساعدة
// ─────────────────────────────────────────────

/**
 * تحويل تاريخ Excel الرقمي (serial) أو النصي إلى صيغة YYYY-MM-DD
 */
function excelDateToISO(val) {
    if (!val && val !== 0) return '';
    if (typeof val === 'number') {
        const d = new Date((val - 25569) * 86400 * 1000);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    }
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    // DD/MM/YYYY أو DD-MM-YYYY
    const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    return '';
}

/**
 * تطبيع قيمة الجنس إلى Male أو Female
 */
function normalizeGender(val) {
    if (!val) return '';
    const s = String(val).trim().replace(/\s+/g,'');
    if (['ذكر','Male','male','MALE','M'].includes(s)) return 'Male';
    if (['انثى','أنثى','اانثى','انثي','نثى','Female','female','FEMALE','F',
         'اانثي','أنثى ','انثى '].some(x => s.includes(x.replace(/\s/g,'')))) return 'Female';
    if (s === 'طفل') return 'Male'; // تقريب للأطفال غير محددي الجنس
    return '';
}

/**
 * تطبيع حالة النزوح
 */
function normalizeDisplacement(val) {
    if (!val) return 'Displaced';
    const s = String(val).trim();
    const displacedTerms = ['نازح','نازج','نازحة','Displaced','displaced','تازح'];
    const hostTerms = ['مقيم','مقيمة','مفيم','Host Community','host'];
    if (displacedTerms.some(t => s.includes(t))) return 'Displaced';
    if (hostTerms.some(t => s.includes(t))) return 'Host Community';
    return 'Displaced';
}

/**
 * تطبيع حالة الإعاقة
 */
function normalizeDisability(val) {
    if (!val) return 'No';
    const s = String(val).trim();
    if (['لا','لا يوجد','لايوجد','No','no','لا يو جد',' لا يوجد ','لا '].some(t => s.includes(t))) return 'No';
    if (['نعم','Yes','yes','ذوي الاعاقة','ذوي إعاقة','بصرية','حركية','ذهنية','نطق','سمعية','داون','توحد'].some(t => s.includes(t))) return 'Yes';
    return 'No';
}

/**
 * حساب العمر من تاريخ الميلاد
 */
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
 * تنظيف رقم الهوية
 */
function cleanID(val) {
    if (!val) return '';
    const s = String(val).trim().replace(/\.0+$/, '');
    const n = parseFloat(s);
    if (!isNaN(n)) return String(Math.round(n));
    return s;
}

// ─────────────────────────────────────────────
// معالجات كل ملف
// ─────────────────────────────────────────────

/**
 * ملف 2025+2026.xlsx — الهيدر مباشرة في الصف الأول
 * الأعمدة: تاريخ الزيارة، الاسم، الجنس، الحالة الاجتماعية، رقم الهوية، رقم الجوال
 *          مقيم / نازح، ذوي الاعاقة، التشخيص، CD/NCD، الخدمة المقدمة، الثلث، الاحالة
 */
function extract_2025_2026(filePath) {
    console.log('\n📄 معالجة: 2025+2026.xlsx');
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets['=DATA+++'] || wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    
    const records = [];
    for (const row of rows) {
        const id = cleanID(row['رقم الهوية']);
        const rawDate = row['تاريخ الزيارة'];
        if (!id || !rawDate) continue;
        
        const vDate = excelDateToISO(rawDate);
        if (!vDate) continue;

        const name = String(row['الاسم'] || '').trim() || 'غير محدد';
        const gender = normalizeGender(row['الجنس']);
        const phone = cleanID(row['رقم الجوال']);
        const socialStatus = String(row['الحالة الاجتماعية'] || '').trim();
        const displacement = normalizeDisplacement(row['مقيم / نازح']);
        const disability = normalizeDisability(row['ذوي الاعاقة']);
        
        // خدمات: التشخيص يحتوي على نوع الخدمة (FP, ANC, PNC, GYN, NCD, CD...)
        const diagnosis = String(row['التشخيص'] || '').trim();
        const cdNcd = String(row['CD/NCD'] || '').trim();
        const serviceType = String(row['الثلث'] || '').trim(); // MV = midwife visit?
        
        // تحديد الخدمة
        let fmService = '', srhService = '';
        const diagUp = diagnosis.toUpperCase();
        if (['ANC'].includes(diagUp)) srhService = 'ANC';
        else if (['PNC'].includes(diagUp)) srhService = 'PNC';
        else if (['FP'].includes(diagUp)) srhService = 'FP';
        else if (['GYN'].includes(diagUp)) srhService = 'GYN';
        else if (diagUp.includes('NCD')) fmService = 'FM- NCD';
        else if (diagUp.includes('CD')) fmService = 'FM- CD';
        else if (diagUp.includes('PCC')) srhService = 'ANC';
        else if (diagUp === 'ENT') fmService = 'ENT';
        else if (diagUp === 'DERMA') fmService = 'Derma';
        else fmService = 'FM- NCD'; // افتراضي

        const referral = String(row['الاحالة'] || '').trim();

        records.push({ id, name, vDate, gender, phone, socialStatus, displacement, disability, fmService, srhService, referral, dob:'', age: null });
    }
    console.log(`  ✅ تم استخراج ${records.length} سجل صالح`);
    return records;
}

/**
 * ملف 10-1.xlsx — الهيدر في الصف 8 (index 7)
 * الأعمدة: الاسم، تاريخ الزيارة، رقم الهاتف، رقم الهوية، تاريخ الميلاد، العمر
 *          الفئة العمرية، الجنس، الحالة الاجتماعية، الإعاقة، نوع الإعاقة، الخدمة المقدمة
 */
function extract_10_1(filePath) {
    console.log('\n📄 معالجة: 10-1.xlsx');
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets['البيانات'] || wb.Sheets[wb.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    // الهيدر في الصف index 7
    const headerRowIndex = 7;
    const headers = rawData[headerRowIndex];
    const dataRows = rawData.slice(headerRowIndex + 1);
    
    const records = [];
    for (const row of dataRows) {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[String(h).trim()] = row[i]; });
        
        const id = cleanID(obj['رقم الهوية']);
        const rawDate = obj['تاريخ الزيارة'];
        if (!id || id === 'NaN' || !rawDate) continue;
        
        const vDate = excelDateToISO(rawDate);
        if (!vDate) continue;
        
        const name = String(obj['الاسم'] || '').trim() || 'غير محدد';
        const gender = normalizeGender(obj['الجنس']);
        const phone = cleanID(obj['رقم الهاتف']);
        
        // تاريخ الميلاد: موجود في عمود 'تاريخ الميلاد' بقيمة رقمية Excel serial
        const rawDob = obj['تاريخ الميلاد'];
        const dob = excelDateToISO(rawDob);
        
        // العمر من عمود 'العمر' مباشرة
        let age = null;
        const ageVal = obj['العمر'];
        if (ageVal !== '' && !isNaN(Number(ageVal))) age = Math.round(Number(ageVal));
        if (age === null && dob) age = calcAge(dob);
        
        // إصلاح اسم عمود الحالة الاجتماعية (يحتوي على \r\n)
        const socialKey = Object.keys(obj).find(k => k.includes('الاجتماعية')) || 'الحالة الاجتماعية';
        const socialStatus = String(obj[socialKey] || '').trim();
        
        const displacement = 'Displaced'; // الملف لا يحتوي على هذا العمود
        const disability = normalizeDisability(obj['الإعاقة']);
        const disabilityType = String(obj['نوع الإعاقة'] || '').trim();
        
        const serviceRaw = String(obj['الخدمة المقدمة'] || '').trim();
        let fmService = '', srhService = '';
        const sUp = serviceRaw.toUpperCase();
        if (sUp.includes('NCD')) fmService = 'FM- NCD';
        else if (sUp.includes('CD')) fmService = 'FM- CD';
        else if (sUp === 'ANC') srhService = 'ANC';
        else if (sUp === 'PNC') srhService = 'PNC';
        else if (sUp === 'FP') srhService = 'FP';
        else if (sUp === 'GYN') srhService = 'GYN';
        else if (serviceRaw) fmService = 'FM- NCD'; // عام → FM-NCD

        records.push({ id, name, vDate, gender, phone, socialStatus, displacement, disability, disabilityType, fmService, srhService, referral: '', dob, age });
    }
    console.log(`  ✅ تم استخراج ${records.length} سجل صالح`);
    return records;
}

/**
 * ملف IMS4.xlsx — الهيدر في الصف 7 (index 6)، نفس بنية تصدير النظام
 */
function extract_IMS4(filePath) {
    console.log('\n📄 معالجة: IMS4.xlsx');
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets['IMS'] || wb.Sheets[wb.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    const headerRowIndex = 6;
    const headers = rawData[headerRowIndex];
    const dataRows = rawData.slice(headerRowIndex + 1);
    
    const records = [];
    for (const row of dataRows) {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[String(h).trim()] = row[i]; });
        
        const id = cleanID(obj['رقم الهوية'] || obj['ID N./رقم الهوية']);
        const rawDate = obj['تاريخ الزيارة'] || obj['Visit Date/تاريخ الزيارة'];
        if (!id || id === 'NaN' || !rawDate) continue;
        
        const vDate = excelDateToISO(rawDate);
        if (!vDate) continue;
        
        const name = String(obj['الاسم'] || obj['Full Name/الإسم الكامل'] || '').trim() || 'غير محدد';
        const rawDob = obj['Date of Birth/ تاريخ الميلاد'] || obj['تاريخ الميلاد'];
        const dob = excelDateToISO(rawDob);
        
        let age = null;
        const ageVal = obj['Age/العمر'] || obj['العمر'];
        if (ageVal !== '' && !isNaN(Number(ageVal))) age = Math.round(Number(ageVal));
        if (age === null && dob) age = calcAge(dob);
        
        const genderRaw = obj['Gender/الجنس'] || obj['الجنس'] || '';
        const gender = normalizeGender(genderRaw);
        
        const phone = cleanID(obj['Phone N./الهاتف'] || obj['رقم الجوال'] || '');
        const gov = String(obj['Governorate/المحافظة'] || obj['المحافظة'] || '').trim();
        const socialStatus = String(obj['Social Status/الحالة الاجتماعية'] || obj['الحالة الاجتماعية'] || '').trim();
        const disabilityRaw = obj['Disability Status/الإعاقة'] || obj['الإعاقة'] || '';
        const disability = normalizeDisability(disabilityRaw);
        const disabilityType = String(obj['Disability Type/نوع الإعاقة'] || obj['نوع الإعاقة'] || '').trim();
        const displacementRaw = obj['Displacment Tracker'] || obj['مقيم / نازح'] || '';
        const displacement = normalizeDisplacement(displacementRaw);
        
        const fmService = String(obj['FM services'] || '').trim();
        const srhService = String(obj['SRH services'] || '').trim();
        const woundCare = String(obj['Wound Care'] || '').trim();
        const breastCancer = String(obj['Breast Cancer'] || '').trim();
        const malnutrition = String(obj['Mal-Nutirition '] || obj['Mal-Nutirition'] || '').trim();
        const referral = String(obj['Referral/التحويلات'] || '').trim();
        const followUpDate = excelDateToISO(obj['Follow-up Date/موعد المتابعة'] || '');
        
        records.push({ id, name, vDate, gender, phone, governorate: gov, socialStatus, displacement, disability, disabilityType, fmService, srhService, woundCare, breastCancer, malnutrition, referral, followUpDate, dob, age });
    }
    console.log(`  ✅ تم استخراج ${records.length} سجل صالح`);
    return records;
}

// ─────────────────────────────────────────────
// الدالة الرئيسية
// ─────────────────────────────────────────────
function runMigration() {
    console.log('🚀 بدء عملية الاستيراد الشاملة والمُصحَّحة...\n');

    // 1. قراءة قاعدة البيانات الحالية
    let db = { patients: {}, visits: [], mf_patients: {}, mf_visits: [] };
    if (fs.existsSync(DATABASE_PATH)) {
        try {
            const raw = fs.readFileSync(DATABASE_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            db.patients = (parsed.patients && typeof parsed.patients === 'object' && !Array.isArray(parsed.patients)) ? parsed.patients : {};
            db.visits = Array.isArray(parsed.visits) ? parsed.visits : [];
            db.mf_patients = parsed.mf_patients || {};
            db.mf_visits = Array.isArray(parsed.mf_visits) ? parsed.mf_visits : [];
            console.log(`✅ قاعدة البيانات الحالية: ${Object.keys(db.patients).length} مريض، ${db.visits.length} زيارة`);
            fs.writeFileSync(BACKUP_PATH, raw, 'utf-8');
            console.log(`💾 نسخة احتياطية: ${path.basename(BACKUP_PATH)}\n`);
        } catch (e) {
            console.error('❌ خطأ في قراءة قاعدة البيانات:', e.message);
            return;
        }
    }

    const existingPatientIds = new Set(Object.keys(db.patients));
    const existingVisitKeys = new Set(db.visits.map(v => `${v.idNumber}_${v.visitDate}`));

    let totalNew = 0, totalDup = 0, totalNewP = 0;

    // 2. استخراج البيانات من كل ملف
    const allExcelFiles = fs.readdirSync(EXCEL_FOLDER);
    const service5Name = allExcelFiles.find(f => f.includes('Service_5.xlsx')) || 'IMS- Service_5.xlsx';

    const files = [
        { name: '2025+2026.xlsx', extractor: extract_2025_2026 },
        { name: '10-1.xlsx',      extractor: extract_10_1 },
        { name: 'IMS4.xlsx',      extractor: extract_IMS4 },
        { name: service5Name,     extractor: extract_IMS4 },
    ];

    for (const fileInfo of files) {
        const filePath = path.join(EXCEL_FOLDER, fileInfo.name);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ الملف غير موجود: ${fileInfo.name}`);
            continue;
        }

        let records;
        try {
            records = fileInfo.extractor(filePath);
        } catch (err) {
            console.error(`❌ خطأ في معالجة ${fileInfo.name}:`, err.message);
            continue;
        }

        let fileNew = 0, fileDup = 0, fileNewP = 0;

        for (const rec of records) {
            const pid = rec.id;
            const vKey = `${pid}_${rec.vDate}`;

            // إضافة مريض جديد
            if (!existingPatientIds.has(pid)) {
                const age = rec.age !== null ? rec.age : calcAge(rec.dob);
                db.patients[pid] = {
                    fullName: rec.name,
                    dob: rec.dob || '',
                    gender: rec.gender || '',
                    phone: rec.phone || '',
                    governorate: rec.governorate || '',
                    socialStatus: rec.socialStatus || '',
                    disability: rec.disability || 'No',
                    disabilityType: rec.disabilityType || '',
                    displacement: rec.displacement || 'Displaced',
                    lastVisitDate: rec.vDate
                };
                existingPatientIds.add(pid);
                fileNewP++;
            } else if (rec.vDate > (db.patients[pid].lastVisitDate || '')) {
                // تحديث آخر زيارة
                db.patients[pid].lastVisitDate = rec.vDate;
            }

            // إضافة زيارة جديدة
            if (!existingVisitKeys.has(vKey)) {
                const age = rec.age !== null ? rec.age : calcAge(rec.dob);
                db.visits.push({
                    id: Date.now() + Math.floor(Math.random() * 100000),
                    idNumber: pid,
                    fullName: rec.name,
                    visitDate: rec.vDate,
                    lastVisitDate: '',
                    dob: rec.dob || '',
                    age: age,
                    ageGroup: ageGroup(age),
                    gender: rec.gender || '',
                    genderN: rec.gender === 'Male' ? 'male' : (rec.gender === 'Female' ? 'female' : ''),
                    phone: rec.phone || '',
                    governorate: rec.governorate || db.patients[pid]?.governorate || '',
                    socialStatus: rec.socialStatus || db.patients[pid]?.socialStatus || '',
                    disability: rec.disability || 'No',
                    disabilityType: rec.disabilityType || '',
                    displacement: rec.displacement || 'Displaced',
                    fmService: rec.fmService || '',
                    srhService: rec.srhService || '',
                    woundCare: rec.woundCare || '',
                    breastCancer: rec.breastCancer || '',
                    malnutrition: rec.malnutrition || '',
                    referral: rec.referral || '',
                    followUpDate: rec.followUpDate || ''
                });
                existingVisitKeys.add(vKey);
                fileNew++;
            } else {
                fileDup++;
            }
        }

        console.log(`  ➕ جديد: ${fileNew} زيارة، ${fileNewP} مريض | ⏭️ مكرر: ${fileDup}`);
        totalNew += fileNew;
        totalDup += fileDup;
        totalNewP += fileNewP;
    }

    // 3. حفظ النتيجة
    if (totalNew > 0 || totalNewP > 0) {
        try {
            fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2), 'utf-8');
            console.log('\n🎉 ====================================================');
            console.log('✅ اكتمل الاستيراد بنجاح!');
            console.log(`➕ زيارات جديدة: ${totalNew}`);
            console.log(`➕ مرضى جدد:    ${totalNewP}`);
            console.log(`⏭️ مكررة تخطيها: ${totalDup}`);
            console.log(`📊 الإجمالي النهائي:`);
            console.log(`   المرضى:  ${Object.keys(db.patients).length}`);
            console.log(`   الزيارات: ${db.visits.length}`);
            console.log('====================================================\n');
        } catch (e) {
            console.error('❌ خطأ في الحفظ:', e.message);
        }
    } else {
        console.log(`\nℹ️ لا بيانات جديدة. (${totalDup} مكرر)\n`);
    }
}

runMigration();
