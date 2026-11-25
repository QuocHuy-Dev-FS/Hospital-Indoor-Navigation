<#
.SYNOPSIS
    Tạo UUID dự án cho data/beacons.local.json.

.DESCRIPTION
    - Nếu data/beacons.local.json ĐÃ TỒN TẠI: thoát, không ghi đè.
    - Nếu chưa có: sao chép từ data/beacons.local.example.json,
      thay tất cả UUID placeholder (00000000-0000-0000-0000-000000000000)
      bằng một UUID mới duy nhất cho toàn dự án.
    - Không in UUID ra stdout.

.NOTES
    Chạy một lần từ thư mục gốc repo:
        powershell -ExecutionPolicy Bypass -File tools\beacon_setup\new_project_uuid.ps1

    Sau khi chạy, điền Major/Minor/x/z thật vào data/beacons.local.json.
    File này đã gitignored — không commit.
#>

$repoRoot  = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$target    = Join-Path $repoRoot "data\beacons.local.json"
$example   = Join-Path $repoRoot "data\beacons.local.example.json"

# ─── Kiểm tra file đích ───────────────────────────────────────────────────────
if (Test-Path $target) {
    Write-Host "[new_project_uuid] data/beacons.local.json ĐÃ TỒN TẠI — không ghi đè." -ForegroundColor Yellow
    Write-Host "  Nếu muốn tạo lại: xóa thủ công rồi chạy lại script." -ForegroundColor Yellow
    exit 0
}

# ─── Kiểm tra file mẫu ────────────────────────────────────────────────────────
if (-not (Test-Path $example)) {
    Write-Error "Không tìm thấy file mẫu: $example"
    exit 1
}

# ─── Sinh UUID mới và thay thế ────────────────────────────────────────────────
$newUuid      = [guid]::NewGuid().ToString().ToLower()
$placeholder  = "00000000-0000-0000-0000-000000000000"

$content = Get-Content -Path $example -Raw -Encoding UTF8
if ($content -notmatch [regex]::Escape($placeholder)) {
    Write-Error "File mẫu không chứa UUID placeholder '$placeholder'. Kiểm tra lại file mẫu."
    exit 1
}

$updated = $content -replace [regex]::Escape($placeholder), $newUuid

# ─── Ghi file ────────────────────────────────────────────────────────────────
$updated | Set-Content -Path $target -Encoding UTF8 -NoNewline

Write-Host "[new_project_uuid] Đã tạo data/beacons.local.json với UUID dự án." -ForegroundColor Green
Write-Host "  Bước tiếp theo: mở file, điền Major/Minor/x/z thật cho từng beacon." -ForegroundColor Cyan
Write-Host "  (UUID không hiển thị tại đây vì là dữ liệu nhạy cảm.)" -ForegroundColor Cyan
