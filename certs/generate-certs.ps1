# PowerShell script to generate SAML certificates for IdP and SP
# This script generates self-signed certificates suitable for testing
# For production, consider using certificates from a trusted Certificate Authority

# Requires OpenSSL to be installed and available in the PATH
# You can install it via Chocolatey: choco install openssl

Write-Host "Generating new SAML certificates for development use..." -ForegroundColor Yellow
Write-Host "WARNING: These certificates are for development only and should not be used in production." -ForegroundColor Red

# Function to create certificates with proper subject
function New-Certificate {
    param (
        [string]$prefix,
        [string]$cn,
        [string]$org
    )
    
    Write-Host "Generating $prefix certificate with CN=$cn, O=$org" -ForegroundColor Cyan
    
    # Generate private key and certificate
    openssl req -x509 -newkey rsa:2048 `
        -keyout "$prefix-private-key.pem" `
        -out "$prefix-public-cert.pem" `
        -days 365 -nodes `
        -subj "/CN=$cn/O=$org" `
        -sha256
        
    Write-Host "✅ Created $prefix-private-key.pem and $prefix-public-cert.pem" -ForegroundColor Green
    
    # Create a standard format certificate for libraries that need it
    openssl x509 -in "$prefix-public-cert.pem" -out "${prefix}_cert.pem"
    openssl rsa -in "$prefix-private-key.pem" -out "${prefix}_private.key"
    
    Write-Host "✅ Created ${prefix}_cert.pem and ${prefix}_private.key" -ForegroundColor Green
    
    # Output the certificate fingerprint
    Write-Host "Certificate fingerprint (SHA1):" -ForegroundColor Cyan
    openssl x509 -in "$prefix-public-cert.pem" -fingerprint -sha1 -noout
    Write-Host ""
}

# Create backup directory for old certificates
if (-not (Test-Path "backup")) {
    New-Item -ItemType Directory -Path "backup" | Out-Null
}

$current_time = Get-Date -Format "yyyyMMddHHmmss"

# Backup existing certificates if they exist
Write-Host "Backing up any existing certificates..." -ForegroundColor Cyan
$certFiles = @("idp-private-key.pem", "idp-public-cert.pem", "idp_cert.pem", "idp_private.key", 
              "sp-private-key.pem", "sp-public-cert.pem", "sp_cert.pem", "sp_private.key")

foreach ($file in $certFiles) {
    if (Test-Path $file) {
        Copy-Item $file -Destination "backup\$file.$current_time"
        Write-Host "Backed up $file" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Generating IdP (Identity Provider) certificates..." -ForegroundColor Yellow
New-Certificate -prefix "idp" -cn "idp.example.com" -org "Example Identity Provider"

Write-Host ""
Write-Host "Generating SP (Service Provider) certificates..." -ForegroundColor Yellow
New-Certificate -prefix "sp" -cn "sp.example.com" -org "Example Service Provider"

Write-Host ""
Write-Host "Certificate generation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. You must update your metadata files with the new certificate data:" -ForegroundColor White
Write-Host "   - Replace the certificate in idp-metadata.xml with the contents of idp-public-cert.pem" -ForegroundColor White
Write-Host "   - Replace the certificate in sp-metadata.xml with the contents of sp-public-cert.pem" -ForegroundColor White
Write-Host ""
Write-Host "2. To update the metadata files, copy the certificate contents (excluding the" -ForegroundColor White
Write-Host "   BEGIN CERTIFICATE and END CERTIFICATE lines) and replace the existing" -ForegroundColor White
Write-Host "   certificate data in the X509Certificate elements of the metadata files." -ForegroundColor White
Write-Host ""
Write-Host "Note: This script requires OpenSSL to be installed and available in your PATH." -ForegroundColor Cyan
Write-Host "If you don't have OpenSSL installed, you can install it using Chocolatey:" -ForegroundColor Cyan
Write-Host "choco install openssl" -ForegroundColor Gray
