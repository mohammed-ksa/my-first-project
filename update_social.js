const fs = require('fs');
let content = fs.readFileSync('c:\\Users\\TOP\\Desktop\\IMS\\app.js', 'utf8');

const targetStr = `        if (r.governorate) {
            let gOptions = $("fG").options;
            for(let i=0; i<gOptions.length; i++) {
                if(gOptions[i].text.includes(r.governorate) || gOptions[i].value === r.governorate) {
                    $("fG").selectedIndex = i;
                    break;
                }
            }
        }`;

const replacementStr = `        if (r.governorate) {
            let gOptions = $("fG").options;
            for(let i=0; i<gOptions.length; i++) {
                if(gOptions[i].text.includes(r.governorate) || gOptions[i].value === r.governorate) {
                    $("fG").selectedIndex = i;
                    break;
                }
            }
        }
        
        if (r.socialStatus) {
            let sOptions = $("fSo").options;
            for(let i=0; i<sOptions.length; i++) {
                let t = sOptions[i].text.trim();
                let v = sOptions[i].value;
                if(t === r.socialStatus || v === r.socialStatus || t.includes(r.socialStatus) || r.socialStatus.includes(t)) {
                    $("fSo").selectedIndex = i;
                    break;
                }
            }
        }`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('c:\\Users\\TOP\\Desktop\\IMS\\app.js', content, 'utf8');
console.log('Updated social status mapping.');
