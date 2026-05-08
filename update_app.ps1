$content = Get-Content -Path "c:\Users\TOP\Desktop\IMS\app.js" -Raw -Encoding UTF8
$pattern = '(?s)function searchCivilRegistry\(\) \{.*?\}(?=\s*//|function|window\.receiveCitizenData)'
$newFunc = '    function searchCivilRegistryAdvanced() {
        var idN = $("adv_id").value.trim();
        var first = $("adv_first").value.trim();
        var second = $("adv_second").value.trim();
        var third = $("adv_third").value.trim();
        var family = $("adv_family").value.trim();
        
        if(!idN && !first && !second && !third && !family) { 
            fl("يرجى إدخال أي من معايير البحث", "err"); 
            return; 
        }
        
        fl("جاري البحث في السجل المدني...", "ok");
        fetch("http://localhost:3000/api/searchAdvanced", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: idN, first: first, second: second, third: third, family: family })
        })
        .then(response => response.json())
        .then(data => {
            window.receiveCivilRegistryResults(data);
        })
        .catch(err => {
            fl("تعذر الاتصال بالسيرفر المحلي", "err");
        });
    }

    function searchCivilRegistry() {
        var idN = $("idI").value.trim();
        if(!idN) { fl("يرجى إدخال رقم الهوية للبحث في السجل المدني", "err"); return; }
        $("adv_id").value = idN;
        searchCivilRegistryAdvanced();
    }'
$content = [regex]::Replace($content, $pattern, $newFunc)

$receivePattern = '(?s)window\.receiveCitizenData = function\(data\) \{.*?\}'
$newReceive = 'window.receiveCivilRegistryResults = function(data) {
        if (data.error) { fl("خطأ: " + data.message, "err"); return; }
        var container = $("cr_results_container");
        if(!container) return;
        
        if (data.found && data.results && data.results.length > 0) {
            fl("تم العثور على " + data.results.length + " سجلات", "ok");
            var html = "";
            data.results.forEach((r, idx) => {
                var genderAr = r.gender === "Male" ? "ذكر" : (r.gender === "Female" ? "أنثى" : r.gender);
                var jStr = JSON.stringify(r).replace(/"/g, "&quot;");
                html += `
                <div class="rc" style="margin-top:10px; border: 2px solid var(--p); padding:10px;">
                    <div class="rc-h">
                        <div class="rc-ti">#${idx+1} ${r.fullName}</div>
                        <div class="rc-dt">${r.id}</div>
                    </div>
                    <div class="rc-b">
                        <div>تاريخ الميلاد: ${r.dob}</div>
                        <div>الجنس: ${genderAr}</div>
                        <div>المحافظة: ${r.governorate}</div>
                    </div>
                    <div class="rc-f" style="display:flex; gap:10px; justify-content:flex-end;">
                        <button class="btn" style="background:var(--ok);color:#fff" onclick="fillFromCR(${jStr})"><i class="fa fa-plus"></i> إضافة للنموذج</button>
                        <button class="btn" style="background:var(--w);color:#fff"><i class="fa fa-edit"></i> تعديل</button>
                        <button class="btn" style="background:var(--e);color:#fff"><i class="fa fa-trash"></i> حذف</button>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = "<div style=`padding:10px;color:var(--e)`>لم يتم العثور على بيانات في السجل المدني</div>";
            fl("لم يتم العثور على سجلات", "err");
        }
    };

    window.fillFromCR = function(r) {
        if(r.id) $("idI").value = r.id;
        if(r.fullName) $("fN").value = r.fullName;
        if(r.dob) $("fDOB").value = r.dob;
        if(r.dob) calcAgeFromDOB();
        
        if (r.gender) {
            let btns = document.querySelectorAll("#gP .srb");
            btns.forEach(b => {
                let t = b.innerText.trim();
                if(t === "ذكر" && r.gender === "Male") b.click();
                if(t === "أنثى" && r.gender === "Female") b.click();
            });
        }
        
        if (r.governorate) {
            let gOptions = $("fG").options;
            for(let i=0; i<gOptions.length; i++) {
                if(gOptions[i].text.includes(r.governorate) || gOptions[i].value === r.governorate) {
                    $("fG").selectedIndex = i;
                    break;
                }
            }
        }
        
        // Social status mapping might need specific terms, but civil registry doesn`t give social status in current query.
        fl("تم ملء البيانات من السجل المدني بنجاح", "ok");
    };'
$content = [regex]::Replace($content, $receivePattern, $newReceive)

[System.IO.File]::WriteAllText("c:\Users\TOP\Desktop\IMS\app.js", $content, [System.Text.Encoding]::UTF8)
