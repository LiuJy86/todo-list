$ErrorActionPreference = "Stop"
Set-Location "c:\Users\issuser\Desktop\case\Claude_ToDoList_2_workshop"

Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
# 保留 .cache 避免重复下载 electron-builder-binaries（nsis / winCodeSign）
New-Item -ItemType Directory -Force -Path ".cache\electron-builder" | Out-Null
New-Item -ItemType Directory -Force -Path ".cache\electron" | Out-Null

$env:ELECTRON_BUILDER_CACHE = Join-Path (Get-Location) ".cache\electron-builder"
$env:ELECTRON_CACHE = Join-Path (Get-Location) ".cache\electron"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://registry.npmmirror.com/-/binary/electron-builder-binaries/"
$env:ELECTRON_MIRROR = "https://registry.npmmirror.com/-/binary/electron/"

Write-Host "ELECTRON_BUILDER_CACHE: $env:ELECTRON_BUILDER_CACHE"
Write-Host "ELECTRON_CACHE: $env:ELECTRON_CACHE"
Write-Host "开始打包..."

& npx electron-builder --win portable --x64
$exitCode = $LASTEXITCODE
Write-Host "打包结束 exitCode=$exitCode"

if (Test-Path dist) {
    Write-Host "=== dist 目录产物 ==="
    Get-ChildItem dist -File -Recurse | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
}
exit $exitCode
