const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const db = new sqlite3.Database('./citizenDB.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('✅ Connected to the Civil Registry database.');
        
        // Asynchronously check and create indexes in background
        const createIndexes = [
            `CREATE INDEX IF NOT EXISTS idx_persons_first_norm ON persons (REPLACE(REPLACE(REPLACE(REPLACE(CI_FIRST_ARB, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه'))`,
            `CREATE INDEX IF NOT EXISTS idx_persons_father_norm ON persons (REPLACE(REPLACE(REPLACE(REPLACE(CI_FATHER_ARB, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه'))`,
            `CREATE INDEX IF NOT EXISTS idx_persons_grand_father_norm ON persons (REPLACE(REPLACE(REPLACE(REPLACE(CI_GRAND_FATHER_ARB, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه'))`,
            `CREATE INDEX IF NOT EXISTS idx_persons_family_norm ON persons (REPLACE(REPLACE(REPLACE(REPLACE(CI_FAMILY_ARB, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه'))`
        ];
        
        console.log('🔄 Checking Civil Registry search indexes... (This may take a moment on the very first run)');
        let indexCount = 0;
        createIndexes.forEach((sql) => {
            db.run(sql, (idxErr) => {
                if (idxErr) {
                    console.error('❌ Error creating index:', idxErr.message);
                }
                indexCount++;
                if (indexCount === createIndexes.length) {
                    console.log('✅ Checked all Civil Registry search indexes.');
                    syncJsonToSqlite();
                }
            });
        });
    }
});

// ═══ Medical Point Configurations and Migration ═══
const POINTS = {
  nuseirat: { name: 'نقطة النصيرات الطبية (ابو مدين)', password: 'nu2026', dbFile: 'database_nuseirat.json' },
  mujayda:  { name: 'نقطة المجايدة', password: 'm2026', dbFile: 'database_mujayda.json' },
  deirbalah:{ name: 'نقطة دير البلح', password: 'd2026', dbFile: 'database_deirbalah.json' }
};

function getDbPath(pointId) {
    const point = POINTS[pointId];
    if (!point) {
        throw new Error('Invalid medical point ID');
    }
    return path.join(__dirname, point.dbFile);
}

// Migrate database.json to database_nuseirat.json on startup if needed
const oldDbPath = path.join(__dirname, 'database.json');
const nuseiratDbPath = path.join(__dirname, 'database_nuseirat.json');
if (fs.existsSync(oldDbPath) && !fs.existsSync(nuseiratDbPath)) {
    try {
        fs.renameSync(oldDbPath, nuseiratDbPath);
        console.log('✅ Migrated legacy database.json to database_nuseirat.json');
    } catch (e) {
        console.error('❌ Failed to migrate database.json:', e.message);
    }
}

// ═══ Login API ═══
app.post('/api/login', (req, res) => {
    const { pointId, password } = req.body;
    const point = POINTS[pointId];
    if (point && point.password === password) {
        console.log(`[login] Successful login for point: ${pointId}`);
        res.json({ success: true, name: point.name, pointId });
    } else {
        console.warn(`[login] Failed login attempt for point: ${pointId}`);
        res.status(401).json({ success: false, message: 'اسم النقطة الطبية أو كلمة المرور غير صحيحة' });
    }
});

// ═══ Medical Data APIs ═══
app.get('/api/data', (req, res) => {
    const pointId = req.query.point || 'nuseirat';
    let dbPath;
    try {
        dbPath = getDbPath(pointId);
    } catch (err) {
        return res.status(400).json({ error: true, message: err.message });
    }

    if (!fs.existsSync(dbPath)) {
        return res.json({ patients: {}, visits: [], mf_patients: {}, mf_visits: [] });
    }

    fs.readFile(dbPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading database file for ${pointId}:`, err);
            return res.json({ patients: {}, visits: [], mf_patients: {}, mf_visits: [] });
        }
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            console.error(`Error parsing database file for ${pointId}:`, e);
            res.json({ patients: {}, visits: [], mf_patients: {}, mf_visits: [] });
        }
    });
});

app.post('/api/save', (req, res) => {
    const incoming = req.body || {};
    const pointId = incoming.pointId || 'nuseirat';
    let dbPath;
    try {
        dbPath = getDbPath(pointId);
    } catch (err) {
        return res.status(400).json({ error: true, message: err.message });
    }

    const incomingPatients = incoming.patients || {};
    const incomingVisits = Array.isArray(incoming.visits) ? incoming.visits : [];
    const incomingMfPatients = incoming.mf_patients || {};
    const incomingMfVisits = Array.isArray(incoming.mf_visits) ? incoming.mf_visits : [];

    // Read current file to merge (protect imported data from being overwritten)
    let diskPatients = {};
    let diskVisits = [];
    let diskMfPatients = {};
    let diskMfVisits = [];
    try {
        if (fs.existsSync(dbPath)) {
            const raw = fs.readFileSync(dbPath, 'utf8');
            const parsed = JSON.parse(raw);
            diskPatients = (parsed.patients && typeof parsed.patients === 'object' && !Array.isArray(parsed.patients)) ? parsed.patients : {};
            diskVisits = Array.isArray(parsed.visits) ? parsed.visits : [];
            diskMfPatients = (parsed.mf_patients && typeof parsed.mf_patients === 'object' && !Array.isArray(parsed.mf_patients)) ? parsed.mf_patients : {};
            diskMfVisits = Array.isArray(parsed.mf_visits) ? parsed.mf_visits : [];
        }
    } catch (e) {
        console.warn(`Could not read existing database file for ${pointId} for merge:`, e.message);
    }

    // Merge patients: incoming updates overwrite disk, but disk patients not in incoming are kept
    const mergedPatients = { ...diskPatients, ...incomingPatients };
    const mergedMfPatients = { ...diskMfPatients, ...incomingMfPatients };

    // Merge visits: deduplicate by unique visit id, incoming wins on conflict
    const visitIdSet = new Set();
    const mergedVisits = [];
    // Add incoming first (priority — browser edits/deletions take precedence)
    for (const v of incomingVisits) {
        const key = String(v.id);
        if (!visitIdSet.has(key)) {
            visitIdSet.add(key);
            mergedVisits.push(v);
        }
    }
    // Then add disk visits that aren't already present
    for (const v of diskVisits) {
        const key = String(v.id);
        if (!visitIdSet.has(key)) {
            visitIdSet.add(key);
            mergedVisits.push(v);
        }
    }

    // Merge mf_visits: deduplicate by unique visit id, incoming wins on conflict
    const mfVisitIdSet = new Set();
    const mergedMfVisits = [];
    for (const v of incomingMfVisits) {
        const key = String(v.id);
        if (!mfVisitIdSet.has(key)) {
            mfVisitIdSet.add(key);
            mergedMfVisits.push(v);
        }
    }
    for (const v of diskMfVisits) {
        const key = String(v.id);
        if (!mfVisitIdSet.has(key)) {
            mfVisitIdSet.add(key);
            mergedMfVisits.push(v);
        }
    }

    const mergedDb = {
        patients: mergedPatients,
        visits: mergedVisits,
        mf_patients: mergedMfPatients,
        mf_visits: mergedMfVisits
    };

    const data = JSON.stringify(mergedDb, null, 2);
    fs.writeFile(dbPath, data, 'utf8', (err) => {
        if (err) {
            console.error(`Error writing database file for ${pointId}:`, err);
            return res.status(500).json({ error: true, message: 'Failed to save data' });
        }
        console.log(`[save - ${pointId}] Merged: ${Object.keys(mergedPatients).length} patients, ${mergedVisits.length} visits`);
        
        // Sync to SQLite local_visits table
        db.serialize(() => {
            db.run(`DELETE FROM local_visits WHERE pointId = ?`, [pointId], (delErr) => {
                if (delErr) {
                    console.error(`[save-sync] Failed to clear local_visits for ${pointId}:`, delErr.message);
                } else {
                    db.run("BEGIN TRANSACTION", (txErr) => {
                        if (txErr) {
                            console.error(`[save-sync] Transaction start failed:`, txErr.message);
                            return;
                        }
                        
                        const stmt = db.prepare(`INSERT OR REPLACE INTO local_visits (
                            id, idNumber, fullName, phone, visitDate, gender, age, ageGroup,
                            governorate, displacement, socialStatus, disability, fmService,
                            srhService, woundCare, breastCancer, malnutrition, referral, followUp, pointId
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                        
                        mergedVisits.forEach(v => {
                            const p = mergedPatients[v.idNumber] || {};
                            const fullName = v.fullName || p.fullName || "";
                            const phone = v.phone || p.phone || "";
                            const gender = v.gender || p.gender || "";
                            const governorate = v.governorate || p.governorate || "";
                            const displacement = v.displacement || p.displacement || "";
                            const socialStatus = v.socialStatus || p.socialStatus || "";
                            const disability = v.disability || p.disability || "";
                            
                            stmt.run(
                                v.id,
                                v.idNumber || "",
                                fullName,
                                phone,
                                v.visitDate || "",
                                gender,
                                v.age != null ? v.age : null,
                                v.ageGroup || "",
                                governorate,
                                displacement,
                                socialStatus,
                                disability,
                                v.fmService || "",
                                v.srhService || "",
                                v.woundCare || "",
                                v.breastCancer || "",
                                v.malnutrition || "",
                                v.referral || "",
                                v.followUp || "",
                                pointId
                            );
                        });
                        
                        stmt.finalize(() => {
                            db.run("COMMIT", (commitErr) => {
                                if (commitErr) {
                                    console.error(`[save-sync] Commit failed for ${pointId}:`, commitErr.message);
                                } else {
                                    console.log(`[save-sync] Synced ${mergedVisits.length} visits to local_visits for ${pointId}`);
                                }
                            });
                        });
                    });
                }
            });
        });

        // Return merged data so browser syncs to the complete dataset
        res.json({ success: true, dbData: mergedDb });
    });
});

app.post('/api/deleteData', (req, res) => {
    const { patientId, visitId, pointId } = req.body;
    const targetPointId = pointId || 'nuseirat';
    let dbPath;
    try {
        dbPath = getDbPath(targetPointId);
    } catch (err) {
        return res.status(400).json({ error: true, message: err.message });
    }

    try {
        let diskPatients = {};
        let diskVisits = [];
        let diskMfPatients = {};
        let diskMfVisits = [];
        if (fs.existsSync(dbPath)) {
            const raw = fs.readFileSync(dbPath, 'utf8');
            const parsed = JSON.parse(raw);
            diskPatients = (parsed.patients && typeof parsed.patients === 'object' && !Array.isArray(parsed.patients)) ? parsed.patients : {};
            diskVisits = Array.isArray(parsed.visits) ? parsed.visits : [];
            diskMfPatients = (parsed.mf_patients && typeof parsed.mf_patients === 'object' && !Array.isArray(parsed.mf_patients)) ? parsed.mf_patients : {};
            diskMfVisits = Array.isArray(parsed.mf_visits) ? parsed.mf_visits : [];
            
            if (patientId) {
                delete diskPatients[patientId];
                diskVisits = diskVisits.filter(v => String(v.idNumber) !== String(patientId));
                delete diskMfPatients[patientId];
                diskMfVisits = diskMfVisits.filter(v => String(v.idNumber) !== String(patientId));
                console.log(`[delete - ${targetPointId}] Removed patient ${patientId} and their visits from both regular and medical facility registers`);
            }
            if (visitId) {
                diskVisits = diskVisits.filter(v => String(v.id) !== String(visitId));
                diskMfVisits = diskMfVisits.filter(v => String(v.id) !== String(visitId));
                console.log(`[delete - ${targetPointId}] Removed visit ${visitId} from both regular and medical facility registers`);
            }
            
            const mergedDb = {
                patients: diskPatients,
                visits: diskVisits,
                mf_patients: diskMfPatients,
                mf_visits: diskMfVisits
            };
            
            fs.writeFile(dbPath, JSON.stringify(mergedDb, null, 2), 'utf8', (err) => {
                if (err) return res.status(500).json({ error: true, message: 'Failed to delete' });
                
                // Sync delete to SQLite
                if (patientId) {
                    db.run(`DELETE FROM local_visits WHERE idNumber = ? AND pointId = ?`, [patientId, targetPointId]);
                }
                if (visitId) {
                    db.run(`DELETE FROM local_visits WHERE id = ? AND pointId = ?`, [visitId, targetPointId]);
                }
                
                res.json({ success: true, dbData: mergedDb });
            });
        } else {
            res.json({ success: true });
        }
    } catch (e) {
        console.error(`Delete error for ${targetPointId}:`, e);
        res.status(500).json({ error: true, message: e.message });
    }
});

// ═══ SQLite Local Medical Records Sync Helper ═══
function syncJsonToSqlite() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS local_visits (
            id INTEGER PRIMARY KEY,
            idNumber TEXT,
            fullName TEXT,
            phone TEXT,
            visitDate TEXT,
            gender TEXT,
            age INTEGER,
            ageGroup TEXT,
            governorate TEXT,
            displacement TEXT,
            socialStatus TEXT,
            disability TEXT,
            fmService TEXT,
            srhService TEXT,
            woundCare TEXT,
            breastCancer TEXT,
            malnutrition TEXT,
            referral TEXT,
            followUp TEXT,
            pointId TEXT
        )`);
        
        db.run(`DELETE FROM local_visits`, (delErr) => {
            if (delErr) {
                console.error('❌ Error clearing local_visits:', delErr.message);
                return;
            }
            
            Object.keys(POINTS).forEach(pointId => {
                const dbPath = getDbPath(pointId);
                if (fs.existsSync(dbPath)) {
                    try {
                        const raw = fs.readFileSync(dbPath, 'utf8');
                        const parsed = JSON.parse(raw);
                        const visits = Array.isArray(parsed.visits) ? parsed.visits : [];
                        const patients = (parsed.patients && typeof parsed.patients === 'object') ? parsed.patients : {};
                        
                        if (visits.length === 0) return;
                        
                        db.run("BEGIN TRANSACTION", (txErr) => {
                            if (txErr) {
                                console.error('❌ Error starting sync transaction:', txErr.message);
                                return;
                            }
                            
                            const stmt = db.prepare(`INSERT OR REPLACE INTO local_visits (
                                id, idNumber, fullName, phone, visitDate, gender, age, ageGroup,
                                governorate, displacement, socialStatus, disability, fmService,
                                srhService, woundCare, breastCancer, malnutrition, referral, followUp, pointId
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                            
                            visits.forEach(v => {
                                const p = patients[v.idNumber] || {};
                                const fullName = v.fullName || p.fullName || "";
                                const phone = v.phone || p.phone || "";
                                const gender = v.gender || p.gender || "";
                                const governorate = v.governorate || p.governorate || "";
                                const displacement = v.displacement || p.displacement || "";
                                const socialStatus = v.socialStatus || p.socialStatus || "";
                                const disability = v.disability || p.disability || "";
                                
                                stmt.run(
                                    v.id,
                                    v.idNumber || "",
                                    fullName,
                                    phone,
                                    v.visitDate || "",
                                    gender,
                                    v.age != null ? v.age : null,
                                    v.ageGroup || "",
                                    governorate,
                                    displacement,
                                    socialStatus,
                                    disability,
                                    v.fmService || "",
                                    v.srhService || "",
                                    v.woundCare || "",
                                    v.breastCancer || "",
                                    v.malnutrition || "",
                                    v.referral || "",
                                    v.followUp || "",
                                    pointId
                                );
                            });
                            
                            stmt.finalize(() => {
                                db.run("COMMIT", (commitErr) => {
                                    if (commitErr) {
                                        console.error('❌ Error committing sync transaction:', commitErr.message);
                                    } else {
                                        console.log(`[sync] Loaded ${visits.length} visits from ${pointId} into SQLite local_visits.`);
                                    }
                                });
                            });
                        });
                    } catch (e) {
                        console.error(`[sync] Failed to sync ${pointId} JSON to SQLite:`, e.message);
                    }
                }
            });
        });
    });
}

// ═══ Real-time Local Search API ═══
app.post('/api/searchLocal', (req, res) => {
    const { q, pointId, date, service } = req.body;
    const targetPointId = pointId || 'nuseirat';
    
    let conditions = ['pointId = ?'];
    let params = [targetPointId];
    
    if (q && q.trim()) {
        const normalized = normalizeArabic(q.trim());
        const searchTerm = `%${normalized}%`;
        conditions.push(`(${sqlNormalizeCol('fullName')} LIKE ? OR idNumber LIKE ? OR phone LIKE ?)`);
        params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (date && date.trim()) {
        conditions.push('visitDate = ?');
        params.push(date.trim());
    }
    
    if (service && service.trim()) {
        const s = service.trim();
        if (s === 'FM') {
            conditions.push("fmService != '' AND fmService IS NOT NULL");
        } else if (s === 'SRH') {
            conditions.push("srhService != '' AND srhService IS NOT NULL");
        } else if (s === 'Wound') {
            conditions.push("woundCare != '' AND woundCare IS NOT NULL");
        } else if (s === 'Breast') {
            conditions.push("breastCancer != '' AND breastCancer IS NOT NULL");
        } else if (s === 'Mal') {
            conditions.push("malnutrition != '' AND malnutrition IS NOT NULL");
        }
    }
    
    const query = `SELECT * FROM local_visits WHERE ${conditions.join(' AND ')} ORDER BY visitDate DESC, id DESC LIMIT 150`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('[searchLocal] Error:', err.message);
            return res.status(500).json({ error: true, message: err.message });
        }
        res.json({ success: true, results: rows || [] });
    });
});

// ═══ Arabic Text Normalization ═══
// Normalizes Arabic text in JS: unify Alif variants → ا, Ta Marbuta → ه
function normalizeArabic(text) {
    if (!text) return '';
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .trim();
}

// Wraps a SQL column with nested REPLACE to normalize Arabic at DB level
function sqlNormalizeCol(col) {
    return `REPLACE(REPLACE(REPLACE(REPLACE(${col}, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه')`;
}

// ═══ Search API (ID or Name with Arabic Normalization) ═══
app.post('/api/searchAdvanced', (req, res) => {
    const { id, first, second, third, family } = req.body;
    let conditions = [];
    let params = [];

    // ID search: numeric, optimized to use PK index or index range scans
    if (id && id.trim()) {
        const cleanId = id.trim();
        if (/^\d{9}$/.test(cleanId)) {
            // 9-digit exact ID matches PK index (0.1ms execution)
            conditions.push('CI_ID_NUM = ?');
            params.push(parseInt(cleanId));
        } else if (/^\d+$/.test(cleanId)) {
            // Partial digit matches index prefix range scans
            conditions.push('CAST(CI_ID_NUM AS TEXT) LIKE ?');
            params.push(`${cleanId}%`);
        } else {
            // Safe fallback
            conditions.push('CAST(CI_ID_NUM AS TEXT) LIKE ?');
            params.push(`%${cleanId}%`);
        }
    }
    // Name searches: use prefix matching (no leading wildcard) to leverage expression indexes
    if (first && first.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_FIRST_ARB')} LIKE ?`);
        params.push(`${normalizeArabic(first.trim())}%`);
    }
    if (second && second.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_FATHER_ARB')} LIKE ?`);
        params.push(`${normalizeArabic(second.trim())}%`);
    }
    if (third && third.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_GRAND_FATHER_ARB')} LIKE ?`);
        params.push(`${normalizeArabic(third.trim())}%`);
    }
    if (family && family.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_FAMILY_ARB')} LIKE ?`);
        params.push(`${normalizeArabic(family.trim())}%`);
    }

    if (conditions.length === 0) {
        return res.json({ found: false, results: [] });
    }

    const query = `SELECT CI_ID_NUM, CI_FIRST_ARB, CI_FATHER_ARB, CI_GRAND_FATHER_ARB, CI_FAMILY_ARB,
                          CI_BIRTH_DT, CI_SEX_CD, CITTTTY, CI_PERSONAL_CD
                   FROM persons WHERE ${conditions.join(' AND ')} LIMIT 50`;

    console.log('[searchAdvanced] SQL:', query, '| Params:', params);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('[searchAdvanced] Error:', err.message);
            return res.json({ error: true, message: err.message });
        }
        if (rows && rows.length > 0) {
            const results = rows.map(row => {
                const fullName = [
                    row.CI_FIRST_ARB, row.CI_FATHER_ARB,
                    row.CI_GRAND_FATHER_ARB, row.CI_FAMILY_ARB
                ].filter(n => n && n !== '-').join(' ');
                const gender = row.CI_SEX_CD === 'ذكر' ? 'Male'
                    : (row.CI_SEX_CD === 'أنثى' ? 'Female' : (row.CI_SEX_CD || ''));
                return {
                    id: row.CI_ID_NUM,
                    first: row.CI_FIRST_ARB || '',
                    second: row.CI_FATHER_ARB || '',
                    third: row.CI_GRAND_FATHER_ARB || '',
                    family: row.CI_FAMILY_ARB || '',
                    fullName: fullName,
                    dob: row.CI_BIRTH_DT || '',
                    gender: gender,
                    genderAr: row.CI_SEX_CD || '',
                    governorate: row.CITTTTY || '',
                    socialStatus: row.CI_PERSONAL_CD || ''
                };
            });
            res.json({ found: true, results });
        } else {
            res.json({ found: false, results: [] });
        }
    });
});

app.post('/api/addCitizen', (req, res) => {
    const { id, first, second, third, family, dob, gender, governorate } = req.body;
    if (!id) return res.json({ error: true, message: 'ID is required' });
    const query = `INSERT INTO persons (CI_ID_NUM, CI_FIRST_ARB, CI_FATHER_ARB, CI_GRAND_FATHER_ARB, CI_FAMILY_ARB, CI_BIRTH_DT, CI_SEX_CD, CITTTTY)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [id, first, second, third, family, dob, gender === 'Male' ? 'ذكر' : 'أنثى', governorate];
    db.run(query, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.json({ error: true, message: 'Citizen already exists' });
            return res.json({ error: true, message: err.message });
        }
        res.json({ success: true, message: 'Citizen added successfully' });
    });
});

app.post('/api/editCitizen', (req, res) => {
    const { id, first, second, third, family, dob, gender, governorate } = req.body;
    if (!id) return res.json({ error: true, message: 'ID is required' });
    const query = `UPDATE persons SET CI_FIRST_ARB=?, CI_FATHER_ARB=?, CI_GRAND_FATHER_ARB=?, CI_FAMILY_ARB=?, CI_BIRTH_DT=?, CI_SEX_CD=?, CITTTTY=?
                   WHERE CI_ID_NUM=?`;
    const params = [first, second, third, family, dob, gender === 'Male' ? 'ذكر' : 'أنثى', governorate, id];
    db.run(query, params, function (err) {
        if (err) return res.json({ error: true, message: err.message });
        res.json({ success: true, message: 'Citizen updated successfully' });
    });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Civil Registry server running on http://localhost:${PORT}`));
