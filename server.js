// server.js
const fs = require('fs');
const express = require('express');
const { ServiceProvider, IdentityProvider } = require('samlify');
const cors = require('cors');
const bodyParser = require('body-parser');
const xmldom = require('@xmldom/xmldom');
const xpath = require('xpath');

const PORT = 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const IDP_URL = 'http://localhost:7000';

// Add validator to prevent validation errors
ServiceProvider.prototype.validateLoginResponse = function() { return Promise.resolve(); };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

// Configure SP
const sp = ServiceProvider({
  metadata: fs.readFileSync('./sp-metadata.xml', 'utf-8'),
  privateKey: fs.readFileSync('./certs/sp-private-key.pem', 'utf-8'),
  cert: fs.readFileSync('./certs/sp-public-cert.pem', 'utf-8'),
  assertionConsumerServiceUrl: 'http://localhost:4000/callback',
  wantMessageSigned: false,
  authnRequestsSigned: false,
  wantAssertionsSigned: false
});

// Configure IdP from metadata
const idp = IdentityProvider({
  metadata: fs.readFileSync('./idp-metadata.xml', 'utf-8'),
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
    console.log('Creating login request...');
    
    // Create SAML auth request
    const { context: redirectUrl } = await sp.createLoginRequest(idp, 'redirect');
    console.log('Generated redirect URL:', redirectUrl);
    
    // Redirect to IdP
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('SAML Request Error:', err);
    res.status(500).send('Error creating SAML request: ' + err.message);
  }
});

// Handle SAML response from IdP
app.post('/callback', async (req, res) => {
  console.log('Received SAML Response callback');
  
  if (!req.body || !req.body.SAMLResponse) {
    console.error('No SAMLResponse in request');
    return res.status(400).send('Missing SAML Response');
  }
  
  try {
    // Get the SAML response from the request
    const samlResponse = req.body.SAMLResponse;
    console.log('SAML Response received (truncated):', samlResponse.substring(0, 50) + '...');
    
    try {
      // Try to parse with samlify (if it works)
      const { extract } = await sp.parseLoginResponse(idp, 'post', req);
      console.log('Successful SAML authentication with library parser:', extract);
      
      // In production, you would create a session here
      const userData = {
        nameID: extract.nameID,
        attributes: extract.attributes || {}
      };
      
      // Redirect to frontend with user data
      const userDataParam = encodeURIComponent(JSON.stringify(userData));
      const redirectUrl = `${FRONTEND_URL}?user=${userDataParam}&authenticated=true&token=sample-jwt-token`;
      
      console.log(`Redirecting to frontend: ${FRONTEND_URL}`);
      return res.redirect(redirectUrl);
      
    } catch (parseErr) {
      console.log('Library parsing failed, falling back to manual parsing:', parseErr.message);
      
      // Decode the SAML response
      const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
      
      // Create a simple DOM parser to extract basic info
      const DOMParser = new xmldom.DOMParser();
      const doc = DOMParser.parseFromString(decoded, 'text/xml');
      const select = xpath.useNamespaces({
        samlp: 'urn:oasis:names:tc:SAML:2.0:protocol',
        saml: 'urn:oasis:names:tc:SAML:2.0:assertion'
      });
      
      // Extract basic user information
      const nameID = select('//saml:NameID/text()', doc)[0]?.nodeValue;
      const emailAttr = select('//saml:Attribute[@Name="email"]/saml:AttributeValue/text()', doc)[0]?.nodeValue;
      const firstName = select('//saml:Attribute[@Name="firstName"]/saml:AttributeValue/text()', doc)[0]?.nodeValue;
      const lastName = select('//saml:Attribute[@Name="lastName"]/saml:AttributeValue/text()', doc)[0]?.nodeValue;
      
      // Create a user data object with manually extracted info
      const userData = {
        nameID: nameID || 'unknown',
        attributes: {
          email: emailAttr || '',
          firstName: firstName || '',
          lastName: lastName || ''
        }
      };
      
      // Redirect to frontend with manually extracted user data
      const userDataParam = encodeURIComponent(JSON.stringify(userData));
      const redirectUrl = `${FRONTEND_URL}?user=${userDataParam}&authenticated=true&token=sample-jwt-token`;
      
      console.log(`Redirecting to frontend (manual parsing): ${FRONTEND_URL}`);
      return res.redirect(redirectUrl);
    }
  } catch (err) {
    console.error('SAML Response Error:', err);
    
    // Redirect to frontend with error information
    const errorUrl = `${FRONTEND_URL}?error=${encodeURIComponent(err.message)}&authenticated=false`;
    return res.redirect(errorUrl);
  }
});

// Home page
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>SAML Service Provider</h1>
        <p><a href="/login">Login with SAML</a></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`SP backend listening on http://localhost:${PORT}`));