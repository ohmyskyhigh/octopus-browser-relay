param([Parameter(Mandatory = $true)][string]$RunId)

pnpm tsx tests/real-world/scenario-runner.ts --run-id=$RunId
exit $LASTEXITCODE
