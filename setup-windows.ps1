# SQLite setup script for Windows
# This script downloads sqlite-tools from sqlite.org and extracts sqlite3.exe to a local bin/ folder.

$Url = "https://www.sqlite.org/2026/sqlite-tools-win-x64-3530200.zip"
$ZipFile = Join-Path -Path $PSScriptRoot -ChildPath "sqlite-tools.zip"
$BinDir = Join-Path -Path $PSScriptRoot -ChildPath "bin"
$ExtractDir = Join-Path -Path $PSScriptRoot -ChildPath "sqlite-temp-extract"

# Create bin directory if it doesn't exist
if (-not (Test-Path -Path $BinDir)) {
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    Write-Host "Created bin/ directory."
}

# Download ZIP using Invoke-WebRequest
Write-Host "Downloading SQLite tools from $Url ..."
try {
    # Set TLS 1.2/1.3 protocols to prevent download handshaking errors
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing
} catch {
    Write-Error "Failed to download SQLite. Please check your internet connection. Error: $_"
    exit 1
}

# Extract ZIP
Write-Host "Extracting SQLite tools..."
try {
    if (Test-Path -Path $ExtractDir) {
        Remove-Item -Recurse -Force $ExtractDir | Out-Null
    }
    Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir -Force
} catch {
    Write-Error "Failed to extract ZIP file. Error: $_"
    if (Test-Path -Path $ZipFile) { Remove-Item -Force $ZipFile }
    exit 1
}

# Find sqlite3.exe and move it to bin/
$SqliteExe = Get-ChildItem -Path $ExtractDir -Filter "sqlite3.exe" -Recurse | Select-Object -First 1
if ($SqliteExe) {
    Copy-Item -Path $SqliteExe.FullName -Destination $BinDir -Force
    Write-Host "Successfully installed sqlite3.exe to $BinDir/sqlite3.exe"
} else {
    Write-Error "sqlite3.exe was not found in the downloaded package."
    exit 1
}

# Cleanup
Write-Host "Cleaning up temporary files..."
if (Test-Path -Path $ZipFile) { Remove-Item -Force $ZipFile | Out-Null }
if (Test-Path -Path $ExtractDir) { Remove-Item -Recurse -Force $ExtractDir | Out-Null }

Write-Host "SQLite setup complete!"
