require('dotenv').config();
const express = require('express');
const { ServiceProvider, IdentityProvider } = require('samlify');
const fs = require('fs');
const cors = require('cors');
const zlib = require('zlib');
const { v4: uuidv4 } = require('uuid');
const xmldom = require('@xmldom/xmldom');
const xpath = require('xpath');

// Environment variables
const IDP_PORT = process.env.IDP_PORT || 7000;
const IDP_BASE_URL = process.env.IDP_BASE_URL || `http://localhost:${IDP_PORT}`;
const IDP_LOGIN_URL = process.env.IDP_LOGIN_URL || `${IDP_BASE_URL}/login`;

// Service Providers Configuration
const SERVICE_PROVIDERS = JSON.parse(process.env.SERVICE_PROVIDERS || '[{"entityId": "http://localhost:4000", "callbackUrl": "http://localhost:4000/callback", "metadataPath": "./sp-metadata.xml", "privateKeyPath": "./certs/sp-private-key.pem", "publicCertPath": "./certs/sp-public-cert.pem"}]');

// Create a map for quick SP lookup by entity ID
const spMap = new Map();
SERVICE_PROVIDERS.forEach(sp => {
  spMap.set(sp.entityId, sp);
});

// Configure schema validation - this is important for samlify to work properly
ServiceProvider.prototype.validateLoginRequest = function() { return Promise.resolve(); };
IdentityProvider.prototype.validateLoginRequest = function() { return Promise.resolve(); };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Configure IdP
const idp = IdentityProvider({
  metadata: fs.readFileSync(process.env.IDP_METADATA_PATH || './idp-metadata.xml', 'utf-8'),
  privateKey: fs.readFileSync(process.env.IDP_PRIVATE_KEY_PATH || './certs/idp-private-key.pem', 'utf-8'),
  cert: fs.readFileSync(process.env.IDP_PUBLIC_CERT_PATH || './certs/idp-public-cert.pem', 'utf-8'),
  isAssertionEncrypted: false,
  messageSigningOrder: 'sign-then-encrypt'
});

// Configure Service Providers - create SP instances for each configured SP
const spInstances = new Map();
SERVICE_PROVIDERS.forEach(spConfig => {
  try {
    const sp = ServiceProvider({
      metadata: fs.readFileSync(spConfig.metadataPath, 'utf-8'),
      isAssertionEncrypted: false,
      wantMessageSigned: false,
      wantAssertionsSigned: false
    });
    spInstances.set(spConfig.entityId, { sp, config: spConfig });
    console.log(`Configured SP: ${spConfig.entityId}`);
  } catch (err) {
    console.warn(`Failed to configure SP ${spConfig.entityId}:`, err.message);
  }
});

// Function to parse SAML request and extract issuer
function parseSAMLRequest(samlRequest) {
  try {
    let decoded;
    
    console.log('Parsing SAML Request (truncated):', samlRequest.substring(0, 50) + '...');
    
    // First try: decode as base64 and inflate (for Redirect binding)
    try {
      const buffer = Buffer.from(samlRequest, 'base64');
      decoded = zlib.inflateRawSync(buffer).toString('utf-8');
      console.log('Successfully decoded as deflated/base64');
    } catch (inflateErr) {
      console.log('Inflate failed, trying direct base64 decode...');
      // Second try: direct base64 decode (for POST binding)
      try {
        decoded = Buffer.from(samlRequest, 'base64').toString('utf-8');
        console.log('Successfully decoded as direct base64');
      } catch (base64Err) {
        console.log('Base64 decode failed, trying as plain text...');
        // Third try: assume it's already decoded
        decoded = samlRequest;
      }
    }
    
    console.log('Decoded SAML Request (first 200 chars):', decoded.substring(0, 200));
    
    // Parse XML
    const DOMParser = new xmldom.DOMParser();
    const doc = DOMParser.parseFromString(decoded, 'text/xml');
    
    // Check if parsing was successful
    if (!doc || !doc.documentElement) {
      throw new Error('Failed to parse XML - no document element');
    }
    
    // Extract issuer using xpath
    const select = xpath.useNamespaces({
      samlp: 'urn:oasis:names:tc:SAML:2.0:protocol',
      saml: 'urn:oasis:names:tc:SAML:2.0:assertion'
    });
    
    const issuerNode = select('//saml:Issuer/text()', doc)[0];
    const issuer = issuerNode ? issuerNode.nodeValue : null;
    
    const requestIdNode = select('//@ID', doc)[0];
    const requestId = requestIdNode ? requestIdNode.value : null;
    
    console.log(`Parsed SAML Request - Issuer: ${issuer}, RequestID: ${requestId}`);
    
    return { issuer, requestId, decoded };
  } catch (err) {
    console.error('Error parsing SAML request:', err);
    console.error('SAML Request (raw):', samlRequest);
    return null;
  }
}

// Serve IdP metadata
app.get('/metadata', (req, res) => {
  res.type('application/xml');
  res.send(idp.getMetadata());
});

// List configured Service Providers
app.get('/sps', (req, res) => {
  const spList = SERVICE_PROVIDERS.map(sp => ({
    entityId: sp.entityId,
    callbackUrl: sp.callbackUrl,
    configured: spInstances.has(sp.entityId)
  }));
  
  res.json({
    count: spList.length,
    serviceProviders: spList
  });
});

// Login form
app.get('/login', (req, res) => {
  const SAMLRequest = req.query.SAMLRequest;
  const RelayState = req.query.RelayState;
  
  console.log('Received GET login request with SAMLRequest:', SAMLRequest ? 'present' : 'missing');
  
  // If this is a SAML request, try to parse it to get SP info for customized login page
  let requestingSP = null;
  if (SAMLRequest) {
    const parsedRequest = parseSAMLRequest(SAMLRequest);
    if (parsedRequest && parsedRequest.issuer) {
      requestingSP = parsedRequest.issuer;
      console.log(`Login page requested by SP: ${requestingSP}`);
    }
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enterprise Single Sign-On</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                height: 100vh;
                background-color: #000;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1.6;
            }
            .page-container {
                display: flex;
                width: 100%;
                max-width: 1200px;
                height: 80vh;
            }
            .login-container {
                background-color: #fff;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                padding: 40px;
                width: 400px;
                color: #333;
            }
            .branding-container {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: flex-start;
                padding-left: 60px;
            }
            .logo {
                width: 160px;
                margin-bottom: 10px;
            }
            h1 {
                color: #333;
                margin-top: 0;
                font-size: 24px;
                margin-bottom: 30px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
            }
            input {
                width: 100%;
                padding: 12px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 16px;
                box-sizing: border-box;
            }
            button {
                background-color: #e93030;
                color: white;
                padding: 12px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                display: block;
                width: 100%;
                font-size: 16px;
                margin: 20px 0 10px;
                text-align: center;
                font-weight: 600;
            }
            button:hover {
                background-color: #c92020;
            }
            .alt-login {
                display: block;
                width: 100%;
                padding: 12px 15px;
                border: 1px solid #333;
                border-radius: 4px;
                text-align: center;
                margin-top: 15px;
                color: #333;
                text-decoration: none;
                font-weight: 600;
                background-color: #fff;
            }
            .alt-login:hover {
                background-color: #f5f5f5;
            }
            .help-text {
                font-size: 14px;
                color: #666;
                margin-top: 20px;
            }
            .help-link {
                color: #0066cc;
                text-decoration: none;
            }
            .help-link:hover {
                text-decoration: underline;
            }
            .promotional-text {
                font-size: 36px;
                font-weight: 700;
                color: #e93030;
                margin-bottom: 30px;
                line-height: 1.2;
            }
            .promotional-subtext {
                font-size: 18px;
                max-width: 500px;
                margin-bottom: 40px;
            }
            .branding-logo {
                width: 150px;
                margin-top: 40px;
            }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="login-container">
                <svg class="logo" viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="16" fill="#e93030"/>
                    <rect x="45" y="4" width="50" height="10" fill="#333"/>
                    <rect x="45" y="18" width="40" height="4" fill="#333"/>
                    <rect x="45" y="26" width="30" height="4" fill="#333"/>
                </svg>
                <h1>Internal Simulated single sign-on</h1>
                ${requestingSP ? `<p style="color: #666; font-size: 14px;">Requested by: ${requestingSP}</p>` : ''}
                
                <form method="post" action="/login">
                    <input type="hidden" name="SAMLRequest" value="${SAMLRequest || ''}" />
                    <input type="hidden" name="RelayState" value="${RelayState || ''}" />
                    
                    <div class="form-group">
                        <label for="email">Username</label>
                        <input type="email" id="email" name="email" value="user@example.com" placeholder="Enterprise ID" autocomplete="username">
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" value="password123" placeholder="PIN and token" autocomplete="current-password">
                    </div>
                    
                    <button type="submit">Log in to SSO</button>
                    <button type="button" class="alt-login">Log in with 3rd party IdP</button>
                    
                    <p class="help-text">
                        To completely sign out, close your browser or clear your cookies.
                        <a href="#" class="help-link">Need help signing in?</a>
                    </p>
                </form>
            </div>
            
            <div class="branding-container">
                <div class="promotional-text">Make your app<br>Logins Easier</div>
                <div class="promotional-subtext">
                    <p>Enterprise Single Sign-On (SSO) provides a seamless and secure way to access multiple applications with a single set of credentials.</p>
                    <p>Experience the convenience of logging in once and gaining access to all your enterprise applications without repeated authentication.</p>
                </div>
                <svg class="branding-logo" viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="16" fill="#e93030"/>
                    <rect x="45" y="15" width="50" height="10" fill="#fff"/>
                </svg>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Handle login and generate SAML response
app.post('/login', async (req, res) => {
  try {
    const { email, password, SAMLRequest, RelayState } = req.body;
    console.log('Received login request:', { 
      SAMLRequest: SAMLRequest ? 'present' : 'missing', 
      RelayState: RelayState || 'missing' 
    });

    // Verify credentials (in production, you would check against a database)
    if (!SAMLRequest) {
      return res.status(400).send('No SAML request found');
    }

    // Declare userProfile outside the blocks so it's accessible later
    let userProfile;
    
    // Verify credentials and set user profile
    if (email === 'user2@example.com' && password === 'password123') {
      userProfile = {
        id: 'user456',
        email: email,
        firstName: 'Test2',
        lastName: 'User2',
        attributes: {
          email: email,
          firstName: 'Test2',
          lastName: 'User2',
          displayName: 'Test2 User2',
          role: 'user'
        }
      };
    } else if (email === 'user@example.com' && password === 'password123') {
      userProfile = {
        id: 'user123',
        email: email,
        firstName: 'Test',
        lastName: 'User',
        attributes: {
          email: email,
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
          role: 'user'
        }
      };
    } else if (email === 'admin@example.com' && password === 'password123') {
      userProfile = {
        id: 'admin123',
        email: email,
        firstName: 'Admin',
        lastName: 'User',
        attributes: {
          email: email,
          firstName: 'Admin',
          lastName: 'User',
          displayName: 'Admin User',
          role: 'admin'
        }
      };
    } else {
      return res.status(401).send('Invalid credentials');
    }


    try {
      // Parse the SAML request to identify the requesting SP
      const parsedRequest = parseSAMLRequest(SAMLRequest);
      if (!parsedRequest || !parsedRequest.issuer) {
        return res.status(400).send('Invalid SAML request - could not determine issuer');
      }
      
      // Find the SP configuration for this issuer
      const spData = spInstances.get(parsedRequest.issuer);
      if (!spData) {
        return res.status(400).send(`Unknown Service Provider: ${parsedRequest.issuer}`);
      }
      
      console.log(`Processing login for SP: ${parsedRequest.issuer}`);
      
      // Extract SAML request parameters for this specific SP
      const requestParams = {
        id: '_' + uuidv4(),
        assertionConsumerServiceUrl: spData.config.callbackUrl,
        destination: IDP_LOGIN_URL,
        issuer: parsedRequest.issuer,
        inResponseTo: parsedRequest.requestId
      };
      
      // Create SAML response directly
      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
      const responseID = '_' + uuidv4();
      const assertionID = '_' + uuidv4();
      
      // Format dates in the required format
      const issueInstant = now.toISOString();
      const notOnOrAfter = fiveMinutesLater.toISOString();
      
      // Create a direct SAML Response XML
      const samlResponse = Buffer.from(`
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" 
               xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" 
               ID="${responseID}" 
               Version="2.0" 
               IssueInstant="${issueInstant}" 
               Destination="${requestParams.assertionConsumerServiceUrl}"
               ${requestParams.inResponseTo ? `InResponseTo="${requestParams.inResponseTo}"` : ''}>
  <saml:Issuer>${IDP_BASE_URL}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                 xmlns:xs="http://www.w3.org/2001/XMLSchema" 
                 ID="${assertionID}" 
                 Version="2.0" 
                 IssueInstant="${issueInstant}">
    <saml:Issuer>${IDP_BASE_URL}</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}" 
                                     Recipient="${requestParams.assertionConsumerServiceUrl}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${issueInstant}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>${requestParams.issuer}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${issueInstant}" SessionNotOnOrAfter="${notOnOrAfter}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue xsi:type="xs:string">${email}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="firstName">
        <saml:AttributeValue xsi:type="xs:string">${userProfile.firstName}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="lastName">
        <saml:AttributeValue xsi:type="xs:string">${userProfile.lastName}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="displayName">
        <saml:AttributeValue xsi:type="xs:string">${userProfile.firstName} ${userProfile.lastName}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="roles">
        <saml:AttributeValue xsi:type="xs:string">${userProfile.attributes.role}</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
      `).toString('base64');
      
      console.log('Generated SAML Response (truncated):', samlResponse.substring(0, 100) + '...');
      
      // Send auto-submitting form
      res.send(`
        <form method="post" action="${requestParams.assertionConsumerServiceUrl}" id="samlform">
          <input type="hidden" name="SAMLResponse" value="${samlResponse}" />
          <input type="hidden" name="RelayState" value="${RelayState || ''}" />
        </form>
        <script>document.getElementById('samlform').submit();</script>
      `);
    } catch (err) {
      console.error('SAML Error:', err);
      res.status(500).send('SAML Error: ' + err.message);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).send('Internal server error');
  }
});

app.listen(IDP_PORT, () => {
  console.log(`IdP server running at ${IDP_BASE_URL}`);
});
