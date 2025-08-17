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

### Running the Application

Start each component in separate terminals:

1. **Identity Provider (IdP)**:
```bash
node idp.js
```

2. **Service Provider (SP)**:
```bash
node server.js
```

3. **Frontend**:
```bash
npx http-server -p 3000
```

Visit http://localhost:3000 in your browser to access the frontend.

## SAML Flow

1. User clicks "Login" on the frontend
2. Frontend redirects to the SP's login endpoint
3. SP generates a SAML request and redirects to the IdP
4. IdP authenticates the user and generates a SAML response
5. IdP posts the SAML response back to the SP
6. SP validates the response and creates a session
7. SP redirects to the frontend with user data
8. Frontend displays the authenticated user's information

## Technologies

- Node.js and Express for both SP and IdP servers
- samlify library for SAML implementation
- zlib for compression/decompression
- xmldom and xpath for XML parsing

## Folder Structure

- `server.js` - Service Provider implementation
- `idp.js` - Identity Provider implementation
- `index.html` - Frontend application
- `certs/` - Contains SAML certificates
- `*.xml` - SAML metadata files

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

After generating new certificates, you need to update the metadata files:

1. Extract the certificate content in the correct format:
   
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

2. Replace the certificate data in the metadata files:
   - Update the `X509Certificate` element in `idp-metadata.xml` with the extracted content from `idp-public-cert.pem`
   - Update the `X509Certificate` element in `sp-metadata.xml` with the extracted content from `sp-public-cert.pem`

For production deployments, consider using certificates issued by a trusted Certificate Authority.

## License

MIT
