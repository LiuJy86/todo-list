Set-Location "c:\Users\issuser\Desktop\case\Claude_ToDoList_2_workshop"
Add-Type -AssemblyName System.Drawing

# 源：优先图标.png，否则史迪奇1.gif，否则 build/icon.ico
$src = $null
$candidates = @("图标.png", "img\史迪奇1.gif", "build\icon.ico")
foreach ($c in $candidates) {
    if (Test-Path $c) { $src = (Resolve-Path $c).Path; Write-Host "使用源: $c"; break }
}
if (-not $src) { Write-Error "找不到任何源图片"; exit 1 }

$bmp = [System.Drawing.Bitmap]::FromFile($src)
Write-Host "源尺寸: $($bmp.Width)x$($bmp.Height)"

$sizes = @(256, 128, 64, 48, 32, 24, 16)
$streams = @()
foreach ($sz in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $ratio = [Math]::Min($sz / [double]$bmp.Width, $sz / [double]$bmp.Height)
    $w = [int]($bmp.Width * $ratio)
    $h = [int]($bmp.Height * $ratio)
    $x = [int](($sz - $w) / 2)
    $y = [int](($sz - $h) / 2)
    $g.DrawImage($bmp, $x, $y, $w, $h)
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $ms.Position = 0
    $streams += @{ Size = $sz; Stream = $ms }
    $resized.Dispose()
}
$bmp.Dispose()

function Write-Ico($outPath, $entries) {
    $fs = [System.IO.File]::Open($outPath, [System.IO.FileMode]::Create)
    $bw = New-Object System.IO.BinaryWriter($fs)
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]$entries.Count)
    $off = 6 + 16 * $entries.Count
    foreach ($e in $entries) {
        $sz = $e.Size
        $bytes = $e.Stream.ToArray()
        $bw.Write([byte]((if ($sz -eq 256) {0} else {$sz})))
        $bw.Write([byte]((if ($sz -eq 256) {0} else {$sz})))
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]32)
        $bw.Write([UInt32]$bytes.Length)
        $bw.Write([UInt32]$off)
        $off += $bytes.Length
    }
    foreach ($e in $entries) {
        $bw.Write($e.Stream.ToArray())
    }
    $bw.Flush()
    $fs.Close()
    $fs.Dispose()
}

Write-Ico "build\icon.ico" $streams
Copy-Item "build\icon.ico" "icon.ico" -Force
foreach ($e in $streams) { $e.Stream.Dispose() }

foreach ($f in @("icon.ico", "build\icon.ico")) {
    $info = Get-Item $f
    Write-Host "OK: $f  $([math]::Round($info.Length / 1KB,1)) KB  (尺寸: $($sizes -join '/'))"
}
