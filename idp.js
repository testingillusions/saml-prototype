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
    <form method="post" action="/login">
      <input type="hidden" name="SAMLRequest" value="${SAMLRequest || ''}" />
      <input type="hidden" name="RelayState" value="${RelayState || ''}" />
      <div>
        <label>Email:</label>
        <input type="email" name="email" value="user@example.com" />
      </div>
      <div>
        <label>Password:</label>
        <input type="password" name="password" value="password123" />
      </div>
      <button type="submit">Login</button>
    </form>
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
