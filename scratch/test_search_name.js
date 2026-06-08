const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./citizenDB.db');

db.all("SELECT id, fullName, idNumber, visitDate FROM local_visits WHERE fullName LIKE '%إيمان%' LIMIT 10", [], (err, rows) => {
  if (err) console.error(err);
  else console.log('Rows:', rows);
  db.close();
});
