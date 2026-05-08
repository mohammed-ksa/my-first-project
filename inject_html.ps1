$htmlPath = "c:\Users\TOP\Desktop\IMS\IMS_Medical_System_4.html"
$html = Get-Content -Path $htmlPath -Raw -Encoding UTF8

$searchBox = @"
      </div>
      
      <!-- ADVANCED SEARCH PANEL -->
      <div id="advSearchPanel" style="margin-top:15px; padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; border-top: 3px solid var(--p);">
        <div style="font-weight:bold; color:var(--p); margin-bottom:10px; display:flex; align-items:center; gap:5px;">
            <i class="fa fa-search"></i> خيارات بحث السجل المدني
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">رقم الهوية</label>
                <input id="adv_id" type="text" placeholder="رقم الهوية..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') searchCivilRegistryAdvanced()">
            </div>
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">الاسم الأول</label>
                <input id="adv_first" type="text" placeholder="الاسم الأول..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') searchCivilRegistryAdvanced()">
            </div>
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">اسم الأب</label>
                <input id="adv_second" type="text" placeholder="اسم الأب..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') searchCivilRegistryAdvanced()">
            </div>
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">اسم الجد</label>
                <input id="adv_third" type="text" placeholder="اسم الجد..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') searchCivilRegistryAdvanced()">
            </div>
            <div>
                <label style="font-size:12px;color:#64748b;margin-bottom:3px;display:block">اسم العائلة</label>
                <input id="adv_family" type="text" placeholder="اسم العائلة..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') searchCivilRegistryAdvanced()">
            </div>
        </div>
        <div style="margin-top:15px; text-align:left;">
            <button class="btn" style="background:var(--p); color:white; padding:8px 20px;" onclick="searchCivilRegistryAdvanced()">
                <i class="fa fa-search"></i> بحث في السجل
            </button>
        </div>
        
        <!-- RESULTS CONTAINER -->
        <div id="cr_results_container" style="display:none; margin-top:15px; max-height:400px; overflow-y:auto; border-top:1px solid #e2e8f0; padding-top:15px;">
        </div>
      </div>
      <!-- END ADVANCED SEARCH -->
"@

$html = $html -replace '</div>\s*<div id="bF" class="bn ok hidden"></div>', "$searchBox`n      <div id=`"bF`" class=`"bn ok hidden`"></div>"
[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)
