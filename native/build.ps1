# Сборка Пульт.exe (WebView2) встроенным в Windows компилятором C#.
# Сначала забирает свежие сборки Алхимика, Терминала Брига и Папируса (sync-apps.ps1),
# затем вшивает в exe всю папку web\ и библиотеки WebView2 (native\lib).
# Запуск: powershell -ExecutionPolicy Bypass -File native\build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$native = $PSScriptRoot
$lib = Join-Path $native 'lib'
$web = Join-Path $root 'web'
$out = Join-Path $root 'Пульт.exe'
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'

& (Join-Path $root 'sync-apps.ps1')

# Иконка: три дуги цветов приложений вокруг точки, PNG нескольких размеров в одном .ico
Add-Type -AssemblyName System.Drawing
# Цвета приложений по часовой стрелке от верха — как в меню (Алхимик, Бриг, Папирус, Инженер, Кухня, Химзавод, Персонаж)
$colors = '#3fa66b', '#d63c45', '#3a7be0', '#e2b33a', '#e07a3f', '#9a6ad6', '#d65a9c'
$span = 360 / $colors.Count
$sizes = 16, 24, 32, 48, 64, 256
$pngs = foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
    $w = [Math]::Max(2.0, $s * 0.16)
    $m = $w / 2 + $s * 0.04
    $rect = New-Object System.Drawing.RectangleF $m, $m, ($s - 2 * $m), ($s - 2 * $m)
    for ($i = 0; $i -lt $colors.Count; $i++) {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($colors[$i])), $w
        $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
        $g.DrawArc($pen, $rect, -90 - $span / 2 + $i * $span + 12, $span - 24)
        $pen.Dispose()
    }
    $dot = $s * 0.22
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 150, 160, 178))
    $g.FillEllipse($brush, ($s - $dot) / 2, ($s - $dot) / 2, $dot, $dot)
    $brush.Dispose(); $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    , $ms.ToArray()
}
$ico = Join-Path $native 'icon.ico'
$fs = [System.IO.File]::Create($ico); $bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]; $b = if ($s -ge 256) { 0 } else { $s }
    $bw.Write([byte]$b); $bw.Write([byte]$b); $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]$pngs[$i].Length); $bw.Write([uint32]$offset)
    $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Close()

# Каждый файл web\ — ресурс «web/<путь>», по нему окно и отдаёт страницы
$resources = Get-ChildItem $web -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($web.Length + 1).Replace('\', '/')
    "/resource:$($_.FullName),web/$rel"
}

$cscArgs = @(
    '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/codepage:65001',
    "/out:$out", "/win32icon:$ico",
    "/reference:$lib\Microsoft.Web.WebView2.Core.dll",
    "/reference:$lib\Microsoft.Web.WebView2.WinForms.dll",
    '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll'
) + $resources + @(
    "/resource:$lib\Microsoft.Web.WebView2.Core.dll,Microsoft.Web.WebView2.Core.dll",
    "/resource:$lib\Microsoft.Web.WebView2.WinForms.dll,Microsoft.Web.WebView2.WinForms.dll",
    "/resource:$lib\WebView2Loader.dll,WebView2Loader.dll",
    (Join-Path $native 'Pult.cs')
)
& $csc @cscArgs
if ($LASTEXITCODE -ne 0) { throw "csc завершился с кодом $LASTEXITCODE" }
"Готово: $out ({0:N2} МБ)" -f ((Get-Item $out).Length / 1MB)
