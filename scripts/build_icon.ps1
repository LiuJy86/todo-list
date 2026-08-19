Set-Location "c:\Users\issuser\Desktop\case\Claude_ToDoList_2_workshop"
Add-Type -AssemblyName System.Drawing

$srcIco = "icon.ico"
$outIco = "build\icon.ico"

# 读取 icon.ico（可能是单帧），统一放大到 256，并生成 256/48/32/16 多尺寸 ico
$sizes = @(256, 128, 64, 48, 32, 24, 16)

# 尝试加载为图标，失败则按位图加载
try {
    $base = [System.Drawing.Icon]::ExtractAssociatedIcon((Resolve-Path $srcIco))
    $bmp = $base.ToBitmap()
} catch {
    $bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcIco))
}

Write-Host "原始尺寸: $($bmp.Width)x$($bmp.Height)"

# 生成每尺寸的 PNG 流
$streams = @()
foreach ($sz in $sizes) {
    # 等比例缩放到 sz x sz，保持透明
    $resized = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    # 计算居中绘制
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

# 手写 ICO 文件格式
# ICONDIR (6 bytes) + ICONDIRENTRY per image (16 bytes each) + PNG data
$fs = [System.IO.File]::Open($outIco, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR
$bw.Write([UInt16]0)           # Reserved, must be 0
$bw.Write([UInt16]1)           # Type: 1 = ICO
$bw.Write([UInt16]$sizes.Count) # Number of images

$dataOffset = 6 + 16 * $sizes.Count
foreach ($entry in $streams) {
    $sz = $entry.Size
    $bytes = $entry.Stream.ToArray()
    $w = if ($sz -eq 256) { 0 } else { [byte]$sz }   # 256 存 0
    $h = if ($sz -eq 256) { 0 } else { [byte]$sz }
    $bw.Write([byte]$w)             # Width
    $bw.Write([byte]$h)             # Height
    $bw.Write([byte]0)              # Color count (0 = no palette)
    $bw.Write([byte]0)              # Reserved
    $bw.Write([UInt16]1)            # Color planes
    $bw.Write([UInt16]32)           # Bits per pixel
    $bw.Write([UInt32]$bytes.Length)# Size of image data
    $bw.Write([UInt32]$dataOffset)  # Offset to data
    $dataOffset += $bytes.Length
}
foreach ($entry in $streams) {
    $bytes = $entry.Stream.ToArray()
    $bw.Write($bytes)
    $entry.Stream.Dispose()
}
$bw.Flush()
$fs.Close()
$fs.Dispose()

$outSizeKB = [math]::Round((Get-Item $outIco).Length / 1KB, 1)
Write-Host "已生成 $outIco : $outSizeKB KB (包含 $($sizes.Count) 个尺寸)"
foreach ($sz in $sizes) { Write-Host "  - $sz x $sz" }
