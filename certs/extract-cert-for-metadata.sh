#!/bin/bash

# Script to extract certificate content for SAML metadata
# Usage: ./extract-cert-for-metadata.sh <certificate-file>
# Example: ./extract-cert-for-metadata.sh idp-public-cert.pem

if [ $# -ne 1 ]; then
  echo "Usage: $0 <certificate-file>"
  echo "Example: $0 idp-public-cert.pem"
  exit 1
fi

CERT_FILE=$1

if [ ! -f "$CERT_FILE" ]; then
  echo "Error: Certificate file '$CERT_FILE' not found!"
  exit 1
fi

echo "Extracting certificate content from $CERT_FILE for use in SAML metadata..."
echo ""

# Extract certificate content without BEGIN/END lines and remove whitespace
CERT_CONTENT=$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha1 | grep -i "SHA1 Fingerprint")
echo "Certificate fingerprint: $CERT_CONTENT"
echo ""

echo "Certificate content for metadata:"
echo "--------------------------------------------------------------------------------"
openssl x509 -in "$CERT_FILE" -text -noout | grep -v "Certificate:"
echo "--------------------------------------------------------------------------------"
echo ""

echo "Base64 content for X509Certificate element (copy this to your metadata file):"
echo "--------------------------------------------------------------------------------"
cat "$CERT_FILE" | grep -v -e "-----BEGIN CERTIFICATE-----" -e "-----END CERTIFICATE-----" | tr -d '\n'
echo ""
echo "--------------------------------------------------------------------------------"
