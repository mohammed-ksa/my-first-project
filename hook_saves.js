const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\TOP\\Desktop\\IMS\\app.js', 'utf8');

const doSaveStr = `      V.push({ id: Date.now(), idNumber: id, fullName: nm, visitDate: vd, lastVisitDate: "", dob, age, ageGroup: ag, gender: F.gender, genderN: F.gender === "Male" ? "male" : "female", phone: $("fPh").value, governorate: $("fG").value, socialStatus: $("fSo").value, disability: F.disability, disabilityType: dt, displacement: F.displacement, fmService: F.fmService, srhService: F.srhService, woundCare: F.woundCare, breastCancer: F.breastCancer, malnutrition: F.malnutrition, referral: $("fRef").value, followUpDate: $("fFU").value });
      persist();`;

const doSaveNew = `      V.push({ id: Date.now(), idNumber: id, fullName: nm, visitDate: vd, lastVisitDate: "", dob, age, ageGroup: ag, gender: F.gender, genderN: F.gender === "Male" ? "male" : "female", phone: $("fPh").value, governorate: $("fG").value, socialStatus: $("fSo").value, disability: F.disability, disabilityType: dt, displacement: F.displacement, fmService: F.fmService, srhService: F.srhService, woundCare: F.woundCare, breastCancer: F.breastCancer, malnutrition: F.malnutrition, referral: $("fRef").value, followUpDate: $("fFU").value });
      persist();
      try {
          let names = nm.split(' ');
          let first = names[0] || '';
          let second = names[1] || '';
          let third = names[2] || '';
          let family = names.length > 3 ? names.slice(3).join(' ') : (names[3] || '');
          
          fetch("http://localhost:3000/api/addCitizen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: id, first: first, second: second, third: third, family: family, dob: dob, gender: F.gender, governorate: $("fG").value })
          }).catch(e => console.error(e));
      } catch(e) {}`;

code = code.replace(doSaveStr, doSaveNew);

const svEStr = `      const id = V[i].idNumber; if (P[id]) Object.assign(P[id], { fullName: V[i].fullName, gender: V[i].gender, phone: V[i].phone, governorate: V[i].governorate, dob });
      persist();`;

const svENew = `      const id = V[i].idNumber; if (P[id]) Object.assign(P[id], { fullName: V[i].fullName, gender: V[i].gender, phone: V[i].phone, governorate: V[i].governorate, dob });
      persist();
      try {
          let names = V[i].fullName.split(' ');
          let first = names[0] || '';
          let second = names[1] || '';
          let third = names[2] || '';
          let family = names.length > 3 ? names.slice(3).join(' ') : (names[3] || '');
          fetch("http://localhost:3000/api/editCitizen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: id, first: first, second: second, third: third, family: family, dob: dob, gender: V[i].gender, governorate: V[i].governorate })
          }).catch(e => console.error(e));
      } catch(e) {}`;

code = code.replace(svEStr, svENew);

fs.writeFileSync('c:\\Users\\TOP\\Desktop\\IMS\\app.js', code, 'utf8');
console.log('Hooked into doSave and svE.');
