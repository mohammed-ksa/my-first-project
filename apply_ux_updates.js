const fs = require('fs');

// 1. Update HTML
let html = fs.readFileSync('c:\\Users\\TOP\\Desktop\\IMS\\IMS_Medical_System_4.html', 'utf8');

// Update search button to a generic "Search" that handles everything
// And remove the two buttons inside advSearchPanel
const advSearchPanelPattern = /<!-- ADVANCED SEARCH PANEL -->[\s\S]*?<!-- END ADVANCED SEARCH -->/;
const newAdvSearchPanel = `<!-- ADVANCED SEARCH PANEL -->
      <div id="advSearchPanel" style="margin-top:15px; padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; border-top: 3px solid var(--p);">
        <div style="font-weight:bold; color:var(--p); margin-bottom:10px; display:flex; align-items:center; justify-content: space-between;">
            <div style="display:flex; align-items:center; gap:5px;">
                <i class="fa fa-search"></i> خيارات البحث الشامل
            </div>
            <button onclick="clearSearch()" style="background:var(--rl); color:var(--r); border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">&times;</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">الاسم الأول</label>
                <input id="adv_first" type="text" placeholder="الاسم الأول..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') doSearch()">
            </div>
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">اسم الأب</label>
                <input id="adv_second" type="text" placeholder="اسم الأب..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') doSearch()">
            </div>
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">اسم الجد</label>
                <input id="adv_third" type="text" placeholder="اسم الجد..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') doSearch()">
            </div>
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">اسم العائلة</label>
                <input id="adv_family" type="text" placeholder="اسم العائلة..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') doSearch()">
            </div>
        </div>
        
        <!-- RESULTS CONTAINER -->
        <div id="cr_results_container" style="display:none; margin-top:15px; border-top:1px solid #e2e8f0; padding-top:15px;">
        </div>
      </div>
      <!-- END ADVANCED SEARCH -->`;

html = html.replace(advSearchPanelPattern, newAdvSearchPanel);

// Update the main lookup button to call the unified doSearch
html = html.replace('onclick="searchCivilRegistry()"', 'onclick="doSearch()"');

fs.writeFileSync('c:\\Users\\TOP\\Desktop\\IMS\\IMS_Medical_System_4.html', html, 'utf8');


// 2. Update app.js
let code = fs.readFileSync('c:\\Users\\TOP\\Desktop\\IMS\\app.js', 'utf8');

const newLogic = `
    window.clearSearch = function() {
        if($("adv_id")) $("adv_id").value = "";
        if($("adv_first")) $("adv_first").value = "";
        if($("adv_second")) $("adv_second").value = "";
        if($("adv_third")) $("adv_third").value = "";
        if($("adv_family")) $("adv_family").value = "";
        if($("idI")) $("idI").value = "";
        var container = $("cr_results_container");
        if(container) {
            container.innerHTML = "";
            container.style.display = "none";
        }
        fl("تم مسح البحث", "ok");
    }

    window.doSearch = function() {
        var idN = ($("adv_id") && $("adv_id").value.trim()) || ($("idI") && $("idI").value.trim()) || "";
        var first = $("adv_first") ? $("adv_first").value.trim() : "";
        var second = $("adv_second") ? $("adv_second").value.trim() : "";
        var third = $("adv_third") ? $("adv_third").value.trim() : "";
        var family = $("adv_family") ? $("adv_family").value.trim() : "";
        
        if(!idN && !first && !second && !third && !family) { 
            fl("يرجى إدخال أي من معايير البحث", "err"); 
            return; 
        }

        fl("جاري البحث...", "ok");
        fetch("http://localhost:3000/api/searchAdvanced", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: idN, first: first, second: second, third: third, family: family })
        })
        .then(response => response.json())
        .then(data => {
            window.renderSearchResults(data.results || [], 'cr');
        })
        .catch(err => {
            // If API fails, try local fallback
            let results = [];
            let searchStr = (first + " " + second + " " + third + " " + family).trim().toLowerCase();
            INIT_PATIENTS.forEach(p => {
                let match = true;
                if (idN && !p.id.includes(idN)) match = false;
                if (first && !p.name.toLowerCase().includes(first.toLowerCase())) match = false;
                if (second && !p.name.toLowerCase().includes(second.toLowerCase())) match = false;
                if (third && !p.name.toLowerCase().includes(third.toLowerCase())) match = false;
                if (family && !p.name.toLowerCase().includes(family.toLowerCase())) match = false;
                if(match) results.push(p);
            });
            window.renderSearchResults(results, 'local');
        });
    }

    window.renderSearchResults = function(results, source) {
        var container = $("cr_results_container");
        if(!container) return;
        
        if (results && results.length > 0) {
            fl("تم العثور على " + results.length + " سجلات", "ok");
            var html = "";
            results.forEach((r, idx) => {
                var genderAr = r.gender === "Male" ? "ذكر" : (r.gender === "Female" ? "أنثى" : r.gender);
                var fullName = r.fullName || r.name;
                var dob = r.dob || '';
                var id = r.id;
                var gov = r.governorate || r.gov || '';
                var jStr = JSON.stringify(r).replace(/"/g, "&quot;");
                
                // UNIFIED DESIGN matching Records Card (.rc)
                html += '<div class="rc">' +
                    '<div class="rt">' +
                        '<div>' +
                            '<div class="rn">' + fullName + '</div>' +
                            '<div class="ri">' + id + ' | ' + (source==='cr'?'السجل المدني':'النظام المحلي') + '</div>' +
                        '</div>' +
                        '<div class="rd">' + dob + '</div>' +
                    '</div>' +
                    '<div class="rts">' +
                        '<span class="tg tb">' + genderAr + '</span>' +
                        '<span class="tg tgg">' + gov + '</span>' +
                    '</div>' +
                    '<div class="rc-act">' +
                        '<button class="rbtn rbtn-e" style="background:var(--gl); color:var(--g);" onclick="addVisitAction(' + jStr + ')"><i class="fa fa-plus"></i> + زيارة</button>' +
                        '<button class="rbtn rbtn-e" onclick="editAction(' + jStr + ', \\'' + source + '\\')"><i class="fa fa-edit"></i> تعديل</button>' +
                    '</div>' +
                '</div>';
            });
            container.innerHTML = html;
            container.style.display = 'block';
        } else {
            container.innerHTML = "<div style='padding:15px; color:var(--s); text-align:center; font-size:13px;'>لم يتم العثور على نتائج مطابقة</div>";
            container.style.display = 'block';
            fl("لم يتم العثور على سجلات", "err");
        }
    };

    window.addVisitAction = function(r) {
        // 1. Hide search panel
        if($("advSearchPanel")) $("advSearchPanel").style.display = "none";
        
        // 2. Fill form
        if(r.id) $("idI").value = r.id;
        if(r.fullName || r.name) $("fN").value = (r.fullName || r.name);
        if(r.dob) { $("fDOB").value = r.dob; calcAgeFromDOB(); }
        
        let targetGender = r.gender === "Male" || r.gender === "ذكر" ? "Male" : "Female";
        let btns = document.querySelectorAll("#gP .srb");
        btns.forEach(b => {
            let t = b.innerText.trim();
            b.classList.remove('active'); 
            if(t === "ذكر" && targetGender === "Male") b.click();
            if(t === "أنثى" && targetGender === "Female") b.click();
        });
        
        let gov = r.governorate || r.gov;
        if (gov) {
            let gOptions = $("fG").options;
            for(let i=0; i<gOptions.length; i++) {
                if(gOptions[i].text.includes(gov) || gOptions[i].value === gov) {
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
                if(t === r.socialStatus || v === r.socialStatus || t.includes(r.socialStatus)) {
                    $("fSo").selectedIndex = i;
                    break;
                }
            }
        }
        
        // 3. Switch to entry tab
        sw("entry");
        fl("تم تعبئة بيانات المريض بنجاح", "ok");
    };

    window.editAction = function(r, source) {
        window.addVisitAction(r);
        window.isEditingCitizen = true;
        fl("جاري التعديل على بيانات المواطن", "ok");
    };
`;

// Replace the old block we added with the new logic
const oldLogicPattern = /window\.doSearch = function\(type\) \{[\s\S]*?window\.isEditingCitizen = true;\s*\n    \};/;
code = code.replace(oldLogicPattern, newLogic);

fs.writeFileSync('c:\\Users\\TOP\\Desktop\\IMS\\app.js', code, 'utf8');
console.log('UX Updates applied successfully.');
