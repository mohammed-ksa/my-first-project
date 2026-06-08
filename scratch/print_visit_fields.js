const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./database_nuseirat.json', 'utf8'));
const visit = data.visits.find(v => v.id === 1780828379731);
console.log('Visit fields:', visit);
