#!/usr/bin/env node
/**
 * Setup script for multi-SP demonstration
 * This generates certificates and metadata for a second SP
 */

require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

console.log('Setting up multi-SP demonstration...\n');

// 1. Generate certificates for SP2 if they don't exist
console.log('1. Checking certificates for SP2...');
if (!fs.existsSync('./certs/sp2-private-key.pem') || !fs.existsSync('./certs/sp2-public-cert.pem')) {
  console.log('   Generating SP2 certificates...');
  try {
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout ./certs/sp2-private-key.pem -out ./certs/sp2-public-cert.pem -days 365 -nodes -subj "/CN=localhost"`, 
      { stdio: 'inherit' });
    console.log('   ✓ SP2 certificates generated');
  } catch (err) {
    console.error('   ✗ Failed to generate SP2 certificates:', err.message);
    console.log('   Please generate certificates manually or ensure OpenSSL is installed');
  }
} else {
  console.log('   ✓ SP2 certificates already exist');
}

// 2. Generate SP2 metadata
console.log('\n2. Generating SP2 metadata...');
const sp2Cert = fs.readFileSync('./certs/sp2-public-cert.pem', 'utf-8')
  .replace(/-----BEGIN CERTIFICATE-----/, '')
  .replace(/-----END CERTIFICATE-----/, '')
  .replace(/\n/g, '');

const sp2Metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="http://localhost:10000">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>
            ${sp2Cert}
          </X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <AssertionConsumerService index="1"
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="http://localhost:10000/callback"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

fs.writeFileSync('./sp2-metadata.xml', sp2Metadata);
console.log('   ✓ SP2 metadata generated: sp2-metadata.xml');

// 3. Update package.json scripts
console.log('\n3. Adding SP2 scripts to package.json...');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts['start:sp2'] = 'node multi-sp-example.js';
packageJson.scripts['setup:multi-sp'] = 'node setup-multi-sp.js';

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));
console.log('   ✓ Added scripts: start:sp2, setup:multi-sp');

// 4. Show example environment configuration
console.log('\n4. Example .env configuration for multi-SP:');
console.log(`
# Add this to your .env file to configure multiple SPs:
SERVICE_PROVIDERS=[
  {
    "entityId": "http://localhost:8000",
    "callbackUrl": "http://localhost:8000/callback",
    "metadataPath": "./sp-metadata.xml",
    "privateKeyPath": "./certs/sp-private-key.pem",
    "publicCertPath": "./certs/sp-public-cert.pem"
  },
  {
    "entityId": "http://localhost:10000",
    "callbackUrl": "http://localhost:10000/callback", 
    "metadataPath": "./sp2-metadata.xml",
    "privateKeyPath": "./certs/sp2-private-key.pem",
    "publicCertPath": "./certs/sp2-public-cert.pem"
  }
]
`);

console.log('\n✅ Multi-SP setup complete!');
console.log('\nTo test multi-SP functionality:');
console.log('1. Update your .env file with the SERVICE_PROVIDERS configuration above');
console.log('2. Start the IdP: npm run start:idp');
console.log('3. Start SP1: npm run start:sp');
console.log('4. Start SP2: npm run start:sp2');
console.log('5. Start Frontend: npx http-server -p 9000');
console.log('6. Visit http://localhost:8000 and http://localhost:10000 to test');
console.log('7. Check configured SPs: curl http://localhost:7000/sps');
