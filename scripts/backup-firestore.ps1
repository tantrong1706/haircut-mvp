param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Bucket,
  [string]$Label = "pre-release",
  [switch]$Execute
)

$ErrorActionPreference = "Stop"
if ($Bucket -notmatch '^gs://[a-z0-9._-]+/?$') {
  throw "Bucket phải có dạng gs://ten-bucket"
}
if ($Label -notmatch '^[a-zA-Z0-9._-]{1,50}$') {
  throw "Label chỉ được chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới."
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmssZ")
$commit = (git rev-parse --short=12 HEAD).Trim()
$destination = "$($Bucket.TrimEnd('/'))/firestore/$ProjectId/$timestamp-$Label-$commit"

Write-Host "Project : $ProjectId"
Write-Host "Commit  : $commit"
Write-Host "Backup  : $destination"

if (-not $Execute) {
  Write-Host "DRY-RUN: chưa export dữ liệu. Thêm -Execute sau khi kiểm tra project và bucket."
  exit 0
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Không tìm thấy gcloud CLI."
}

& gcloud firestore export $destination "--project=$ProjectId"
if ($LASTEXITCODE -ne 0) {
  throw "Firestore export thất bại với exit code $LASTEXITCODE."
}
Write-Host "Export hoàn tất. Ghi URL backup và commit vào biên bản phát hành."
