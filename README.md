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

## License

MIT
