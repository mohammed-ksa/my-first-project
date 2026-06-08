const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./citizenDB.db');

db.all("PRAGMA index_list('persons')", (err, rows) => {
  if (err) console.error(err);
  else console.log('Indexes on persons:', rows);
});

db.all("PRAGMA table_info('persons')", (err, rows) => {
  if (err) console.error(err);
  else console.log('Table Schema of persons:', rows);
});

db.get("SELECT COUNT(*) as count FROM persons", (err, row) => {
  if (err) console.error(err);
  else console.log('Total Rows in persons:', row.count);
});

db.close();
