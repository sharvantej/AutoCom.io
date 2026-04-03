param(
    [string]$Source,
    [string]$Destination,
    [switch]$IncludeGit
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Edit only these three lines if you want saved defaults.
$defaultSource = Join-Path $scriptRoot ".."
$defaultDestination = ""
$defaultIncludeGit = $false

if ([string]::IsNullOrWhiteSpace($Source)) {
    $Source = $defaultSource
}

if ([string]::IsNullOrWhiteSpace($Destination)) {
    $Destination = $defaultDestination
}

if (-not $PSBoundParameters.ContainsKey("IncludeGit") -and $defaultIncludeGit) {
    $IncludeGit = $true
}

$sourcePath = (Resolve-Path $Source).Path.TrimEnd('\')

if ([string]::IsNullOrWhiteSpace($Destination)) {
    throw "Destination is required. Set `$defaultDestination in scripts\copy-project-for-transfer.ps1 or pass -Destination."
}

$destinationPath = [System.IO.Path]::GetFullPath($Destination).TrimEnd('\')

if (-not (Test-Path $sourcePath)) {
    throw "Source path not found: $sourcePath"
}

$sourcePrefix = "$sourcePath\"
$destinationPrefix = "$destinationPath\"
if ($destinationPath.Equals($sourcePath, [System.StringComparison]::OrdinalIgnoreCase) -or
    $destinationPrefix.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Destination must be outside the source folder."
}

if (-not (Test-Path $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
}

$excludeDirs = @(
    "node_modules",
    "dist",
    "src-tauri\target",
    "src-tauri\gen"
)

if (-not $IncludeGit) {
    $excludeDirs += ".git"
}

$robocopyArgs = @(
    $sourcePath,
    $destinationPath,
    "/E",
    "/R:1",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/XD"
) + ($excludeDirs | ForEach-Object { Join-Path $sourcePath $_ })

Write-Host ""
Write-Host "Copying project for transfer..." -ForegroundColor Cyan
Write-Host "Source:      $sourcePath"
Write-Host "Destination: $destinationPath"
Write-Host "Skipping:    $($excludeDirs -join ', ')"
Write-Host ""

& robocopy @robocopyArgs | Out-Host
$exitCode = $LASTEXITCODE

if ($exitCode -ge 8) {
    throw "Robocopy failed with exit code $exitCode"
}

Write-Host ""
Write-Host "Transfer copy complete." -ForegroundColor Green
Write-Host "On the other PC, run: npm install" -ForegroundColor Green
Write-Host "Then start with:      npm run dev" -ForegroundColor Green
