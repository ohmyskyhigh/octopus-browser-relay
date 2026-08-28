param([Parameter(Mandatory = $true)][string]$RunId)

pnpm tsx tests/real-world/verify-run.ts --run-id=$RunId
exit $LASTEXITCODE
