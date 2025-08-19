# SAML Authentication Prototype

A working prototype demonstrating SAML authentication flow between a Service Provider (SP), Identity Provider (IdP), and a frontend application.

## Architecture

This project consists of three components:

1. **Service Provider (SP)** - An Express server running on port 4000
2. **Identity Provider (IdP)** - An Express server running on port 7000
3. **Frontend** - A simple web application served on port 3000

## Getting Started

### Prerequisites

- Node.js (v14+ recommended)
- npm

### Installation

```bash
npm install
```

### Environment Configuration

This project uses environment variables for configuration. Follow these steps to set up:

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file** with your desired configuration:
   ```
   # Service Provider (SP) Configuration
   SP_PORT=4000
   SP_BASE_URL=http://localhost:4000
   SP_CALLBACK_URL=http://localhost:4000/callback

   # Identity Provider (IdP) Configuration  
   IDP_PORT=7000
   IDP_BASE_URL=http://localhost:7000
   IDP_LOGIN_URL=http://localhost:7000/login

   # Frontend Configuration
   FRONTEND_URL=http://localhost:3000

   # Certificate paths (relative to project root)
   SP_PRIVATE_KEY_PATH=./certs/sp-private-key.pem
   SP_PUBLIC_CERT_PATH=./certs/sp-public-cert.pem
   IDP_PRIVATE_KEY_PATH=./certs/idp-private-key.pem
   IDP_PUBLIC_CERT_PATH=./certs/idp-public-cert.pem

   # Metadata file paths (relative to project root)
   SP_METADATA_PATH=./sp-metadata.xml
   IDP_METADATA_PATH=./idp-metadata.xml
   ```

3. **Generate metadata files** that match your environment variables:
   ```bash
   npm run generate-metadata
   ```

### Running the Application

Start each component in separate terminals:

1. **Identity Provider (IdP)**:
   ```bash
   npm run start:idp
   # or
   node idp.js
   ```

2. **Service Provider (SP)**:
   ```bash
   npm run start:sp
   # or  
   node server.js
   ```

3. **Frontend**:
   ```bash
   npx http-server -p 3000
   ```

Visit http://localhost:3000 in your browser to access the frontend.

**Note:** If you change any URLs in your `.env` file, make sure to run `npm run generate-metadata` again to update the metadata files accordingly.

### Multi-SP Testing

To test with multiple Service Providers:

1. **Start the IdP**: `npm run start:idp`
2. **Start SP1**: `npm run start:sp` (port 8000)
3. **Start SP2**: `npm run start:sp2` (port 10000)
4. **Start Frontend**: `npx http-server -p 9000`

Test each SP:
- Visit `http://localhost:8000` → Click "Login with SAML"
- Visit `http://localhost:10000` → Click "Login with SAML" 

Both should redirect to the same IdP login page, but the IdP will know which SP made the request and redirect back to the correct application after authentication.

### User Accounts

The IdP includes multiple test user accounts:

| Username | Password | Role | Display Name |
|----------|----------|------|--------------|
| `user@example.com` | `password123` | user | Test User |
| `user2@example.com` | `password123` | user | Test2 User2 |
| `admin@example.com` | `password123` | admin | Admin User |

Each user has different attributes that will be included in the SAML assertion.

## SAML Flow

1. User clicks "Login" on the frontend
2. Frontend redirects to the SP's login endpoint
3. SP generates a SAML request and redirects to the IdP
4. IdP automatically detects which SP made the request by parsing the SAML request
5. IdP displays the login form with SP identification
6. User authenticates with their credentials
7. IdP generates a SAML response with user attributes and roles
8. IdP posts the SAML response back to the requesting SP
9. SP validates the response and extracts user data
10. SP redirects to the frontend with user data
11. Frontend displays the authenticated user's information and attributes

### Enhanced SAML Processing

This implementation includes advanced SAML features:

- **Multi-binding Support**: Handles both HTTP-Redirect (deflated) and HTTP-POST (base64) SAML requests
- **Dynamic SP Detection**: Automatically identifies the requesting Service Provider from SAML requests
- **Attribute Mapping**: Supports custom user attributes including roles and display names
- **Error Handling**: Graceful fallback parsing when standard libraries fail

## Technologies

- Node.js and Express for both SP and IdP servers
- samlify library for SAML implementation
- zlib for compression/decompression
- xmldom and xpath for XML parsing

## Folder Structure

- `server.js` - Service Provider implementation
- `idp.js` - Identity Provider implementation
- `index.html` - Frontend application
- `generate-metadata.js` - Script to generate metadata files dynamically
- `.env.example` - Example environment variables file
- `certs/` - Contains SAML certificates
- `*.xml` - SAML metadata files

## Multi-Service Provider Support

This IdP supports multiple Service Providers simultaneously. Each SP can be a different application that needs SAML authentication.

### Current Port Assignment
- **7000** - Identity Provider (IdP)
- **8000** - Service Provider 1 (SP1) 
- **9000** - Frontend HTTP Server
- **10000** - Service Provider 2 (SP2)

### Adding a New Service Provider

To add a new Service Provider to your SAML setup:

#### 1. Generate Certificates for the New SP

```bash
# Replace 'sp3' with your SP identifier and '11000' with your chosen port
openssl req -x509 -newkey rsa:2048 -keyout ./certs/sp3-private-key.pem -out ./certs/sp3-public-cert.pem -days 365 -nodes -subj "/CN=localhost"
```

#### 2. Create Metadata for the New SP

Create a metadata file (e.g., `sp3-metadata.xml`):

```xml
<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="http://localhost:11000">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>
            [Your base64-encoded certificate content here]
          </X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <AssertionConsumerService index="1"
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="http://localhost:11000/callback"/>
  </SPSSODescriptor>
</EntityDescriptor>
```

#### 3. Update Environment Configuration

Add the new SP to your `.env` file's `SERVICE_PROVIDERS` array:

```env
SERVICE_PROVIDERS=[
  {"entityId": "http://localhost:8000", "callbackUrl": "http://localhost:8000/callback", "metadataPath": "./sp-metadata.xml", "privateKeyPath": "./certs/sp-private-key.pem", "publicCertPath": "./certs/sp-public-cert.pem"},
  {"entityId": "http://localhost:10000", "callbackUrl": "http://localhost:10000/callback", "metadataPath": "./sp2-metadata.xml", "privateKeyPath": "./certs/sp2-private-key.pem", "publicCertPath": "./certs/sp2-public-cert.pem"},
  {"entityId": "http://localhost:11000", "callbackUrl": "http://localhost:11000/callback", "metadataPath": "./sp3-metadata.xml", "privateKeyPath": "./certs/sp3-private-key.pem", "publicCertPath": "./certs/sp3-public-cert.pem"}
]
```

#### 4. Create SP Application

Create a new SP application (similar to `multi-sp-example.js`) or integrate SAML into your existing application:

```javascript
const express = require('express');
const { ServiceProvider, IdentityProvider } = require('samlify');
const fs = require('fs');

const PORT = 11000; // Your chosen port
const SP_BASE_URL = `http://localhost:${PORT}`;

const sp = ServiceProvider({
  metadata: fs.readFileSync('./sp3-metadata.xml', 'utf-8'),
  privateKey: fs.readFileSync('./certs/sp3-private-key.pem', 'utf-8'),
  cert: fs.readFileSync('./certs/sp3-public-cert.pem', 'utf-8'),
  assertionConsumerServiceUrl: `${SP_BASE_URL}/callback`
});

// ... rest of your SP implementation
```

#### 5. Test the New SP

1. Restart the IdP: `npm run start:idp`
2. Start your new SP: `node your-sp3-server.js`
3. Verify configuration: `curl http://localhost:7000/sps`
4. Test login: Visit `http://localhost:11000` and click login

### Quick Setup for Testing

Use the automated setup script:

```bash
# This creates SP2 on port 10000 as an example
npm run setup:multi-sp
```

## Environment Variables

The following environment variables are supported:

| Variable | Description | Default |
|----------|-------------|---------|
| `SP_PORT` | Service Provider 1 port | `8000` |
| `SP_BASE_URL` | Service Provider 1 base URL | `http://localhost:8000` |
| `SP_CALLBACK_URL` | Service Provider 1 callback URL | `http://localhost:8000/callback` |
| `IDP_PORT` | Identity Provider port | `7000` |
| `IDP_BASE_URL` | Identity Provider base URL | `http://localhost:7000` |
| `IDP_LOGIN_URL` | Identity Provider login URL | `http://localhost:7000/login` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:9000` |
| `SERVICE_PROVIDERS` | JSON array of SP configurations | See multi-SP section |
| `SP_PRIVATE_KEY_PATH` | Path to SP1 private key | `./certs/sp-private-key.pem` |
| `SP_PUBLIC_CERT_PATH` | Path to SP1 public certificate | `./certs/sp-public-cert.pem` |
| `IDP_PRIVATE_KEY_PATH` | Path to IdP private key | `./certs/idp-private-key.pem` |
| `IDP_PUBLIC_CERT_PATH` | Path to IdP public certificate | `./certs/idp-public-cert.pem` |
| `SP_METADATA_PATH` | Path to SP1 metadata file | `./sp-metadata.xml` |
| `IDP_METADATA_PATH` | Path to IdP metadata file | `./idp-metadata.xml` |

## Security Notes

### Certificates

**⚠️ IMPORTANT:** The certificates included in the `certs/` directory are for **demonstration purposes only**. 
Never use these certificates in a production environment as they are publicly available in this repository.

#### Generating New Certificates

To generate new certificates for your implementation:

1. **For Linux/MacOS users**, use the provided bash script:
   ```bash
   cd certs
   chmod +x generate-certs.sh
   ./generate-certs.sh
   ```
   
2. **For Windows users**, use the PowerShell script:
   ```powershell
   cd certs
   .\generate-certs.ps1
   ```

3. **Manual generation** using OpenSSL:
   ```bash
   # Generate private key and self-signed certificate for IdP
   openssl req -x509 -newkey rsa:2048 -keyout idp-private-key.pem -out idp-public-cert.pem -days 365 -nodes
   
   # Generate private key and self-signed certificate for SP
   openssl req -x509 -newkey rsa:2048 -keyout sp-private-key.pem -out sp-public-cert.pem -days 365 -nodes
   ```

#### Updating Metadata Files

After generating new certificates, the metadata files will be automatically updated when you run:

```bash
npm run generate-metadata
```

This script reads your environment variables and certificate files to generate the metadata files dynamically.

**Manual Certificate Extraction (Optional)**

If you need to manually extract certificate content for other purposes:
   
**For Linux/MacOS:**
```bash
cd certs
chmod +x extract-cert-for-metadata.sh
./extract-cert-for-metadata.sh idp-public-cert.pem  # For IdP
./extract-cert-for-metadata.sh sp-public-cert.pem   # For SP
```

**For Windows:**
```powershell
cd certs
.\extract-cert-for-metadata.ps1 idp-public-cert.pem  # For IdP
.\extract-cert-for-metadata.ps1 sp-public-cert.pem   # For SP
```

For production deployments, consider using certificates issued by a trusted Certificate Authority.

## Troubleshooting

### Common Issues

#### "Unexpected end of JSON input" Error

**Problem**: IdP fails to start with JSON parsing error.

**Cause**: The `SERVICE_PROVIDERS` environment variable in `.env` is formatted across multiple lines.

**Solution**: Ensure `SERVICE_PROVIDERS` is on a single line in your `.env` file:
```env
SERVICE_PROVIDERS=[{"entityId": "http://localhost:8000", "callbackUrl": "http://localhost:8000/callback", "metadataPath": "./sp-metadata.xml", "privateKeyPath": "./certs/sp-private-key.pem", "publicCertPath": "./certs/sp-public-cert.pem"}]
```

#### "userProfile is not defined" Error

**Problem**: SAML response generation fails with undefined userProfile.

**Cause**: Variable scope issue in user authentication logic.

**Solution**: Ensure `userProfile` is declared with `let` outside conditional blocks:
```javascript
let userProfile;
if (email === 'user@example.com' && password === 'password123') {
  userProfile = { /* user data */ };
}
```

#### "Unknown Service Provider" Error

**Problem**: IdP rejects SAML requests from configured SPs.

**Cause**: SP not properly configured or metadata mismatch.

**Solution**: 
1. Verify SP is listed: `curl http://localhost:7000/sps`
2. Check entity IDs match between SP config and metadata
3. Ensure SP metadata file exists and is readable

#### SAML Request Parsing Errors

**Problem**: "missing root element" or XML parsing errors.

**Cause**: SAML requests may be compressed/deflated (common with Redirect binding).

**Solution**: The implementation automatically handles multiple formats:
- Deflated + Base64 (HTTP-Redirect binding)
- Direct Base64 (HTTP-POST binding)
- Plain text (fallback)

### Debugging Tips

1. **Check SP Configuration**: `curl http://localhost:7000/sps`
2. **View IdP Logs**: Look for "Parsed SAML Request" and "Processing login for SP" messages
3. **Verify Certificates**: Ensure certificate files exist and are readable
4. **Test Authentication**: Use browser developer tools to inspect SAML request/response flow

### User Attribute Reference

The SAML response includes these attributes:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `email` | User's email address | `user@example.com` |
| `firstName` | User's first name | `Test` |
| `lastName` | User's last name | `User` |
| `displayName` | Full display name | `Test User` |
| `roles` | User's role/permissions | `admin`, `user` |

## Recent Updates

### v2.0 Features
- ✅ **Multi-Service Provider Support**: Single IdP can serve multiple applications
- ✅ **Enhanced SAML Parsing**: Handles compressed and deflated requests
- ✅ **Multi-User Authentication**: Support for multiple test users with different roles
- ✅ **Dynamic SP Detection**: Automatic identification of requesting Service Provider
- ✅ **Role-Based Attributes**: User roles included in SAML assertions
- ✅ **Environment-Driven Configuration**: Flexible port and URL configuration
- ✅ **Improved Error Handling**: Better debugging and error messages

## License

MIT
