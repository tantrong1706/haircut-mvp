param(
  [Parameter(Mandatory = $true)][ValidatePattern('^v\d+\.\d+\.\d+$')][string]$Version,
  [string]$Message = "HAIRCUT production release",
  [switch]$Execute
)

$ErrorActionPreference = "Stop"
$status = git status --porcelain
if ($status) {
  throw "Working tree chưa sạch. Không tạo release tag."
}
$commit = (git rev-parse HEAD).Trim()
Write-Host "Tag    : $Version"
Write-Host "Commit : $commit"

if (-not $Execute) {
  Write-Host "DRY-RUN: chưa tạo tag. Thêm -Execute sau khi CI và backup đều đạt."
  exit 0
}

git tag -a $Version -m "$Message ($commit)"
if ($LASTEXITCODE -ne 0) {
  throw "Không tạo được release tag."
}
Write-Host "Đã tạo tag cục bộ. Chỉ push tag sau khi được phê duyệt phát hành."
