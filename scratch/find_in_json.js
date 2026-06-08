const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./database_nuseirat.json', 'utf8'));
const matches = data.visits.filter(v => v.fullName && v.fullName.includes('إيمان عمر') || v.fullName && v.fullName.includes('ايمان عمر'));
console.log('Matches in JSON:', matches.map(v => ({ id: v.id, fullName: v.fullName, visitDate: v.visitDate })));
