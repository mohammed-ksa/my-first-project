$filePath = "c:\Users\TOP\Desktop\IMS\IMS_Medical_System_4.html"
$backupPath = "c:\Users\TOP\Desktop\IMS\IMS_Medical_System_4_backup.html"
Copy-Item $filePath $backupPath -Force

$html = [System.IO.File]::ReadAllText($filePath)

# Extract CSS
$styleStart = $html.IndexOf("<style>")
$styleEnd = $html.IndexOf("</style>")
if ($styleStart -ge 0 -and $styleEnd -gt $styleStart) {
    $css = $html.Substring($styleStart + 7, $styleEnd - $styleStart - 7)
    [System.IO.File]::WriteAllText("c:\Users\TOP\Desktop\IMS\styles.css", $css)
    $html = $html.Remove($styleStart, $styleEnd - $styleStart + 8).Insert($styleStart, '<link rel="stylesheet" href="styles.css">')
}

# Extract JS
$initIndex = $html.IndexOf("INIT_PATIENTS")
if ($initIndex -gt 0) {
    $scriptStart = $html.LastIndexOf("<script>", $initIndex)
    $scriptEnd = $html.IndexOf("</script>", $initIndex)
    if ($scriptStart -ge 0 -and $scriptEnd -gt $scriptStart) {
        $js = $html.Substring($scriptStart + 8, $scriptEnd - $scriptStart - 8)
        [System.IO.File]::WriteAllText("c:\Users\TOP\Desktop\IMS\app.js", $js)
        $html = $html.Remove($scriptStart, $scriptEnd - $scriptStart + 9).Insert($scriptStart, '<script src="app.js"></script>')
    }
}

[System.IO.File]::WriteAllText($filePath, $html)
Write-Host "Refactoring completed successfully!"
