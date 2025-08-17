# PowerShell script to extract certificate content for SAML metadata
# Usage: .\extract-cert-for-metadata.ps1 <certificate-file>
# Example: .\extract-cert-for-metadata.ps1 idp-public-cert.pem

param (
    [Parameter(Mandatory=$true)]
    [string]$CertificateFile
)

if (-not (Test-Path $CertificateFile)) {
    Write-Host "Error: Certificate file '$CertificateFile' not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Extracting certificate content from $CertificateFile for use in SAML metadata..." -ForegroundColor Cyan
Write-Host ""

# Extract certificate fingerprint
$fingerprint = openssl x509 -in $CertificateFile -noout -fingerprint -sha1
Write-Host "Certificate fingerprint: $fingerprint" -ForegroundColor Yellow
Write-Host ""

Write-Host "Certificate details:" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
openssl x509 -in $CertificateFile -text -noout
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

Write-Host "Base64 content for X509Certificate element (copy this to your metadata file):" -ForegroundColor Green
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray

# Read the certificate file and extract just the base64 content
$certContent = Get-Content $CertificateFile | 
    Where-Object { $_ -notmatch "-----BEGIN CERTIFICATE-----" -and $_ -notmatch "-----END CERTIFICATE-----" } |
    ForEach-Object { $_ -replace '\s+', '' }

# Join all lines and output
$base64Content = [string]::Join('', $certContent)
Write-Host $base64Content -ForegroundColor White
Write-Host ""
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
