const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const csharpCode = `
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

class Program {
    [STAThread]
    static void Main() {
        string currentDir = AppDomain.CurrentDomain.BaseDirectory;
        string batFile = Path.Combine(currentDir, "start_system.bat");
        if (File.Exists(batFile)) {
            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = "cmd.exe";
            startInfo.Arguments = "/c \\"" + batFile + "\\"";
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            startInfo.CreateNoWindow = true;
            startInfo.UseShellExecute = false;
            Process.Start(startInfo);
        } else {
            MessageBox.Show("لم يتم العثور على ملف start_system.bat في مجلد التطبيق.", "خطأ في تشغيل IMS", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
`;

// Locate csc.exe
const systemRoot = process.env.SystemRoot || 'C:\\Windows';
let cscPath = path.join(systemRoot, 'Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe');
if (!fs.existsSync(cscPath)) {
    cscPath = path.join(systemRoot, 'Microsoft.NET\\Framework\\v4.0.30319\\csc.exe');
}

if (!fs.existsSync(cscPath)) {
    console.error('❌ Could not find C# compiler (csc.exe). Please make sure .NET Framework 4.0+ is installed.');
    process.exit(1);
}

const tempFile = path.join(__dirname, 'temp_launcher.cs');
const outputFile = path.join(__dirname, 'IMS_Launcher.exe');

try {
    // Write UTF-8 with BOM to ensure csc.exe parses Arabic correctly
    fs.writeFileSync(tempFile, '\ufeff' + csharpCode, 'utf8');
    
    console.log('🔄 Compiling C# launcher into IMS_Launcher.exe...');
    const command = `"${cscPath}" /target:winexe /out:"${outputFile}" /r:System.Windows.Forms.dll "${tempFile}"`;
    execSync(command, { stdio: 'inherit' });
    
    if (fs.existsSync(outputFile)) {
        console.log('✅ Success! Created launcher: IMS_Launcher.exe');
    } else {
        console.error('❌ Failed to compile.');
    }
} catch (err) {
    console.error('❌ Error compiling launcher:', err.message);
} finally {
    if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
    }
}
