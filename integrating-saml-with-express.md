# Integrating SAML Authentication with Node.js Express Applications

This guide demonstrates how to integrate SAML (Security Assertion Markup Language) authentication into a Node.js Express application, based on our working prototype.

## Table of Contents
- [1. Setup and Configuration](#1-setup-and-configuration)
- [2. Integration in Your Express Application](#2-integration-in-your-express-application)
- [3. Best Practices for Production](#3-best-practices-for-production)
- [4. Frontend Integration](#4-frontend-integration)
- [5. Testing and Troubleshooting](#5-testing-and-troubleshooting)

## 1. Setup and Configuration

### Authentication Middleware

```javascript
// auth/saml-middleware.js
const { ServiceProvider, IdentityProvider } = require('samlify');
const fs = require('fs');
const session = require('express-session');

// Configure SAML entities
const sp = ServiceProvider({
  metadata: fs.readFileSync('./path/to/sp-metadata.xml', 'utf-8'),
  privateKey: fs.readFileSync('./path/to/sp-private-key.pem', 'utf-8'),
  cert: fs.readFileSync('./path/to/sp-public-cert.pem', 'utf-8'),
  assertionConsumerServiceUrl: 'https://your-app.com/api/auth/saml/callback',
  wantMessageSigned: true,
  authnRequestsSigned: true
});

const idp = IdentityProvider({
  metadata: fs.readFileSync('./path/to/idp-metadata.xml', 'utf-8')
});

// Authentication middleware
function requireAuthentication(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/api/auth/saml/login');
}

module.exports = { sp, idp, requireAuthentication };
```

### Routes Configuration

```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const { sp, idp } = require('../auth/saml-middleware');

// Initiate SAML login
router.get('/saml/login', async (req, res) => {
  try {
    const { context: redirectUrl } = await sp.createLoginRequest(idp, 'redirect');
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('SAML Login Error:', err);
    return res.status(500).send('Authentication error');
  }
});

// Handle SAML response
router.post('/saml/callback', async (req, res) => {
  if (!req.body || !req.body.SAMLResponse) {
    return res.status(400).send('Invalid SAML response');
  }
  
  try {
    // Parse SAML response
    const { extract } = await sp.parseLoginResponse(idp, 'post', req);
    
    // Create user session
    req.session.user = {
      id: extract.nameID,
      email: extract.attributes.email || extract.nameID,
      firstName: extract.attributes.firstName || '',
      lastName: extract.attributes.lastName || '',
      roles: extract.attributes.roles || []
    };
    
    // Redirect to app dashboard
    res.redirect('/dashboard');
  } catch (err) {
    console.error('SAML Callback Error:', err);
    res.status(401).send('Authentication failed');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
```

## 2. Integration in Your Express Application

```javascript
// app.js
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const { requireAuthentication } = require('./auth/saml-middleware');

const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Public routes
app.use('/api/auth', authRoutes);
app.get('/', (req, res) => {
  res.send('Welcome to our application');
});

// Protected routes
app.use('/dashboard', requireAuthentication, (req, res) => {
  res.send(`Welcome, ${req.session.user.firstName}! You are logged in.`);
});

app.use('/api/protected', requireAuthentication, (req, res) => {
  // Your protected API endpoints
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## 3. Best Practices for Production

### Security Considerations

- **Store Certificates Securely**: In production, don't hardcode paths to certificates. Use environment variables or a secure vault.
- **Enable Signature Verification**: Set `wantMessageSigned` and `authnRequestsSigned` to true.
- **Use HTTPS**: Always use HTTPS in production.
- **Secure Session Storage**: Use Redis or another production-ready session store instead of the default memory store.

```javascript
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true }
}));
```

### User Management

```javascript
// services/user-service.js
async function findOrCreateUser(samlUser) {
  // Check if user exists in your database
  let user = await User.findOne({ email: samlUser.email });
  
  if (!user) {
    // Create new user if they don't exist
    user = await User.create({
      email: samlUser.email,
      firstName: samlUser.firstName,
      lastName: samlUser.lastName,
      // Map SAML roles to your application roles
      roles: mapSamlRolesToAppRoles(samlUser.roles)
    });
  }
  
  // Update last login time
  user.lastLogin = new Date();
  await user.save();
  
  return user;
}
```

### Role-Based Access Control

```javascript
// middleware/rbac.js
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).send('Unauthorized');
    }
    
    if (!req.session.user.roles.includes(role)) {
      return res.status(403).send('Forbidden');
    }
    
    next();
  };
}

// Usage
app.get('/admin/dashboard', requireAuthentication, requireRole('admin'), (req, res) => {
  res.send('Admin Dashboard');
});
```

### Error Handling

```javascript
// middleware/error-handler.js
function errorHandler(err, req, res, next) {
  console.error('Application Error:', err);
  
  // SAML specific errors
  if (err.message && err.message.includes('SAML')) {
    return res.status(401).render('error', { 
      message: 'Authentication failed. Please try again.' 
    });
  }
  
  // General error
  res.status(500).render('error', { 
    message: 'An unexpected error occurred' 
  });
}

// Add to your app
app.use(errorHandler);
```

### Environment Configuration

```javascript
// config/saml.js
module.exports = {
  development: {
    callbackUrl: 'http://localhost:3000/api/auth/saml/callback',
    spEntityId: 'http://localhost:3000',
    idpMetadataPath: './config/idp-metadata.xml'
  },
  production: {
    callbackUrl: process.env.SAML_CALLBACK_URL,
    spEntityId: process.env.SAML_SP_ENTITY_ID,
    idpMetadataPath: process.env.SAML_IDP_METADATA_PATH
  }
}[process.env.NODE_ENV || 'development'];
```

## 4. Frontend Integration

### React Example

```jsx
// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await axios.get('/api/auth/user');
        setUser(res.data);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = () => {
    window.location.href = '/api/auth/saml/login';
  };

  const logout = async () => {
    await axios.get('/api/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Login Button Component

```jsx
// src/components/LoginButton.js
import { useAuth } from '../contexts/AuthContext';

function LoginButton() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return <button disabled>Loading...</button>;
  }

  if (user) {
    return (
      <div>
        <span>Welcome, {user.firstName}!</span>
        <button onClick={logout}>Log out</button>
      </div>
    );
  }

  return <button onClick={login}>Login with SSO</button>;
}
```

## 5. Testing and Troubleshooting

### Creating Test Certificates

For development, you can create self-signed certificates:

```bash
# Generate private key
openssl genrsa -out sp-private-key.pem 2048

# Generate public certificate
openssl req -new -x509 -key sp-private-key.pem -out sp-public-cert.pem -days 365
```

### Logging

Implement comprehensive logging for SAML flows:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'saml-errors.log', level: 'error' }),
    new winston.transports.File({ filename: 'saml.log' })
  ]
});

// Log SAML events
router.post('/saml/callback', async (req, res) => {
  try {
    logger.info('SAML response received', { 
      hasResponse: !!req.body.SAMLResponse,
      timestamp: new Date().toISOString()
    });
    
    const { extract } = await sp.parseLoginResponse(idp, 'post', req);
    logger.info('SAML authentication successful', { userId: extract.nameID });
    
    // Rest of your handler
  } catch (err) {
    logger.error('SAML authentication failed', { 
      error: err.message,
      stack: err.stack
    });
    res.status(401).send('Authentication failed');
  }
});
```

### Common Issues and Solutions

#### 1. Invalid Signature
If you're encountering signature validation issues, check:
- Certificate format (PEM)
- Certificate expiration date
- Whether the correct certificate is being used
- The signature algorithm in metadata matches what's being used

#### 2. Metadata Mismatches
Ensure that:
- EntityIDs in metadata match the configuration
- AssertionConsumerServiceURL in SP metadata matches your callback endpoint
- Binding types are supported by both SP and IdP

#### 3. Response Format Issues
If parsing responses fails:
- Check that you're using the correct binding ('post' vs 'redirect')
- Validate the XML structure of responses
- Verify namespaces are correctly defined

## Conclusion

Integrating SAML authentication into your Node.js Express application provides a secure and standardized way to implement Single Sign-On. The approach outlined in this guide offers a robust foundation that can be adapted to various use cases and identity providers.

When implementing SAML, remember to:
1. Keep security as your top priority
2. Test thoroughly with your specific IdP
3. Implement proper error handling and logging
4. Consider user experience during the authentication flow

For additional security, consider implementing MFA (Multi-Factor Authentication) alongside SAML, and regularly review and rotate certificates according to your security policies.
