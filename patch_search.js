// Script to patch app.js search functions (lines 417-594)
const fs = require('fs');
const path = require('path');

const appFile = path.join(__dirname, 'app.js');
let content = fs.readFileSync(appFile, 'utf8');
let lines = content.split('\n');

// Find the line that starts the search block
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function searchCivilRegistryAdvanced()') && startIdx === -1) {
        startIdx = i;
    }
    if (startIdx > -1 && lines[i].includes("function addVisitFrom(idN)")) {
        endIdx = i;
        break;
    }
}

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find search block boundaries!');
    console.log('startIdx:', startIdx, 'endIdx:', endIdx);
    process.exit(1);
}

console.log(`Found search block: lines ${startIdx + 1} to ${endIdx} (0-indexed: ${startIdx}-${endIdx - 1})`);

const newSearchCode = `    // ═══ CIVIL REGISTRY SEARCH ═══
    window.searchCivilRegistryAdvanced = function() {
        var idN = $("idI").value.trim();
        var first = $("adv_first") ? $("adv_first").value.trim() : "";
        var second = $("adv_second") ? $("adv_second").value.trim() : "";
        var third = $("adv_third") ? $("adv_third").value.trim() : "";
        var family = $("adv_family") ? $("adv_family").value.trim() : "";
        
        if(!idN && !first && !second && !third && !family) { 
            fl("يرجى إدخال رقم الهوية أو أي من حقول الاسم للبحث", "err"); 
            return; 
        }
        
        console.log('[doSearch] Sending:', { id: idN, first, second, third, family });
        fl("جاري البحث في السجل المدني...", "ok");
        
        var serverUrl = window.location.origin + '/api/searchAdvanced';
        
        fetch(serverUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: idN, first: first, second: second, third: third, family: family })
        })
        .then(function(response) {
            console.log('[doSearch] Status:', response.status);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(data) {
            console.log('[doSearch] Data:', data);
            window.receiveCivilRegistryResults(data);
        })
        .catch(function(err) {
            console.error('[doSearch] Error:', err);
            fl("تعذر الاتصال بالسيرفر: " + err.message, "err");
        });
    };

    window.doSearch = function() {
        console.log('[doSearch] Button clicked');
        window.searchCivilRegistryAdvanced();
    };

    window.clearSearch = function() {
        $("idI").value = "";
        $("idI").disabled = false;
        updateIDProg($("idI"));
        if($("adv_first")) $("adv_first").value = "";
        if($("adv_second")) $("adv_second").value = "";
        if($("adv_third")) $("adv_third").value = "";
        if($("adv_family")) $("adv_family").value = "";
        var container = $("cr_results_container");
        if(container) { container.innerHTML = ""; container.style.display = 'none'; }
        hi($("bF")); hi($("bN")); hi($("bW")); hi($("fS"));
        sh($("idSB")); hi($("idCB"));
        fl("تم مسح جميع حقول البحث", "ok");
    };

    window.receiveCivilRegistryResults = function(data) {
        console.log('[results] Data:', data);
        if (data.error) { fl("خطأ: " + data.message, "err"); return; }
        var container = $("cr_results_container");
        if(!container) { console.error('Container not found!'); return; }
        
        if (data.found && data.results && data.results.length > 0) {
            fl("تم العثور على " + data.results.length + " نتيجة", "ok");
            var html = '<div style="font-weight:700;color:var(--p);margin-bottom:10px;font-size:14px">📋 نتائج البحث (' + data.results.length + ')</div>';
            data.results.forEach(function(r, idx) {
                var genderAr = r.gender === "Male" ? "ذكر" : (r.gender === "Female" ? "أنثى" : (r.gender || "—"));
                var safeId = (r.id || '').toString().replace(/'/g, "\\\\'");
                var safeName = (r.fullName || '').replace(/'/g, "\\\\'");
                var safeDob = (r.dob || '').replace(/'/g, "\\\\'");
                var safeGender = (r.gender || '').replace(/'/g, "\\\\'");
                var safeGov = (r.governorate || '').replace(/'/g, "\\\\'");
                var safeSoc = (r.socialStatus || '').replace(/'/g, "\\\\'");
                
                html += '<div class="rc" style="margin:8px 0; border-right:4px solid var(--p); padding:12px 16px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
                        '<div>' +
                            '<div style="font-size:15px;font-weight:700">' + 
                                '<span style="background:var(--p);color:#fff;padding:1px 8px;border-radius:6px;font-size:11px;margin-left:6px">#' + (idx+1) + '</span> ' + 
                                (r.fullName || '—') + 
                            '</div>' +
                            '<div style="font-size:12px;color:var(--s);margin-top:3px">🆔 ' + (r.id || '—') + '</div>' +
                        '</div>' +
                        '<span style="font-size:10px;background:var(--pl);color:var(--p);padding:2px 8px;border-radius:10px;font-weight:600">سجل مدني</span>' +
                    '</div>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:10px 0;font-size:13px;color:var(--t)">' +
                        '<div>📅 <strong>الميلاد:</strong> ' + (r.dob || '—') + '</div>' +
                        '<div>👤 <strong>الجنس:</strong> ' + genderAr + '</div>' +
                        '<div>📍 <strong>المحافظة:</strong> ' + (r.governorate || '—') + '</div>' +
                        (r.socialStatus ? '<div>💍 <strong>الحالة:</strong> ' + r.socialStatus + '</div>' : '') +
                    '</div>' +
                    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
                        '<button class="rbtn" style="background:var(--gl);color:var(--g);padding:6px 16px;font-size:12px" ' +
                            "onclick=\\"fillFromCR({id:'" + safeId + "',fullName:'" + safeName + "',dob:'" + safeDob + "',gender:'" + safeGender + "',governorate:'" + safeGov + "',socialStatus:'" + safeSoc + "'})\\">➕ إضافة زيارة</button>" +
                        '<button class="rbtn rbtn-e" style="padding:6px 16px;font-size:12px" ' +
                            "onclick=\\"editCivilRecord('" + safeId + "')\\">✏️ تعديل</button>" +
                    '</div>' +
                '</div>';
            });
            container.innerHTML = html;
            container.style.display = 'block';
        } else {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--s)"><div style="font-size:40px;opacity:.3;margin-bottom:8px">🔍</div>لم يتم العثور على بيانات مطابقة في السجل المدني</div>';
            container.style.display = 'block';
            fl("لم يتم العثور على سجلات مطابقة", "err");
        }
    };

    window.editCivilRecord = function(id) {
        fl("جاري تحميل بيانات السجل للتعديل...", "ok");
        fetch(window.location.origin + '/api/searchAdvanced', {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.found && data.results && data.results.length > 0) {
                var rec = data.results[0];
                var newName = prompt("تعديل الاسم الكامل:", rec.fullName);
                if (newName !== null && newName.trim()) {
                    var names = newName.trim().split(' ');
                    fetch(window.location.origin + '/api/editCitizen', {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: id, first: names[0]||'', second: names[1]||'', third: names[2]||'', family: names.slice(3).join(' ')||'', dob: rec.dob, gender: rec.gender, governorate: rec.governorate })
                    })
                    .then(function(r) { return r.json(); })
                    .then(function(res) {
                        if (res.success) { fl("✅ تم تحديث السجل بنجاح", "ok"); window.doSearch(); }
                        else fl("خطأ: " + (res.message || 'فشل التحديث'), "err");
                    })
                    .catch(function(e) { fl("خطأ في الاتصال", "err"); });
                }
            }
        })
        .catch(function(e) { fl("تعذر تحميل البيانات", "err"); });
    };

    window.fillFromCR = function(r) {
        console.log('[fillFromCR] Data:', r);
        if(r.id) { $("idI").value = r.id; $("idI").disabled = true; hi($("idSB")); sh($("idCB")); }
        if(r.fullName) $("fN").value = r.fullName;
        if(r.dob) { $("fDOB").value = r.dob; calcAgeFromDOB(); }
        
        if (r.gender) {
            var g = r.gender;
            if(g === "ذكر" || g === "Male") g = "Male"; 
            else if(g === "أنثى" || g === "انثى" || g === "Female") g = "Female";
            F.gender = g; bPgen();
        }
        
        if (r.governorate) {
            var govMap = { "النصيرات": "Alnussirat", "البريج": "Alburaij", "الزوايدة": "Alzawida", "المغازي": "Almaghazi", "دير البلح": "Dier Albalah", "غزة": "Gaza City", "مدينة غزة": "Gaza City", "خانيونس": "Khan Younis", "رفح": "Rafah", "شمال غزة": "North Gaza" };
            var gVal = govMap[r.governorate] || r.governorate;
            if (GOV.includes(gVal)) { $("fG").value = gVal; }
            else {
                var gOpts = $("fG").options;
                for(var i=0; i<gOpts.length; i++) {
                    if(gOpts[i].text.includes(r.governorate) || gOpts[i].value === gVal) { $("fG").selectedIndex = i; break; }
                }
            }
        }
        
        if (r.socialStatus) {
            var socMap = { "أعزب": "Single", "عزباء": "Single", "انسة": "Single", "أنسة": "Single", "متزوج": "Married", "متزوجة": "Married", "مطلق": "Divorced", "مطلقة": "Divorced", "أرمل": "Widowed", "أرملة": "Widowed" };
            var sVal = socMap[r.socialStatus] || r.socialStatus;
            if (SOC.includes(sVal)) { $("fSo").value = sVal; }
            else {
                var sOpts = $("fSo").options;
                for(var j=0; j<sOpts.length; j++) {
                    if(sOpts[j].text.trim() === r.socialStatus || sOpts[j].value === sVal) { $("fSo").selectedIndex = j; break; }
                }
            }
        }
        
        hi($("bN")); 
        $("bF").innerHTML = '✓ تم ملء البيانات من السجل المدني — <strong>' + (r.fullName || '') + '</strong><button class="bn-x" onclick="hi(this.parentElement)">✕</button>';
        sh($("bF"));
        sh($("fS"));
        fl("✅ تم ملء البيانات من السجل المدني بنجاح", "ok");
    };

`;

// Replace lines startIdx through endIdx-1 (exclusive of the addVisitFrom line)
const before = lines.slice(0, startIdx);
const after = lines.slice(endIdx);
const newLines = [...before, ...newSearchCode.split('\n'), ...after];

fs.writeFileSync(appFile, newLines.join('\n'), 'utf8');
console.log('✅ Successfully patched app.js!');
console.log(`   Replaced lines ${startIdx + 1} to ${endIdx} with new search code.`);
