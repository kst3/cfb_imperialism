$ErrorActionPreference = 'Stop'
$devRoot = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent $devRoot
$bundlePath = Join-Path $workspace 'data.js'
$bundle = [IO.File]::ReadAllText($bundlePath)
$parts = $bundle -split ';\s*window.US_MAP = ', 2
if ($parts.Count -ne 2) { throw 'Unexpected data.js format.' }
$teams = ($parts[0] -replace '^window.TEAMS = ', '') | ConvertFrom-Json
$locations = Import-Csv (Join-Path $devRoot 'locations.csv')
foreach ($team in $teams) {
    $point = @($locations | Where-Object id -eq $team.id)
    if ($point.Count -ne 1) { throw "Expected one coordinate record for $($team.name)" }
    $team.lat = [double]::Parse($point[0].lat, [cultureinfo]::InvariantCulture)
    $team.lon = [double]::Parse($point[0].lon, [cultureinfo]::InvariantCulture)
    if ($team.lat -lt -90 -or $team.lat -gt 90 -or $team.lon -lt -180 -or $team.lon -gt 180) { throw "Invalid coordinates: $($team.name)" }
    $team.city = $point[0].city
    $team.state = $point[0].state
}
$json = ConvertTo-Json -InputObject @($teams) -Depth 5 -Compress
[IO.File]::WriteAllText($bundlePath, 'window.TEAMS = ' + $json + ';' + [Environment]::NewLine + 'window.US_MAP = ' + $parts[1])
Write-Output "Updated $($teams.Count) team locations."
