param(
  [Parameter(Mandatory = $true)][string]$RunId,
  [ValidateSet('U1','U2')][string]$Checkpoint = 'U1'
)

pnpm tsx tests/real-world/preflight.ts --run-id=$RunId --checkpoint=$Checkpoint
exit $LASTEXITCODE
