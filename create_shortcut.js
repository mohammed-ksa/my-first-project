// IMS Desktop Shortcut Creator
// انقر نقراً مزدوجاً لإنشاء اختصار على سطح المكتب
const path = require('path');
const fs   = require('fs');

const batPath  = path.join(__dirname, 'start_system.bat');
const vbsPath  = path.join(__dirname, 'IMS_Launcher.vbs');
const iconPath = path.join(__dirname, 'IMS_Medical_System_4.html');

// ---- إنشاء ملف VBS يعمل بصمت بدون نافذة CMD ظاهرة ----
// ملاحظة: النافذة المخفية تظهر فقط في الخلفية كـ process
const vbsContent = `
Set WShell = CreateObject("WScript.Shell")
Dim batFile
batFile = "${batPath.replace(/\\/g, '\\\\')}"
WShell.Run Chr(34) & batFile & Chr(34), 0, False
`.trimStart();

fs.writeFileSync(vbsPath, vbsContent, 'utf8');
console.log('✅ تم إنشاء IMS_Launcher.vbs بنجاح.');

// ---- إنشاء اختصار على سطح المكتب ----
try {
    const { execSync } = require('child_process');
    const desktopPath = path.join(require('os').homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, 'IMS Medical System.lnk');

    const psScript = `
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut('${shortcutPath.replace(/\\/g, '\\\\')}')
$Shortcut.TargetPath = '${vbsPath.replace(/\\/g, '\\\\')}'
$Shortcut.WorkingDirectory = '${__dirname.replace(/\\/g, '\\\\')}'
$Shortcut.Description = 'IMS - نظام إدارة المعلومات الطبية'
$Shortcut.WindowStyle = 1
$Shortcut.Save()
Write-Host "Shortcut created at: ${shortcutPath.replace(/\\/g, '\\\\')}"
`;
    execSync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    console.log('✅ تم إنشاء الاختصار على سطح المكتب بنجاح!');
    console.log('📍 المسار:', shortcutPath);
    console.log('');
    console.log('🎉 الآن يمكنك النقر المزدوج على أيقونة "IMS Medical System" لتشغيل النظام مباشرة!');
} catch (e) {
    console.log('⚠️  لم يتم إنشاء الاختصار تلقائياً. استخدم ملف IMS_Launcher.vbs مباشرة.');
    console.log('   انقر نقراً مزدوجاً على: IMS_Launcher.vbs لتشغيل النظام بدون نافذة CMD.');
    console.log('   خطأ:', e.message);
}
