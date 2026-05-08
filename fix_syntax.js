const fs = require('fs');
let html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');

html = html.replace(/\+\)<\/div><\/div>';sh\(\$\("bW"\)\)/, `+')</div></div>';sh($("bW"))`);

fs.writeFileSync('IMS_Medical_System_4.html', html, 'utf8');
console.log("Syntax Fixed");
