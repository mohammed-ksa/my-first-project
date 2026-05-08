Set WShell = CreateObject("WScript.Shell")
WShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WShell.Run Chr(34) & WShell.CurrentDirectory & "\start_system.bat" & Chr(34), 0, False
