const fs = require('fs');
const xlsx = require('xlsx');

function aG(a){if(a==null)return'';if(a<=5)return'0-5';if(a<=18)return'6-18';if(a<=60)return'19-60';return'+60';}
function fmD(v){if(!v)return'';if(v instanceof Date)return v.toISOString().split('T')[0];if(typeof v==='number')return new Date((v-25569)*864e5).toISOString().split('T')[0];let s=String(v).trim();return s.length>=10&&s.includes('-')?s.substring(0,10):'';}

const wb = xlsx.readFile('IMS- Service Delivery Points.xlsx', {cellDates: true});
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = xlsx.utils.sheet_to_json(ws, {header: 1, defval: ''});

let hI = -1;
for(let i=0; i<Math.min(15, raw.length); i++){
    if(raw[i] && raw[i].some(c => String(c).includes('Full Name') || String(c).includes('ط§ظ„ط¥ط³ظ… ط§ظ„ظƒط§ظ…ظ„') || String(c).includes('الإسم الكامل'))){
        hI = i; break;
    }
}
console.log('Header Index:', hI);
if(hI !== -1) {
    let P = {};
    let V = [];
    let dup=0, imp=0;
    const ek=new Set();
    
    for(let i=hI+1; i<raw.length; i++){
        const r = raw[i];
        const nm = String(r[1]||'').trim();
        let idN = '';
        try { idN = String(parseInt(parseFloat(r[4]))); } catch(e){}
        if(!nm || !idN || idN === 'NaN') continue;
        
        const vD = fmD(r[2]);
        if(ek.has(idN+'|'+vD)){ dup++; continue; }
        ek.add(idN+'|'+vD);
        
        const dob = fmD(r[5]);
        let age = null;
        try { age = parseInt(parseFloat(r[6])); if(isNaN(age)) age = null; } catch(e){}
        
        const g = String(r[8]||'').trim().replace(/\s/g,'');
        const gen = (g==='ط£ظ†ط«ظ‰'||g==='ط§ظ†ط«ظ‰'||g==='أنثى'||g==='انثى')?'انثى':(g==='ط°ظƒط±'||g==='ذكر'?'ذكر':g);
        
        let ph = '';
        try { ph = String(parseInt(parseFloat(r[10]))); if(ph === 'NaN') ph = ''; } catch(e){}
        
        const gov = String(r[11]||'').trim();
        let soc = String(r[12]||'').trim();
        if (soc === 'N/A') soc = '';
        
        let dis = String(r[13]||'').trim();
        dis = (dis==='ظ„ط§'||dis==='No'||dis==='no'||dis==='لا')?'No':(dis==='ظ†ط¹ظ…'||dis==='Yes'||dis==='yes'||dis==='نعم')?'Yes':dis;
        const disT = String(r[14]||'').trim();
        
        let disp = String(r[15]||'').trim();
        disp = (disp==='Displaced'||disp==='ظ†ط§ط²ط­'||disp==='نازح')?'نازح':(disp==='Host Community'||disp==='مقيم'||disp==='ظ…ظ‚ظٹظ…'?'مقيم':(disp||'نازح'));
        
        const fm = String(r[16]||'').trim();
        const srh = String(r[17]||'').trim();
        const wc = String(r[18]||'').trim();
        const bc = String(r[19]||'').trim();
        const mal = String(r[20]||'').trim();
        const ref = String(r[21]||'').trim();
        const fu = fmD(r[22]);
        
        if(!P[idN]){
            P[idN] = {fullName:nm, dob, gender:gen, phone:ph, governorate:gov, socialStatus:soc, disability:dis, disabilityType:disT, displacement:disp, lastVisitDate:vD};
        }
        
        V.push({id: Date.now()+i, idNumber:idN, fullName:nm, visitDate:vD, lastVisitDate:'', dob, age, ageGroup:aG(age), gender:gen, genderN:gen==='ذكر'?'male':'female', phone:ph, governorate:gov, socialStatus:soc, disability:dis, disabilityType:disT, displacement:disp, fmService:fm, srhService:srh, woundCare:wc, breastCancer:bc, malnutrition:mal, referral:ref, followUpDate:fu});
        imp++;
    }
    console.log('Imported:', imp, 'Dup:', dup);
    console.log('Total Patients:', Object.keys(P).length);
    
    // Now read the original HTML and replace
    let html = fs.readFileSync('IMS_Medical_System_4.html', 'utf8');
    html = html.replace(/var INIT_PATIENTS\s*=\s*\{.*?\};/s, 'var INIT_PATIENTS = ' + JSON.stringify(P) + ';');
    html = html.replace(/var INIT_VISITS\s*=\s*\[.*?\];/s, 'var INIT_VISITS = ' + JSON.stringify(V) + ';');
    
    // Update GOV and SOC
    html = html.replace(/const GOV=\[.*?\];/, 'const GOV=["Alnussirat","Alburaij","Alzawida","Almaghazi","Dier Albalah","Gaza City"];');
    html = html.replace(/const SOC=\[.*?\];/, 'const SOC=["Single","Married","Divorced","Widowed"];');
    
    // Also we need to fix autoSocial
    let autoSocialFix = `function autoSocial(gender,age){
if(age==null||age==="")return"";
if(age<16)return"Single";if(age<=25)return"Single";if(age<=60)return"Married";if(age>70)return"Widowed";return"Married";
}`;
    html = html.replace(/function autoSocial\(gender,age\)\{.*?\nreturn""\}/s, autoSocialFix);
    
    fs.writeFileSync('IMS_Medical_System_4.html', html, 'utf8');
    console.log('Successfully updated IMS_Medical_System_4.html');
}
