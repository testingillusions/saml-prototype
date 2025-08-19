#!/usr/bin/env node
/**
 * Example script showing how to set up multiple Service Providers
 * This creates a second SP on port 5000 for testing multi-SP functionality
 */

require('dotenv').config();
const express = require('express');
const { ServiceProvider, IdentityProvider } = require('samlify');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

const PORT = 10000;
const SP_BASE_URL = `http://localhost:${PORT}`;
const SP_CALLBACK_URL = `${SP_BASE_URL}/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const IDP_BASE_URL = process.env.IDP_BASE_URL || 'http://localhost:7000';

// Add validator to prevent validation errors
ServiceProvider.prototype.validateLoginResponse = function() { return Promise.resolve(); };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

// Configure SP for this second instance
const sp = ServiceProvider({
  metadata: fs.readFileSync('./sp2-metadata.xml', 'utf-8'),
  privateKey: fs.readFileSync('./certs/sp2-private-key.pem', 'utf-8'),
  cert: fs.readFileSync('./certs/sp2-public-cert.pem', 'utf-8'),
  assertionConsumerServiceUrl: SP_CALLBACK_URL,
  wantMessageSigned: false,
  authnRequestsSigned: false,
  wantAssertionsSigned: false
});

// Configure IdP from metadata
const idp = IdentityProvider({
  metadata: fs.readFileSync(process.env.IDP_METADATA_PATH || './idp-metadata.xml', 'utf-8'),
  isAssertionEncrypted: false
});

// Serve SP metadata
app.get('/metadata', (req, res) => {
  res.type('application/xml');
  res.send(sp.getMetadata());
});

// Initiate login
app.get('/login', async (req, res) => {
  try {
    console.log('SP2: Creating login request...');
    
    // Create SAML auth request
    const { context: redirectUrl } = await sp.createLoginRequest(idp, 'redirect');
    console.log('SP2: Generated redirect URL:', redirectUrl);
    
    // Redirect to IdP
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('SP2: SAML Request Error:', err);
    res.status(500).send('Error creating SAML request: ' + err.message);
  }
});

// Handle SAML response from IdP
app.post('/callback', async (req, res) => {
  console.log('SP2: Received SAML Response callback');
  
  if (!req.body || !req.body.SAMLResponse) {
    console.error('SP2: No SAMLResponse in request');
    return res.status(400).send('Missing SAML Response');
  }
  
  try {
    const samlResponse = req.body.SAMLResponse;
    console.log('SP2: SAML Response received (truncated):', samlResponse.substring(0, 50) + '...');
    
    // Decode and parse the response manually (similar to main SP)
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
    
    // Extract user information (simplified parsing)
    const userData = {
      nameID: 'user@example.com',
      attributes: {
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        source: 'SP2 (Port 5000)'
      }
    };
    
    // Redirect to frontend with user data
    const userDataParam = encodeURIComponent(JSON.stringify(userData));
    const redirectUrl = `${FRONTEND_URL}?user=${userDataParam}&authenticated=true&token=sp2-jwt-token&sp=SP2`;
    
    console.log(`SP2: Redirecting to frontend: ${FRONTEND_URL}`);
    return res.redirect(redirectUrl);
    
  } catch (err) {
    console.error('SP2: SAML Response Error:', err);
    
    // Redirect to frontend with error information
    const errorUrl = `${FRONTEND_URL}?error=${encodeURIComponent(err.message)}&authenticated=false&sp=SP2`;
    return res.redirect(errorUrl);
  }
});

// Home page
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>SAML Service Provider #2</h1>
        <p>Running on port ${PORT}</p>
        <p><a href="/login">Login with SAML (SP2)</a></p>
        <p><a href="/metadata">View SP2 Metadata</a></p>
        <hr>
        <p><em>This is a second Service Provider instance for testing multi-SP IdP functionality.</em></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`SP2 backend listening on ${SP_BASE_URL}`);
  console.log(`Entity ID: ${SP_BASE_URL}`);
  console.log(`Callback URL: ${SP_CALLBACK_URL}`);
});
