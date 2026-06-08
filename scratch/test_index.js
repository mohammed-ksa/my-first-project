const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./citizenDB.db');

console.time('CreateIndex');
db.run("CREATE INDEX IF NOT EXISTS idx_persons_first_norm ON persons (REPLACE(REPLACE(REPLACE(REPLACE(CI_FIRST_ARB, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه'))", (err) => {
  if (err) console.error('Error creating index:', err);
  else console.log('Index created successfully!');
  console.timeEnd('CreateIndex');
  
  // Now test search speed
  console.time('SearchSpeed');
  const query = "SELECT CI_ID_NUM, CI_FIRST_ARB FROM persons WHERE REPLACE(REPLACE(REPLACE(REPLACE(CI_FIRST_ARB, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه') = 'احمد' LIMIT 10";
  db.all(query, [], (err, rows) => {
    if (err) console.error(err);
    else console.log('Found rows:', rows.length);
    console.timeEnd('SearchSpeed');
    db.close();
  });
});
