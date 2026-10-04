param(
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$ProjectName = '26s1-sc4025-group4',
    [ValidateRange(1024, 65535)]
    [int]$Port = 3000,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$releasePath = Join-Path $PSScriptRoot 'release.json'
$archivePath = Join-Path $PSScriptRoot 'source.zip'
$release = Get-Content -LiteralPath $releasePath -Raw | ConvertFrom-Json
if ($release.commit -notmatch '^[a-f0-9]{40}$' -or
    $release.sourceSha256 -notmatch '^[a-f0-9]{64}$' -or
    $release.integration.passed -ne $true -or
    $release.integration.cleanCheckout -ne $true -or
    $release.integration.commit -ne $release.commit) {
    throw 'Release metadata is invalid or does not have passing integration evidence.'
}
$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $release.sourceSha256) {
    throw 'Source archive checksum does not match the tested release.'
}
if ($ValidateOnly) {
    Write-Host "Release verified: $($release.commit)"
    return
}

# A stable project name reuses the laptop's existing database volume across release folders.
$appPath = Join-Path $PSScriptRoot 'app'
if (Test-Path -LiteralPath $appPath) {
    throw 'The app folder already exists. Extract the release into a new folder before deploying.'
}
Expand-Archive -LiteralPath $archivePath -DestinationPath $appPath
$previousVersion = $env:EATIGO_RELEASE_SHA
$previousPort = $env:EATIGO_PORT
try {
    $env:EATIGO_RELEASE_SHA = $release.commit
    $env:EATIGO_PORT = [string]$Port
    docker compose --project-name $ProjectName --project-directory $appPath -f (Join-Path $appPath 'docker-compose.yml') up --build --wait --wait-timeout 240
    if ($LASTEXITCODE -ne 0) { throw 'Docker deployment failed. Inspect docker compose logs.' }
    $version = Invoke-RestMethod -Uri "http://localhost:$Port/version.json" -TimeoutSec 15
    if ($version.commit -ne $release.commit) { throw 'The running version differs from this release.' }
    Write-Host "Deployed $($release.commit) at http://localhost:$Port"
} finally {
    $env:EATIGO_RELEASE_SHA = $previousVersion
    $env:EATIGO_PORT = $previousPort
}
