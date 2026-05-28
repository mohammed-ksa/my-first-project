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
    if (err) console.error('Error connecting to database:', err.message);
    else console.log('✅ Connected to the Civil Registry database.');
});

// ═══ Medical Data APIs (database.json) ═══
const DB_PATH = path.join(__dirname, 'database.json');

app.get('/api/data', (req, res) => {
    fs.readFile(DB_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading database.json:', err);
            return res.json({ patients: {}, visits: [] });
        }
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            console.error('Error parsing database.json:', e);
            res.json({ patients: {}, visits: [] });
        }
    });
});

app.post('/api/save', (req, res) => {
    const incoming = req.body || {};
    const incomingPatients = incoming.patients || {};
    const incomingVisits = Array.isArray(incoming.visits) ? incoming.visits : [];

    // Read current file to merge (protect imported data from being overwritten)
    let diskPatients = {};
    let diskVisits = [];
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            diskPatients = (parsed.patients && typeof parsed.patients === 'object' && !Array.isArray(parsed.patients)) ? parsed.patients : {};
            diskVisits = Array.isArray(parsed.visits) ? parsed.visits : [];
        }
    } catch (e) {
        console.warn('Could not read existing database.json for merge:', e.message);
    }

    // Merge patients: incoming updates overwrite disk, but disk patients not in incoming are kept
    const mergedPatients = { ...diskPatients, ...incomingPatients };

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

    const mergedDb = {
        patients: mergedPatients,
        visits: mergedVisits,
        mf_patients: incoming.mf_patients || {},
        mf_visits: incoming.mf_visits || []
    };

    const data = JSON.stringify(mergedDb, null, 2);
    fs.writeFile(DB_PATH, data, 'utf8', (err) => {
        if (err) {
            console.error('Error writing to database.json:', err);
            return res.status(500).json({ error: true, message: 'Failed to save data' });
        }
        console.log(`[save] Merged: ${Object.keys(mergedPatients).length} patients, ${mergedVisits.length} visits`);
        // Return merged data so browser syncs to the complete dataset
        res.json({ success: true, dbData: mergedDb });
    });
});

app.post('/api/deleteData', (req, res) => {
    const { patientId, visitId } = req.body;
    try {
        let diskPatients = {};
        let diskVisits = [];
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            diskPatients = (parsed.patients && typeof parsed.patients === 'object' && !Array.isArray(parsed.patients)) ? parsed.patients : {};
            diskVisits = Array.isArray(parsed.visits) ? parsed.visits : [];
            
            if (patientId) {
                delete diskPatients[patientId];
                diskVisits = diskVisits.filter(v => String(v.idNumber) !== String(patientId));
                console.log(`[delete] Removed patient ${patientId} and their visits`);
            }
            if (visitId) {
                diskVisits = diskVisits.filter(v => String(v.id) !== String(visitId));
                console.log(`[delete] Removed visit ${visitId}`);
            }
            
            const mergedDb = {
                patients: diskPatients,
                visits: diskVisits,
                mf_patients: parsed.mf_patients || {},
                mf_visits: parsed.mf_visits || []
            };
            
            fs.writeFile(DB_PATH, JSON.stringify(mergedDb, null, 2), 'utf8', (err) => {
                if (err) return res.status(500).json({ error: true, message: 'Failed to delete' });
                res.json({ success: true, dbData: mergedDb });
            });
        } else {
            res.json({ success: true });
        }
    } catch (e) {
        console.error('Delete error:', e);
        res.status(500).json({ error: true, message: e.message });
    }
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

    // ID search: numeric, no normalization needed
    if (id && id.trim()) {
        conditions.push('CAST(CI_ID_NUM AS TEXT) LIKE ?');
        params.push(`%${id.trim()}%`);
    }
    // Name searches: normalize both column value and search term
    if (first && first.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_FIRST_ARB')} LIKE ?`);
        params.push(`%${normalizeArabic(first.trim())}%`);
    }
    if (second && second.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_FATHER_ARB')} LIKE ?`);
        params.push(`%${normalizeArabic(second.trim())}%`);
    }
    if (third && third.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_GRAND_FATHER_ARB')} LIKE ?`);
        params.push(`%${normalizeArabic(third.trim())}%`);
    }
    if (family && family.trim()) {
        conditions.push(`${sqlNormalizeCol('CI_FAMILY_ARB')} LIKE ?`);
        params.push(`%${normalizeArabic(family.trim())}%`);
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
