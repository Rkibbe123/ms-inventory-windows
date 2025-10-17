# Fix: Invalid Client Secret Error (AADSTS7000215)

## Problem
You're getting the error: `AADSTS7000215: Invalid client secret provided`

This means the `AZURE_CLIENT_SECRET` in your `.env` file is not the correct secret value.

## Root Causes
1. **Secret Value vs Secret ID**: You may have copied the Secret ID (GUID) instead of the Secret Value
2. **Truncated Secret**: The secret value was cut off when copying
3. **Expired Secret**: Client secrets have expiration dates (90 days, 1 year, 2 years, etc.)
4. **Wrong Secret**: A secret from a different app registration

## How to Fix

### Step 1: Access Azure Portal
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app: `9795693b-67cd-4165-b8a0-793833081db6`
4. Or use this direct link: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Credentials/appId/9795693b-67cd-4165-b8a0-793833081db6

### Step 2: Create a NEW Client Secret
Since secret values are only shown once when created, you'll need to create a new one:

1. In your app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. Add a description (e.g., "Server auth - 2025-10")
4. Select expiration period (recommend: 6 months or 1 year)
5. Click **Add**
6. **IMMEDIATELY COPY THE VALUE** - it will only be shown once!

### Step 3: Update Your .env File
1. Open your `.env` file in the project root
2. Replace the `AZURE_CLIENT_SECRET` value with the NEW value you just copied
3. Make sure you copy the **Value** column, NOT the **Secret ID** column

Example:
```bash
# WRONG - This is a Secret ID (GUID format)
AZURE_CLIENT_SECRET=12345678-90ab-cdef-1234-567890abcdef

# CORRECT - This is a Secret Value (long string with special characters)
AZURE_CLIENT_SECRET=abc8Q~1234567890abcdefghijklmnopqrstuvwxyzABCD
```

### Step 4: Important Checks
✅ **The secret value should be:**
- Approximately 40+ characters long
- Contains letters, numbers, and special characters (~, _, -, etc.)
- Does NOT look like a GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

✅ **No extra spaces:**
- Make sure there are no spaces before or after the secret value
- No quotes needed (unless your value has spaces, which is rare)

✅ **Full value copied:**
- Secret values can be 40-60+ characters long
- Make sure you copied the entire value

### Step 5: Restart Your Application
```bash
node server.js
```

### Step 6: Test Login
1. Navigate to http://localhost:3000
2. Enter your tenant ID: `ed9aa516-5358-4016-a8b2-b6ccb99142d0`
3. Click "Sign in with Microsoft"
4. Complete the authentication flow

## Additional Verification

### Check Your Current Secret
Your current `.env` has:
```
AZURE_CLIENT_SECRET=6sX8Q~pAgeSpU4~OTHn_YNn-W2YalkWYOTrSdaJ
```

This is **43 characters** long and has the format of a secret value, BUT Azure is rejecting it. This suggests:
- The secret has **expired** 
- The secret was **deleted/rotated** in Azure Portal
- The secret belongs to a **different app registration**
- The value is **incomplete/corrupted**

### Verify Redirect URI
While you're in the Azure Portal, also verify your Redirect URI is configured:
1. Go to **Authentication** in your app registration
2. Ensure you have: `http://localhost:3000/auth/redirect` (for local dev)
3. Or your production redirect URI if deployed

## Common Mistakes to Avoid
❌ Copying the Secret ID instead of the Value
❌ Copying an expired secret
❌ Including quotes around the secret in .env
❌ Truncating the secret value
❌ Using secrets from a different app registration

## Need More Help?
If you continue to have issues:
1. Double-check the App ID matches: `9795693b-67cd-4165-b8a0-793833081db6`
2. Verify you have **Application.ReadWrite.OwnedBy** or **Application.ReadWrite.All** permissions
3. Check if your app registration has been deleted or disabled
4. Ensure your Azure AD admin hasn't restricted app registrations

## References
- [Azure AD Client Secrets Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal)
- [MSAL Node Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
