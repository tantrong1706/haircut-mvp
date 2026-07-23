param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$ConfirmProject,
  [switch]$Execute
)

$ErrorActionPreference = "Stop"
if ($Source -notmatch '^gs://[a-z0-9._-]+/.+') {
  throw "Source phải là đường dẫn export gs://... đầy đủ."
}
if ($ConfirmProject -ne $ProjectId) {
  throw "ConfirmProject phải trùng chính xác ProjectId."
}

Write-Host "Project : $ProjectId"
Write-Host "Import  : $Source"
Write-Warning "Firestore import gộp dữ liệu và không tự xóa document phát sinh sau bản backup."

if (-not $Execute) {
  Write-Host "DRY-RUN: chưa import dữ liệu. Chỉ dùng -Execute sau diễn tập restore và phê duyệt sự cố."
  exit 0
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Không tìm thấy gcloud CLI."
}

& gcloud firestore import $Source "--project=$ProjectId"
if ($LASTEXITCODE -ne 0) {
  throw "Firestore import thất bại với exit code $LASTEXITCODE."
}
Write-Host "Import hoàn tất. Chạy kiểm đếm tenant và smoke test trước khi mở lại ghi dữ liệu."
