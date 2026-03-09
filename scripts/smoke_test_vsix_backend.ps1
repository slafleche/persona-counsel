param(
  [Parameter(Mandatory = $true)]
  [string]$VsixPath,

  [Parameter(Mandatory = $true)]
  [string]$Target
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $VsixPath)) {
  throw "VSIX not found: $VsixPath"
}

$tmpDir = Join-Path $env:TEMP ("persona-counsel-smoke-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tmpDir | Out-Null

try {
  $unpackDir = Join-Path $tmpDir "unpacked"
  Expand-Archive -LiteralPath $VsixPath -DestinationPath $unpackDir -Force

  if ($Target -like "win32-*") {
    $binPath = Join-Path $unpackDir "extension/backend/$Target/counsel.exe"
  } else {
    $binPath = Join-Path $unpackDir "extension/backend/$Target/counsel"
  }

  if (!(Test-Path -LiteralPath $binPath)) {
    throw "Bundled backend not found in VSIX: $binPath"
  }

  if (Get-Command counsel -ErrorAction SilentlyContinue) {
    throw "Expected no preinstalled counsel in clean smoke environment, but found one on PATH."
  }

  & $binPath --help | Out-Null
  # Some builds expose version as a command/option, others don't yet.
  # Keep compatibility while still probing when available.
  $versionOk = $true
  try {
    & $binPath --version | Out-Null
  } catch {
    try {
      & $binPath version | Out-Null
    } catch {
      $versionOk = $false
    }
  }
  if (-not $versionOk) {
    Write-Warning "version probe skipped: no supported version flag/command"
  }

  function Invoke-WorkspaceSmoke {
    param(
      [Parameter(Mandatory = $true)]
      [string]$WorkDir
    )

    New-Item -ItemType Directory -Path $WorkDir | Out-Null
    Push-Location $WorkDir
    try {
      & $binPath setup | Out-Null
      $doctorJson = & $binPath doctor --json
    } finally {
      Pop-Location
    }

    $doctor = $doctorJson | ConvertFrom-Json
    if ($doctor.status -ne "ok") {
      throw "Doctor status is not ok."
    }

    foreach ($dir in @("personas", "counsels", "sessions")) {
      if (!(Test-Path -LiteralPath (Join-Path $WorkDir $dir))) {
        throw "Expected setup-created directory missing: $dir (work_dir: $WorkDir)"
      }
    }
  }

  Invoke-WorkspaceSmoke -WorkDir (Join-Path $tmpDir "workspace space")
  Invoke-WorkspaceSmoke -WorkDir (Join-Path $tmpDir "workspace-unicode-e-accented-é")

  Write-Host "vsix-backend-smoke: ok ($Target)"
} finally {
  if (Test-Path -LiteralPath $tmpDir) {
    Remove-Item -LiteralPath $tmpDir -Recurse -Force
  }
}
