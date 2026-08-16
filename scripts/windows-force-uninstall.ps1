$ErrorActionPreference = 'SilentlyContinue'
Write-Host 'Stopping Electron / Java worker...'
Get-Process | Where-Object { $_.ProcessName -match 'Mobile Standalone Edition' } | Stop-Process -Force
cmd /c 'taskkill /F /IM "Mobile Standalone Edition.exe" /T' | Out-Null
Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
  Where-Object { $_.CommandLine -match 'mobile-standalone-backend' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1

$dirs = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Mobile Standalone Edition'),
  (Join-Path $env:LOCALAPPDATA 'Programs\mobile-standalone-edition'),
  (Join-Path ${env:ProgramFiles} 'Mobile Standalone Edition'),
  (Join-Path ${env:ProgramFiles(x86)} 'Mobile Standalone Edition')
)
foreach ($d in $dirs) {
  if (Test-Path -LiteralPath $d) {
    Write-Host "Removing $d"
    Remove-Item -LiteralPath $d -Recurse -Force
  }
}

$shortcuts = @(
  (Join-Path $env:USERPROFILE 'Desktop\Mobile Standalone Edition.lnk'),
  (Join-Path $env:PUBLIC 'Desktop\Mobile Standalone Edition.lnk'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Mobile Standalone Edition.lnk')
)
foreach ($s in $shortcuts) {
  if (Test-Path -LiteralPath $s) { Remove-Item -LiteralPath $s -Force }
}
$menuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Mobile Standalone Edition'
if (Test-Path -LiteralPath $menuDir) { Remove-Item -LiteralPath $menuDir -Recurse -Force }

$uninstallRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)
foreach ($root in $uninstallRoots) {
  if (-not (Test-Path $root)) { continue }
  Get-ChildItem $root | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath
    if ($p.DisplayName -like '*Mobile Standalone Edition*') {
      Write-Host ("Removing uninstall entry " + $p.DisplayName)
      Remove-Item -LiteralPath $_.PSPath -Recurse -Force
    }
  }
}

Write-Host ''
Write-Host 'Done. Refresh Programs and Features, then run the new Setup.'
