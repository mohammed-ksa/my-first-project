const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./citizenDB.db');

const v = {
  id: 1780828379731,
  idNumber: '407046002',
  fullName: 'إيمان عمر خليل التتري',
  visitDate: '2026-06-07',
  gender: 'Female',
  age: 25,
  ageGroup: '19-60',
  phone: '0594117907',
  governorate: 'Alnussirat',
  displacement: 'Displaced',
  fmService: 'FM- CD',
  srhService: '',
  woundCare: '',
  breastCancer: '',
  malnutrition: '',
  referral: '',
  followUp: '',
  pointId: 'nuseirat'
};

db.run(`INSERT OR REPLACE INTO local_visits (
    id, idNumber, fullName, phone, visitDate, gender, age, ageGroup,
    governorate, displacement, socialStatus, disability, fmService,
    srhService, woundCare, breastCancer, malnutrition, referral, followUp, pointId
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    v.id, v.idNumber, v.fullName, v.phone, v.visitDate, v.gender, v.age, v.ageGroup,
    v.governorate, v.displacement, '', '', v.fmService, '', '', '', '', '', '', v.pointId
], (err) => {
    if (err) console.error('Error inserting:', err);
    else {
        console.log('Successfully inserted.');
        db.all("SELECT * FROM local_visits WHERE id = 1780828379731", [], (err2, rows) => {
            console.log('Row:', rows);
            db.close();
        });
    }
});
