const fs = require('fs');
let html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');

html = html.replace(/const DB_NAME="IMS_DB",DB_VER=1;/, 'const DB_NAME="IMS_DB_V2",DB_VER=1;');

fs.writeFileSync('IMS_Medical_System_4.html', html, 'utf8');
console.log("DB_NAME updated successfully");
