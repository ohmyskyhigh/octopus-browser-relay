$ErrorActionPreference = 'Stop'

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source = Join-Path $workspace 'apps\native-host\src\relay-native-host.cpp'
$outputDirectory = Join-Path $workspace 'dist\native-host'
$output = Join-Path $outputDirectory 'relay-native-host.exe'
$object = Join-Path $outputDirectory 'relay-native-host.obj'

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$vsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$installationPath = if (Test-Path -LiteralPath $vsWhere) {
  & $vsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
else {
  $null
}

if (-not $installationPath) {
  $knownBuildTools = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\2017\BuildTools'
  if (Test-Path -LiteralPath $knownBuildTools) { $installationPath = $knownBuildTools }
}
if (-not $installationPath) {
  throw 'Visual Studio C++ Build Tools were not found.'
}

$developerCommand = Join-Path $installationPath 'Common7\Tools\VsDevCmd.bat'
$compileCommand = 'call "{0}" -arch=x64 && cl /nologo /EHsc /O2 /W4 /DUNICODE /D_UNICODE "{1}" /Fo:"{2}" /Fe:"{3}" /link winhttp.lib' -f $developerCommand, $source, $object, $output
& cmd.exe /d /s /c $compileCommand
if ($LASTEXITCODE -ne 0) { throw "Native companion build failed with exit code $LASTEXITCODE." }

Write-Output $output
