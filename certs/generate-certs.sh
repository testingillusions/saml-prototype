#!/bin/bash

# Script to generate SAML certificates for IdP and SP
# This script generates self-signed certificates suitable for testing
# For production, consider using certificates from a trusted Certificate Authority

echo "Generating new SAML certificates for development use..."
echo "WARNING: These certificates are for development only and should not be used in production."

# Function to create certificates with proper subject
generate_cert() {
  local prefix=$1
  local cn=$2
  local org=$3
  
  echo "Generating $prefix certificate with CN=$cn, O=$org"
  
  # Generate private key and certificate
  openssl req -x509 -newkey rsa:2048 \
    -keyout "${prefix}-private-key.pem" \
    -out "${prefix}-public-cert.pem" \
    -days 365 -nodes \
    -subj "/CN=$cn/O=$org" \
    -sha256
    
  echo "✅ Created ${prefix}-private-key.pem and ${prefix}-public-cert.pem"
  
  # Create a standard format certificate for libraries that need it
  openssl x509 -in "${prefix}-public-cert.pem" -out "${prefix}_cert.pem"
  openssl rsa -in "${prefix}-private-key.pem" -out "${prefix}_private.key"
  
  echo "✅ Created ${prefix}_cert.pem and ${prefix}_private.key"
  
  # Output the certificate fingerprint
  echo "Certificate fingerprint (SHA1):"
  openssl x509 -in "${prefix}-public-cert.pem" -fingerprint -sha1 -noout
  echo ""
}

# Create backup directory for old certificates
mkdir -p backup
current_time=$(date +"%Y%m%d%H%M%S")

# Backup existing certificates if they exist
echo "Backing up any existing certificates..."
for file in *-private-key.pem *-public-cert.pem *_cert.pem *_private.key; do
  if [ -f "$file" ]; then
    cp "$file" "backup/${file}.${current_time}"
    echo "Backed up $file"
  fi
done

echo ""
echo "Generating IdP (Identity Provider) certificates..."
generate_cert "idp" "idp.example.com" "Example Identity Provider"

echo ""
echo "Generating SP (Service Provider) certificates..."
generate_cert "sp" "sp.example.com" "Example Service Provider"

echo ""
echo "Certificate generation complete!"
echo ""
echo "NEXT STEPS:"
echo "1. You must update your metadata files with the new certificate data:"
echo "   - Replace the certificate in idp-metadata.xml with the contents of idp-public-cert.pem"
echo "   - Replace the certificate in sp-metadata.xml with the contents of sp-public-cert.pem"
echo ""
echo "2. To update the metadata files, copy the certificate contents (excluding the"
echo "   BEGIN CERTIFICATE and END CERTIFICATE lines) and replace the existing"
echo "   certificate data in the X509Certificate elements of the metadata files."
echo ""
echo "For Windows users: If running in PowerShell or CMD, use the equivalent OpenSSL commands or"
echo "consider using WSL (Windows Subsystem for Linux) to run this script."
