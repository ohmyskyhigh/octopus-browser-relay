param([Parameter(Mandatory = $true)][string]$RunId)

$runRoot = [System.IO.Path]::GetFullPath((Join-Path 'artifacts\real-world' $RunId))
$allowedRoot = [System.IO.Path]::GetFullPath('artifacts\real-world')
if (-not $runRoot.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing cleanup outside artifacts\real-world.'
}
Write-Output "Evidence preserved at $runRoot. Test agents stop through their coordinator instructions; Chrome profiles are never deleted."
