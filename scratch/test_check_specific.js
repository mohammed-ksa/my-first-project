const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./citizenDB.db');

db.all("SELECT * FROM local_visits WHERE idNumber = '407046002'", [], (err, rows) => {
  if (err) console.error(err);
  else console.log('Rows:', rows);
  db.close();
});
