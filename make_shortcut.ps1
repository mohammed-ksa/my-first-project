$WS = New-Object -ComObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$ShortcutFile = [System.IO.Path]::Combine($DesktopPath, "IMS Medical System.lnk")
$Shortcut = $WS.CreateShortcut($ShortcutFile)
$Shortcut.TargetPath = [System.IO.Path]::Combine($PSScriptRoot, "IMS_Launcher.vbs")
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "IMS - Medical System"
$Shortcut.WindowStyle = 1
$Shortcut.Save()
Write-Host "Shortcut created: $ShortcutFile"
