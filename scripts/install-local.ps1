param([switch]$TestMode)

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dataRoot = [System.IO.Path]::GetFullPath((Join-Path $workspace '.relay-data'))
New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
Push-Location $workspace
try {
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  pnpm verify
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if (-not $TestMode) {
    $process = Start-Process -FilePath 'pnpm' -ArgumentList @('start') -WorkingDirectory $workspace -WindowStyle Hidden -PassThru
    Set-Content -LiteralPath (Join-Path $dataRoot 'broker.pid') -Value $process.Id
    Write-Output "Broker started with PID $($process.Id)."
  }
} finally {
  Pop-Location
}
