const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./citizenDB.db');

db.all("SELECT id, fullName, idNumber, phone, pointId FROM local_visits LIMIT 5", [], (err, rows) => {
  if (err) console.error(err);
  else console.log('Rows:', rows);
  db.close();
});
