# Authentication Setup for Azure Resource Inventory

## Overview

The Azure Resource Inventory application now supports tenant-specific authentication. Users must provide their Azure AD tenant ID on the login page before authenticating.

## How It Works

1. **User visits the login page** → Prompted to enter their Azure AD Tenant ID
2. **User enters tenant ID** → The application validates the format (GUID)
3. **User clicks "Sign in with Microsoft"** → Redirected to Azure AD with tenant-specific authority
4. **User authenticates** → Azure AD validates credentials against the specified tenant
5. **User is redirected back** → Application receives tokens scoped to that tenant
6. **User can select subscriptions** → From tenants they have access to

## Prerequisites

### 1. Azure AD Application Registration

Your Azure AD application must be properly configured with API permissions. See [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md) for detailed instructions.

**Required Permissions:**
- Azure Service Management API: `user_impersonation` (Delegated)

### 2. Service Principal / App Registration

You need:
- **Client ID** (Application ID): `9795693b-67cd-4165-b8a0-793833081db6`
- **Client Secret**: Configured in `.env` file
- **Tenant ID**: Users provide this at login

### 3. Environment Variables

Configure your `.env` file:

```env
AZURE_CLIENT_ID=9795693b-67cd-4165-b8a0-793833081db6
AZURE_CLIENT_SECRET=<your-secret>
SESSION_SECRET=<random-string>
```

## User Flow

### For End Users

1. **Navigate to the application**
   - Open the application URL in your browser

2. **Enter your Tenant ID**
   - Find your tenant ID:
     - Azure Portal → Azure Active Directory → Overview → Tenant ID
     - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - The application remembers your tenant ID for next time

3. **Sign in with Microsoft**
   - Click the "Sign in with Microsoft" button
   - You'll be redirected to Microsoft's login page
   - Enter your credentials for the specified tenant

4. **Grant Consent (first time only)**
   - If this is your first time, you may be asked to consent to the permissions
   - Click "Accept" to allow the application to access Azure Resource Manager

5. **Select Resources**
   - After authentication, select tenant and subscription
   - Run the ARI report

### For Administrators

#### Grant Admin Consent

To avoid users being prompted for consent:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find app: `9795693b-67cd-4165-b8a0-793833081db6`
4. Go to **API permissions**
5. Click **Grant admin consent for [Organization]**

This grants consent for all users in your organization.

## Multi-Tenant Support

The application supports multi-tenant scenarios:

### Scenario 1: Single Tenant
- User authenticates with their home tenant
- Can access all resources within that tenant

### Scenario 2: Multiple Tenants
- User authenticates with their home tenant
- After authentication, can switch between tenants they have access to
- Token is acquired for each tenant as needed

### Scenario 3: Guest Users
- Guest users must use their home tenant ID (where their account originates)
- They can then access resources in tenants where they're guests
- Example: Guest from Tenant A can access Tenant B resources

## Troubleshooting

### Error: AADSTS650057 - Invalid Resource

**Problem**: The application doesn't have the required API permissions.

**Solution**: Follow the instructions in [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md) to add Azure Service Management API permissions.

### Error: AADSTS50020 - User account does not exist in tenant

**Problem**: The user account doesn't exist in the specified tenant.

**Solutions**:
- Verify you're using the correct tenant ID
- If you're a guest user, use your home tenant ID (where your account was created)
- Ask your administrator to verify your account status

### Error: AADSTS65001 - The user has not consented

**Problem**: User or admin consent is required.

**Solutions**:
- Complete the consent prompt when logging in
- Or, have an administrator grant admin consent (see above)

### Error: Invalid Tenant ID format

**Problem**: The tenant ID is not in the correct GUID format.

**Solution**: Ensure the tenant ID is formatted like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Browser Compatibility

**Recommended Browsers**:
- Microsoft Edge (latest)
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Safari (latest)

**Note**: Make sure cookies and session storage are enabled.

## Security Considerations

### Token Storage
- Tokens are stored in server-side sessions
- Session cookies are HTTP-only and secure (in production)
- Tokens expire according to Azure AD policies (typically 1 hour)

### Tenant ID Storage
- The tenant ID is stored in browser localStorage for convenience
- This is safe as it's not sensitive information
- Users can clear it by clearing browser data

### Best Practices
1. Always use HTTPS in production
2. Keep client secrets secure and rotate regularly
3. Use short session timeouts for sensitive environments
4. Enable MFA for all user accounts
5. Regularly audit API permissions

## Development vs Production

### Development
```env
NODE_ENV=development
# Cookies will not require HTTPS
```

### Production
```env
NODE_ENV=production
# Cookies will require HTTPS
# Set proper SESSION_SECRET
```

## API Endpoints

The application exposes these authentication-related endpoints:

- `GET /` - Login page (with tenant selection)
- `GET /auth/login?tenant={tenantId}` - Initiates OAuth flow
- `GET /auth/redirect` - OAuth callback
- `POST /auth/logout` - Logout
- `GET /api/me` - Get current user info
- `GET /api/tenants` - List accessible tenants
- `GET /api/subscriptions?tenantId={id}` - List subscriptions in tenant

## Additional Resources

- [Microsoft Identity Platform Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/)
- [Azure Resource Manager REST API](https://learn.microsoft.com/en-us/rest/api/resources/)
- [MSAL Node.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
- [Azure AD App Registration Guide](./AZURE_AD_SETUP.md)

## Support

For issues related to:
- **Application setup**: See [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)
- **Service Principal verification**: See [verify-sp.md](./verify-sp.md)
- **Authentication errors**: Check this document's Troubleshooting section
