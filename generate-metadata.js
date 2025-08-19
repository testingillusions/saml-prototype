#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');

// Get environment variables with fallbacks
const SP_BASE_URL = process.env.SP_BASE_URL || 'http://localhost:4000';
const SP_CALLBACK_URL = process.env.SP_CALLBACK_URL || `${SP_BASE_URL}/callback`;
const IDP_BASE_URL = process.env.IDP_BASE_URL || 'http://localhost:7000';
const IDP_LOGIN_URL = process.env.IDP_LOGIN_URL || `${IDP_BASE_URL}/login`;

// Read the certificate content from the certificate files
const spCert = fs.readFileSync(process.env.SP_PUBLIC_CERT_PATH || './certs/chatbot-public-cert.pem', 'utf-8')
  .replace(/-----BEGIN CERTIFICATE-----/, '')
  .replace(/-----END CERTIFICATE-----/, '')
  .replace(/\n/g, '');

const idpCert = fs.readFileSync(process.env.IDP_PUBLIC_CERT_PATH || './certs/idp-public-cert.pem', 'utf-8')
  .replace(/-----BEGIN CERTIFICATE-----/, '')
  .replace(/-----END CERTIFICATE-----/, '')
  .replace(/\n/g, '');

// Generate SP metadata
const spMetadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${SP_BASE_URL}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>
            ${spCert}
          </X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <AssertionConsumerService index="1"
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${SP_CALLBACK_URL}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

// Generate IdP metadata
const idpMetadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${IDP_BASE_URL}">
    <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <KeyDescriptor use="signing">
            <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
                <X509Data>
                    <X509Certificate>
                        ${idpCert}
                    </X509Certificate>
                </X509Data>
            </KeyInfo>
        </KeyDescriptor>
        <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                           Location="${IDP_LOGIN_URL}"/>
        <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                           Location="${IDP_LOGIN_URL}"/>
    </IDPSSODescriptor>
</EntityDescriptor>`;

// Write the metadata files
fs.writeFileSync(process.env.SP_METADATA_PATH || './chatbot-metadata.xml', spMetadata);
fs.writeFileSync(process.env.IDP_METADATA_PATH || './idp-metadata.xml', idpMetadata);

console.log('Metadata files generated successfully!');
console.log(`SP metadata: ${process.env.SP_METADATA_PATH || './chatbot-metadata.xml'}`);
console.log(`IdP metadata: ${process.env.IDP_METADATA_PATH || './idp-metadata.xml'}`);
