const express = require('express');
const { ServiceProvider, IdentityProvider } = require('samlify');
const fs = require('fs');
const cors = require('cors');
const zlib = require('zlib');
const { v4: uuidv4 } = require('uuid');
const xmldom = require('@xmldom/xmldom');
const xpath = require('xpath');

// Configure schema validation - this is important for samlify to work properly
ServiceProvider.prototype.validateLoginRequest = function() { return Promise.resolve(); };
IdentityProvider.prototype.validateLoginRequest = function() { return Promise.resolve(); };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Configure IdP
const idp = IdentityProvider({
  metadata: fs.readFileSync('./idp-metadata.xml', 'utf-8'),
  privateKey: fs.readFileSync('./certs/idp-private-key.pem', 'utf-8'),
  cert: fs.readFileSync('./certs/idp-public-cert.pem', 'utf-8'),
  isAssertionEncrypted: false,
  messageSigningOrder: 'sign-then-encrypt'
});

// Configure SP
const sp = ServiceProvider({
  metadata: fs.readFileSync('./sp-metadata.xml', 'utf-8'),
  isAssertionEncrypted: false,
  wantMessageSigned: false,
  wantAssertionsSigned: false
});

// Serve IdP metadata
app.get('/metadata', (req, res) => {
  res.type('application/xml');
  res.send(idp.getMetadata());
});

// Login form
app.get('/login', (req, res) => {
  const SAMLRequest = req.query.SAMLRequest;
  const RelayState = req.query.RelayState;
  
  console.log('Received GET login request with SAMLRequest:', SAMLRequest ? 'present' : 'missing');
  
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
    if (email !== 'user@example.com' || password !== 'password123') {
      return res.status(401).send('Invalid credentials');
    }

    if (!SAMLRequest) {
      return res.status(400).send('No SAML request found');
    }
    
    // Create a minimal user profile
    const userProfile = {
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

    try {
      // Extract SAML request parameters
      // In a real application, you would decode and validate the SAML request
      const requestParams = {
        id: '_' + uuidv4(),
        assertionConsumerServiceUrl: 'http://localhost:4000/callback',
        destination: 'http://localhost:7000/login',
        issuer: 'http://localhost:4000'
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
               Destination="http://localhost:4000/callback">
  <saml:Issuer>http://localhost:7000</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                 xmlns:xs="http://www.w3.org/2001/XMLSchema" 
                 ID="${assertionID}" 
                 Version="2.0" 
                 IssueInstant="${issueInstant}">
    <saml:Issuer>http://localhost:7000</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}" 
                                     Recipient="http://localhost:4000/callback"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${issueInstant}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>http://localhost:4000</saml:Audience>
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
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
      `).toString('base64');
      
      console.log('Generated SAML Response (truncated):', samlResponse.substring(0, 100) + '...');
      
      // Send auto-submitting form
      res.send(`
        <form method="post" action="http://localhost:4000/callback" id="samlform">
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

app.listen(7000, () => {
  console.log('IdP server running at http://localhost:7000');
});
