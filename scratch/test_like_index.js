const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./citizenDB.db');

console.time('SearchSpeedPrefix');
const query = "SELECT CI_ID_NUM, CI_FIRST_ARB FROM persons WHERE REPLACE(REPLACE(REPLACE(REPLACE(CI_FIRST_ARB, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه') LIKE ? LIMIT 10";
db.all(query, ['احمد%'], (err, rows) => {
  if (err) console.error(err);
  else console.log('Found rows:', rows.length);
  console.timeEnd('SearchSpeedPrefix');
  db.close();
});
