const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// إعدادات المسارات
const EXCEL_FOLDER = path.join(__dirname, 'excel_data');
const DATABASE_PATH = path.join(__dirname, 'database.json');
// استخدام طابع زمني لتوليد اسم فريد لنسخة الاحتياطية لتجنب استبدالها
const BACKUP_PATH = path.join(__dirname, `database_backup_before_excel_${Date.now()}.json`);

// =========================================================================
// ⚠️ منطقة التعديل: أسماء الأعمدة في ملف الإكسل
// قم بتعديل القيم هنا لتتطابق تماماً مع أسماء (الهيدر/الأعمدة) في ملف الإكسل
// =========================================================================
const EXCEL_COLUMNS = {
    PATIENT_ID: 'رقم الهوية',          // ضروري جداً
    PATIENT_NAME: 'الاسم',              // ضروري
    PATIENT_DOB: 'تاريخ الميلاد',       // اختياري
    PATIENT_GENDER: 'الجنس',            // اختياري
    PATIENT_PHONE: 'رقم الجوال',        // اختياري

    VISIT_DATE: 'تاريخ الزيارة',        // ضروري جداً لمنع التكرار
    VISIT_CLINIC: 'العيادة',            // اختياري
    VISIT_SERVICE: 'نوع الخدمة',        // اختياري
    VISIT_DIAGNOSIS: 'التشخيص',         // اختياري
    VISIT_DOCTOR: 'الطبيب المعالج',     // اختياري
    VISIT_NOTES: 'ملاحظات'              // اختياري
};
// =========================================================================

// =========================================================================
// دالة مساعدة: حساب العمر من تاريخ الميلاد
// =========================================================================
function calculateAge(dob) {
    if (!dob) return { age: 0, ageGroup: 'Unknown' };
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return { age: 0, ageGroup: 'Unknown' };
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    let ageGroup;
    if (age < 5) ageGroup = '0-4';
    else if (age < 19) ageGroup = '5-18';
    else if (age <= 60) ageGroup = '19-60';
    else ageGroup = '60+';
    return { age, ageGroup };
}

function runMigration() {
    console.log('🚀 بدء عملية استخراج ودمج البيانات من الإكسل...\n');

    // 1. التحقق من وجود مجلد الإكسل، وإنشائه إذا لم يكن موجوداً
    if (!fs.existsSync(EXCEL_FOLDER)) {
        console.error(`❌ المجلد غير موجود: ${EXCEL_FOLDER}`);
        console.log('🛠️ جاري إنشاء المجلد... يرجى وضع ملفات الإكسل فيه وإعادة تشغيل السكربت.');
        fs.mkdirSync(EXCEL_FOLDER);
        return;
    }

    // 2. قراءة ملف قاعدة البيانات الحالي وأخذ نسخة احتياطية (Atomic Merge)
    // =========================================================================
    // الهيكل الفعلي لـ database.json:
    //   patients = Object  { "47097921": { fullName, dob, gender, ... }, ... }
    //   visits   = Array   [ { id, idNumber, fullName, visitDate, ... }, ... ]
    // =========================================================================
    let db = { patients: {}, visits: [], mf_patients: {}, mf_visits: [] };

    if (fs.existsSync(DATABASE_PATH)) {
        try {
            const rawData = fs.readFileSync(DATABASE_PATH, 'utf-8');
            const parsed = JSON.parse(rawData);

            // التحقق الآمن: التعامل مع أي هيكل ممكن
            if (parsed.patients && typeof parsed.patients === 'object' && !Array.isArray(parsed.patients)) {
                db.patients = parsed.patients; // Object - الهيكل الصحيح
            } else if (Array.isArray(parsed.patients)) {
                // تحويل مصفوفة إلى Object مفهرس بالـ ID احتياطياً
                db.patients = {};
                parsed.patients.forEach(p => { if (p.id) db.patients[String(p.id)] = p; });
            } else {
                db.patients = {};
            }

            db.visits = Array.isArray(parsed.visits) ? parsed.visits : [];
            db.mf_patients = parsed.mf_patients || {};
            db.mf_visits = Array.isArray(parsed.mf_visits) ? parsed.mf_visits : [];

            const patientCount = Object.keys(db.patients).length;
            const visitCount = db.visits.length;
            console.log(`✅ تم قراءة قاعدة البيانات الحالية بنجاح. (${patientCount} مريض, ${visitCount} زيارة)`);

            // أخذ نسخة احتياطية قبل أي تعديل
            fs.writeFileSync(BACKUP_PATH, rawData, 'utf-8');
            console.log(`💾 تم أخذ نسخة احتياطية بنجاح باسم:\n   👉 ${path.basename(BACKUP_PATH)}\n`);
        } catch (error) {
            console.error('❌ خطأ فادح في قراءة ملف قاعدة البيانات الحالي:', error);
            return;
        }
    } else {
        console.log('⚠️ ملف database.json غير موجود، سيتم إنشاء قاعدة بيانات جديدة بالكامل.');
    }

    // =========================================================================
    // خوارزمية منع التكرار (Deduplication Logic) باستخدام الـ Sets
    // =========================================================================

    // Set للمرضى: المفاتيح هي أرقام الهويات الموجودة فعلاً في الكائن
    const existingPatientIds = new Set(Object.keys(db.patients));

    // Set للزيارات: مفتاح مركب من (رقم الهوية + تاريخ الزيارة)
    const existingVisitKeys = new Set(
        db.visits.map(v => `${v.idNumber}_${v.visitDate}`)
    );

    // 3. قراءة ملفات الإكسل (Batch Processing)
    const files = fs.readdirSync(EXCEL_FOLDER).filter(f =>
        f.endsWith('.xlsx') || f.endsWith('.xls')
    );

    if (files.length === 0) {
        console.log('⚠️ لا يوجد أي ملفات إكسل (.xlsx أو .xls) في مجلد excel_data.');
        return;
    }

    let newPatientsCount = 0;
    let newVisitsCount = 0;
    let skippedVisitsCount = 0;

    for (const file of files) {
        console.log(`📄 جاري معالجة الملف: ${file}...`);
        const filePath = path.join(EXCEL_FOLDER, file);

        try {
            const workbook = xlsx.readFile(filePath);

            for (const sheetName of workbook.SheetNames) {
                console.log(`  📑 قراءة الشيت: ${sheetName}`);
                const worksheet = workbook.Sheets[sheetName];

                // تحويل محتوى الشيت إلى مصفوفة JSON
                const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

                for (const row of data) {
                    const rawPatientId = row[EXCEL_COLUMNS.PATIENT_ID];
                    const rawVisitDate = row[EXCEL_COLUMNS.VISIT_DATE];

                    // تخطي الأسطر التي لا تحتوي على معلومات أساسية
                    if (!rawPatientId || !rawVisitDate) {
                        continue;
                    }

                    const patientId = String(rawPatientId).trim();
                    const visitDate = String(rawVisitDate).trim();
                    const patientName = String(row[EXCEL_COLUMNS.PATIENT_NAME] || 'غير محدد').trim();
                    const dob = String(row[EXCEL_COLUMNS.PATIENT_DOB] || '').trim();
                    const gender = String(row[EXCEL_COLUMNS.PATIENT_GENDER] || '').trim();
                    const phone = String(row[EXCEL_COLUMNS.PATIENT_PHONE] || '').trim();

                    // --- [ أ ] معالجة المريض ---
                    // db.patients هو Object: المفتاح = رقم الهوية
                    if (!existingPatientIds.has(patientId)) {
                        db.patients[patientId] = {
                            fullName: patientName,
                            dob: dob,
                            gender: gender,
                            phone: phone,
                            governorate: '',
                            socialStatus: '',
                            disability: 'No',
                            disabilityType: '',
                            displacement: '',
                            lastVisitDate: visitDate
                        };
                        existingPatientIds.add(patientId);
                        newPatientsCount++;
                    }

                    // --- [ ب ] معالجة الزيارة (Deduplication check) ---
                    const visitKey = `${patientId}_${visitDate}`;

                    if (!existingVisitKeys.has(visitKey)) {
                        // توليد ID فريد بنفس نمط النظام الحالي: timestamp + random
                        const uniqueVisitId = Date.now() + Math.floor(Math.random() * 10000);
                        const { age, ageGroup } = calculateAge(dob);

                        const newVisit = {
                            id: uniqueVisitId,
                            idNumber: patientId,
                            fullName: patientName,
                            visitDate: visitDate,
                            lastVisitDate: '',
                            dob: dob,
                            age: age,
                            ageGroup: ageGroup,
                            gender: gender,
                            genderN: gender ? gender.toLowerCase() : '',
                            phone: phone,
                            governorate: '',
                            socialStatus: '',
                            disability: 'No',
                            disabilityType: '',
                            displacement: '',
                            fmService: String(row[EXCEL_COLUMNS.VISIT_SERVICE] || '').trim(),
                            srhService: '',
                            woundCare: '',
                            breastCancer: '',
                            malnutrition: '',
                            referral: '',
                            followUpDate: ''
                            // ⚠️ أضف هنا أي حقول إضافية حسب هيكل نظامك
                        };

                        db.visits.push(newVisit);
                        existingVisitKeys.add(visitKey);
                        newVisitsCount++;

                        // تحديث lastVisitDate للمريض إذا كان التاريخ أحدث
                        if (db.patients[patientId]) {
                            const existing = db.patients[patientId].lastVisitDate || '';
                            if (!existing || visitDate > existing) {
                                db.patients[patientId].lastVisitDate = visitDate;
                            }
                        }
                    } else {
                        skippedVisitsCount++;
                    }
                }
            }
        } catch (error) {
            console.error(`❌ حدث خطأ أثناء معالجة الملف [${file}]:`, error.message);
        }
    }

    // 4. الحفظ النهائي بأمان
    try {
        if (newPatientsCount > 0 || newVisitsCount > 0) {
            fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2), 'utf-8');
            console.log('\n🎉 ====================================================');
            console.log('✅ اكتملت عملية الترحيل بنجاح وتم تحديث database.json!');
            console.log(`➕ مرضى جدد تمت إضافتهم: ${newPatientsCount}`);
            console.log(`➕ زيارات جديدة تمت إضافتها: ${newVisitsCount}`);
            console.log(`⏭️ زيارات مكررة تم تخطيها: ${skippedVisitsCount}`);
            console.log(`📊 الإجمالي الآن: ${Object.keys(db.patients).length} مريض, ${db.visits.length} زيارة`);
            console.log('==================================================== 🎉\n');
        } else {
            console.log(`\nℹ️ لم يتم العثور على أي بيانات جديدة. (تم تخطي ${skippedVisitsCount} زيارة مكررة)\n`);
        }
    } catch (error) {
        console.error('❌ خطأ أثناء حفظ التحديثات في قاعدة البيانات:', error);
    }
}

runMigration();
