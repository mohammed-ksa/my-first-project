/**
 * cr_search_module.js
 * وحدة بحث السجل المدني — IMS Medical System
 * تنفيذ جميع المتطلبات: تطبيع عربي، بطاقات نتائج، تعبئة تلقائية، مسح الحالة
 */

(function () {
    'use strict';

    // ═══ خريطة تحويل المحافظات (عربي → إنجليزي) ═══
    var GOV_MAP = {
        'النصيرات': 'Alnussirat',
        'نصيرات': 'Alnussirat',
        'البريج': 'Alburaij',
        'بريج': 'Alburaij',
        'الزوايدة': 'Alzawida',
        'زوايدة': 'Alzawida',
        'المغازي': 'Almaghazi',
        'مغازي': 'Almaghazi',
        'دير البلح': 'Dier Albalah',
        'دير بلح': 'Dier Albalah',
        'غزة': 'Gaza City',
        'مدينة غزة': 'Gaza City',
        'خان يونس': 'Khan Younis',
        'خانيونس': 'Khan Younis',
        'رفح': 'Rafah',
        'شمال غزة': 'North Gaza',
        'جباليا': 'Jabalia',
        'بيت لاهيا': 'Beit Lahiya',
        'بيت حانون': 'Beit Hanoun'
    };

    // ═══ خريطة تحويل الحالة الاجتماعية (عربي → إنجليزي) ═══
    var SOC_MAP = {
        'متزوج': 'Married',
        'متزوجة': 'Married',
        'أعزب': 'Single',
        'اعزب': 'Single',
        'عزباء': 'Single',
        'انسة': 'Single',
        'أنسة': 'Single',
        'مطلق': 'Divorced',
        'مطلقة': 'Divorced',
        'أرمل': 'Widowed',
        'أرملة': 'Widowed',
        'ارمل': 'Widowed',
        'ارملة': 'Widowed',
        'متعدد الزوجات': 'Married',
        'غير مسجل': ''
    };

    // ═══ مساعد: الحصول على عنصر بالـ ID ═══
    function $id(id) { return document.getElementById(id); }

    // ═══ عرض رسالة flash (يستخدم دالة fl الموجودة أو alert) ═══
    function flash(msg, type) {
        if (typeof fl === 'function') { fl(msg, type); }
        else if (type === 'err') { console.error(msg); }
        else { console.log(msg); }
    }

    // ═══ إظهار / إخفاء عنصر ═══
    function show(el) { if (el) el.classList.remove('hidden'); }
    function hide(el) { if (el) el.classList.add('hidden'); }

    /**
     * ═══════════════════════════════════════════
     *  1. زر "السجل المدني" بجوار رقم الهوية
     *     → يبحث برقم الهوية فقط إذا كان ممتلئاً
     * ═══════════════════════════════════════════
     */
    window.doSearch = function () {
        var idVal = ($id('idI') ? $id('idI').value.trim() : '');
        var first  = ($id('adv_first')  ? $id('adv_first').value.trim()  : '');
        var second = ($id('adv_second') ? $id('adv_second').value.trim() : '');
        var third  = ($id('adv_third')  ? $id('adv_third').value.trim()  : '');
        var family = ($id('adv_family') ? $id('adv_family').value.trim() : '');

        // إذا كان المستخدم ضغط زر الهوية → ابحث بالهوية فقط
        // إذا كانت حقول الأسماء ممتلئة → ابحث بها
        if (!idVal && !first && !second && !third && !family) {
            alert('يرجى إدخال رقم الهوية أو أي من حقول الاسم للبحث في السجل المدني');
            return;
        }

        _sendSearch({ id: idVal, first: first, second: second, third: third, family: family });
    };

    /**
     * ═══════════════════════════════════════════
     *  2. زر "بحث في السجل المدني" أسفل خيارات البحث
     *     → يبحث بالأسماء (الأول، الأب، الجد، العائلة)
     * ═══════════════════════════════════════════
     */
    window.searchCivilRegistryAdvanced = function () {
        var first  = ($id('adv_first')  ? $id('adv_first').value.trim()  : '');
        var second = ($id('adv_second') ? $id('adv_second').value.trim() : '');
        var third  = ($id('adv_third')  ? $id('adv_third').value.trim()  : '');
        var family = ($id('adv_family') ? $id('adv_family').value.trim() : '');

        if (!first && !second && !third && !family) {
            alert('يرجى إدخال الاسم الأول أو اسم الأب أو الجد أو العائلة للبحث');
            return;
        }

        _sendSearch({ id: '', first: first, second: second, third: third, family: family });
    };

    /**
     * ═══════════════════════════════════════════
     *  الدالة المشتركة لإرسال طلب البحث
     * ═══════════════════════════════════════════
     */
    function _sendSearch(params) {
        flash('جاري البحث في السجل المدني...', 'ok');
        console.log('[CR Search] Params:', params);

        var serverUrl = window.location.origin + '/api/searchAdvanced';

        fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        })
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function (data) {
            console.log('[CR Search] Results:', data);
            _renderResults(data);
        })
        .catch(function (err) {
            console.error('[CR Search] Error:', err);
            flash('تعذر الاتصال بسيرفر السجل المدني: ' + err.message, 'err');
        });
    }

    /**
     * ═══════════════════════════════════════════
     *  3. عرض نتائج البحث كبطاقات
     *     لا يُعبّأ النموذج مباشرة — بل تظهر بطاقات
     * ═══════════════════════════════════════════
     */
    function _renderResults(data) {
        var container = $id('cr_results_container');
        if (!container) {
            console.error('[CR] Results container not found!');
            return;
        }

        if (data.error) {
            flash('خطأ في البحث: ' + data.message, 'err');
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444"><div style="font-size:32px;margin-bottom:8px">⚠️</div>' + (data.message || 'خطأ غير محدد') + '</div>';
            container.style.display = 'block';
            return;
        }

        if (!data.found || !data.results || data.results.length === 0) {
            container.innerHTML = [
                '<div style="padding:24px;text-align:center;color:#94a3b8">',
                  '<div style="font-size:44px;opacity:.3;margin-bottom:10px">🔍</div>',
                  '<div style="font-size:15px;font-weight:600">لم يتم العثور على نتائج مطابقة</div>',
                  '<div style="font-size:12px;margin-top:5px;opacity:.7">تحقق من الإملاء أو حاول بمعلومات مختلفة</div>',
                '</div>'
            ].join('');
            container.style.display = 'block';
            flash('لم يتم العثور على سجلات مطابقة', 'err');
            return;
        }

        flash('تم العثور على ' + data.results.length + ' نتيجة في السجل المدني', 'ok');

        var html = [
            '<div style="font-weight:700;color:var(--p);margin-bottom:12px;font-size:14px;display:flex;align-items:center;gap:6px">',
              '<span style="background:var(--p);color:#fff;padding:2px 10px;border-radius:12px;font-size:12px">' + data.results.length + '</span>',
              '📋 نتائج البحث في السجل المدني',
            '</div>'
        ].join('');

        data.results.forEach(function (r, idx) {
            var genderAr = (r.gender === 'Male' || r.genderAr === 'ذكر') ? 'ذكر' 
                         : (r.gender === 'Female' || r.genderAr === 'أنثى') ? 'أنثى' 
                         : (r.genderAr || r.gender || '—');

            // تخزين البيانات آمنة للاستخدام في onclick
            var safeR = JSON.stringify(r).replace(/'/g, "\\'");

            html += [
                '<div class="rc" style="margin:8px 0;border-radius:10px;border:1px solid #e2e8f0;border-right:4px solid var(--p);padding:14px 16px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.06)">',
                  '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">',
                    '<div>',
                      '<div style="font-size:15px;font-weight:700;color:#1e293b">',
                        '<span style="background:var(--p);color:#fff;padding:1px 8px;border-radius:6px;font-size:11px;margin-left:6px">#' + (idx + 1) + '</span>',
                        (r.fullName || '—'),
                      '</div>',
                      '<div style="font-size:12px;color:#64748b;margin-top:3px">🆔 ' + (r.id || '—') + '</div>',
                    '</div>',
                    '<span style="font-size:10px;background:var(--pl,#ede9fe);color:var(--p);padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap">سجل مدني</span>',
                  '</div>',

                  '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12.5px;color:#475569;margin-bottom:10px">',
                    '<span>📅 <strong>الميلاد:</strong> ' + (r.dob || '—') + '</span>',
                    '<span>👤 <strong>الجنس:</strong> ' + genderAr + '</span>',
                    '<span>📍 <strong>المحافظة:</strong> ' + (r.governorate || '—') + '</span>',
                    (r.socialStatus ? '<span>💍 <strong>الحالة:</strong> ' + r.socialStatus + '</span>' : ''),
                  '</div>',

                  // الأزرار: تعديل + إضافة زيارة فقط
                  '<div style="display:flex;gap:8px;justify-content:flex-end">',
                    '<button onclick="window.crEditRecord(\'' + (r.id||'') + '\')" ',
                      'style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:7px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600">',
                      '✏️ تعديل',
                    '</button>',
                    '<button onclick="window.crAddVisit(\'' + (r.id||'') + '\')" ',
                      'style="background:var(--g,#10b981);color:#fff;border:none;border-radius:7px;padding:6px 16px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600">',
                      '➕ زيارة',
                    '</button>',
                  '</div>',
                '</div>'
            ].join('');
        });

        // تخزين النتائج للرجوع إليها
        window._crLastResults = data.results;

        container.innerHTML = html;
        container.style.display = 'block';
    }

    /**
     * ═══════════════════════════════════════════
     *  4أ. زر "+ زيارة": إخفاء شاشة البحث + تعبئة النموذج
     * ═══════════════════════════════════════════
     */
    window.crAddVisit = function (id) {
        var results = window._crLastResults || [];
        var r = results.find(function (x) { return String(x.id) === String(id); });
        if (!r) {
            flash('لم يتم العثور على بيانات البطاقة', 'err');
            return;
        }
        _fillFormFromCR(r);
    };

    /**
     * ═══════════════════════════════════════════
     *  4ب. زر "تعديل": تحرير السجل المدني
     * ═══════════════════════════════════════════
     */
    window.crEditRecord = function (id) {
        flash('جاري تحميل بيانات السجل للتعديل...', 'ok');
        fetch(window.location.origin + '/api/searchAdvanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.found && data.results && data.results.length > 0) {
                var rec = data.results[0];
                var newFirst  = prompt('الاسم الأول:', rec.first  || '');
                if (newFirst === null) return; // إلغاء
                var newSecond = prompt('اسم الأب:', rec.second || '');
                if (newSecond === null) return;
                var newThird  = prompt('اسم الجد:', rec.third  || '');
                if (newThird === null) return;
                var newFamily = prompt('اسم العائلة:', rec.family || '');
                if (newFamily === null) return;

                fetch(window.location.origin + '/api/editCitizen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: id,
                        first: newFirst.trim(),
                        second: newSecond.trim(),
                        third: newThird.trim(),
                        family: newFamily.trim(),
                        dob: rec.dob,
                        gender: rec.gender,
                        governorate: rec.governorate
                    })
                })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    if (res.success) { flash('✅ تم تحديث السجل المدني بنجاح', 'ok'); window.doSearch(); }
                    else flash('خطأ في التحديث: ' + (res.message || ''), 'err');
                })
                .catch(function () { flash('تعذر حفظ التعديلات', 'err'); });
            } else {
                flash('لم يتم العثور على السجل', 'err');
            }
        })
        .catch(function () { flash('تعذر تحميل بيانات السجل', 'err'); });
    };

    /**
     * ═══════════════════════════════════════════
     *  التعبئة التلقائية للنموذج من بيانات السجل المدني
     *  مع إخفاء منطقة البحث وعرض النموذج
     * ═══════════════════════════════════════════
     */
    function _fillFormFromCR(r) {
        console.log('[CR Fill] Data:', r);

        // إخفاء منطقة بطاقات النتائج
        var container = $id('cr_results_container');
        if (container) { container.innerHTML = ''; container.style.display = 'none'; }

        // ملء رقم الهوية
        if (r.id && $id('idI')) {
            $id('idI').value = r.id;
            $id('idI').disabled = true;
            if (typeof updateIDProg === 'function') updateIDProg($id('idI'));
            var sb = $id('idSB'); if (sb) sb.classList.add('hidden');
            var cb = $id('idCB'); if (cb) cb.classList.remove('hidden');
        }

        // ملء الاسم الكامل
        var fullName = [r.first, r.second, r.third, r.family]
            .filter(function (n) { return n && n !== '-'; })
            .join(' ');
        if (!fullName && r.fullName) fullName = r.fullName;
        if (fullName && $id('fN')) $id('fN').value = fullName;

        // ملء تاريخ الميلاد
        if (r.dob && $id('fDOB')) {
            // تحويل التنسيق dd/mm/yyyy → yyyy-mm-dd إذا لزم
            var dob = r.dob;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
                var parts = dob.split('/');
                dob = parts[2] + '-' + parts[1] + '-' + parts[0];
            }
            $id('fDOB').value = dob;
            if (typeof calcAgeFromDOB === 'function') calcAgeFromDOB();
        }

        // ملء الجنس
        if (r.gender) {
            var gender = (r.gender === 'Male' || r.genderAr === 'ذكر') ? 'Male'
                       : (r.gender === 'Female' || r.genderAr === 'أنثى') ? 'Female'
                       : r.gender;
            if (typeof F !== 'undefined' && typeof bPgen === 'function') {
                F.gender = gender;
                bPgen();
            }
        }

        // ملء المحافظة (تحويل من عربي إلى إنجليزي)
        if (r.governorate && $id('fG')) {
            var govEn = GOV_MAP[r.governorate] || r.governorate;
            var fG = $id('fG');
            var matched = false;
            for (var i = 0; i < fG.options.length; i++) {
                if (fG.options[i].value === govEn || fG.options[i].value === r.governorate) {
                    fG.selectedIndex = i;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // بحث جزئي في النص
                for (var j = 0; j < fG.options.length; j++) {
                    if (fG.options[j].text.includes(r.governorate) || fG.options[j].value.toLowerCase().includes(govEn.toLowerCase())) {
                        fG.selectedIndex = j;
                        break;
                    }
                }
            }
        }

        // ملء الحالة الاجتماعية (تحويل من عربي إلى إنجليزي)
        if (r.socialStatus && $id('fSo')) {
            var socEn = SOC_MAP[r.socialStatus] || r.socialStatus;
            var fSo = $id('fSo');
            var socMatched = false;
            for (var k = 0; k < fSo.options.length; k++) {
                if (fSo.options[k].value === socEn) {
                    fSo.selectedIndex = k;
                    socMatched = true;
                    break;
                }
            }
            if (!socMatched && socEn) {
                for (var m = 0; m < fSo.options.length; m++) {
                    if (fSo.options[m].text.trim() === r.socialStatus) {
                        fSo.selectedIndex = m;
                        break;
                    }
                }
            }
        }

        // إخفاء رسائل الحالة القديمة وعرض النموذج
        var bN = $id('bN'); if (bN) bN.classList.add('hidden');
        var bW = $id('bW'); if (bW) bW.classList.add('hidden');
        var bF = $id('bF');
        if (bF) {
            bF.innerHTML = '✓ تم ملء البيانات من السجل المدني — <strong>' + (fullName || '') + '</strong>' +
                '<button class="bn-x" onclick="this.parentElement.classList.add(\'hidden\')">✕</button>';
            bF.classList.remove('hidden');
        }
        var fS = $id('fS'); if (fS) fS.classList.remove('hidden');

        flash('✅ تم ملء البيانات من السجل المدني — ' + (fullName || r.id || ''), 'ok');
    }

    /**
     * ═══════════════════════════════════════════
     *  5. زر (X) الأحمر: مسح كل شيء وإعادة الحالة
     * ═══════════════════════════════════════════
     */
    window.clearSearch = function () {
        // تفريغ حقل الهوية
        var idInput = $id('idI');
        if (idInput) {
            idInput.value = '';
            idInput.disabled = false;
            if (typeof updateIDProg === 'function') updateIDProg(idInput);
        }

        // تفريغ حقول الأسماء
        ['adv_first', 'adv_second', 'adv_third', 'adv_family'].forEach(function (id) {
            var el = $id(id); if (el) el.value = '';
        });

        // إخفاء بطاقات النتائج
        var container = $id('cr_results_container');
        if (container) { container.innerHTML = ''; container.style.display = 'none'; }

        // إخفاء النموذج وإعادة الأزرار
        var idSB = $id('idSB'); if (idSB) idSB.classList.remove('hidden');
        var idCB = $id('idCB'); if (idCB) idCB.classList.add('hidden');
        var bF = $id('bF'); if (bF) bF.classList.add('hidden');
        var bN = $id('bN'); if (bN) bN.classList.add('hidden');
        var bW = $id('bW'); if (bW) bW.classList.add('hidden');
        var fS = $id('fS'); if (fS) fS.classList.add('hidden');

        // مسح البيانات المخزنة
        window._crLastResults = [];

        flash('تم مسح جميع حقول البحث', 'ok');
    };

    // ═══ دعم التوافق: fillFromCR القديمة ═══
    window.fillFromCR = function (r) { _fillFormFromCR(r); };

    // ═══ دعم التوافق: receiveCivilRegistryResults ═══
    window.receiveCivilRegistryResults = function (data) { _renderResults(data); };

    // ═══ دعم التوافق: editCivilRecord ═══
    window.editCivilRecord = function (id) { window.crEditRecord(id); };

    console.log('[CR Module] ✅ Civil Registry Search Module loaded');

})();
