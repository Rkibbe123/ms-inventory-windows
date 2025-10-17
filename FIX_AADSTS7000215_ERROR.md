# Fix AADSTS7000215 Error - Invalid Client Secret

## Error Message
```
AADSTS7000215: Invalid client secret provided. 
Ensure the secret being sent in the request is the client secret value, 
not the client secret ID, for a secret added to app '9795693b-67cd-4165-b8a0-793833081db6'.
```

## What This Means

You're using the **Client Secret ID** instead of the **Client Secret Value**. This is a common mistake when copying credentials from Azure Portal.

### The Difference

- ❌ **Secret ID**: A unique identifier for the secret (looks like a GUID) - **DON'T USE THIS**
- ✅ **Secret Value**: The actual secret string - **USE THIS**

## Quick Fix

### Step 1: Get the Correct Client Secret

#### Option A: Use Existing Secret (If You Saved It)

If you saved the secret value when you created it, use that value.

#### Option B: Create a New Secret

**You cannot retrieve an existing secret value.** You must create a new one:

1. **Open Azure Portal**: https://portal.azure.com
2. **Navigate to your app**:
   - Azure Active Directory → App registrations
   - Search for app ID: `9795693b-67cd-4165-b8a0-793833081db6`
   - Click on the application
3. **Go to Certificates & secrets**:
   - Click on **Certificates & secrets** in the left menu
   - Click **+ New client secret**
4. **Create new secret**:
   - Description: `ARI Web App Secret` (or any name you prefer)
   - Expires: Choose expiration period (recommended: 6 months or 12 months)
   - Click **Add**
5. **IMPORTANT - Copy the VALUE immediately**:
   - You'll see two columns: **Secret ID** and **Value**
   - ❌ **DON'T** copy the Secret ID (column 1)
   - ✅ **DO** copy the Value (column 2) - it looks like a random string
   - ⚠️ **This is your only chance to see it!** Store it securely.

#### Using PowerShell Script

We've provided a helper script:

```powershell
# Windows PowerShell
.\create-new-secret.ps1
```

This script will:
1. ✅ Create a new client secret (24-month expiry)
2. ✅ Display the secret value (copy it immediately!)
3. ✅ List all secrets with their expiry dates

### Step 2: Update Your Environment Configuration

#### For Node.js (server.js)

Update your `.env` file:
```env
AZURE_CLIENT_ID=9795693b-67cd-4165-b8a0-793833081db6
AZURE_CLIENT_SECRET=your-new-secret-value-here
SESSION_SECRET=your-random-session-secret
```

⚠️ **Make sure you're updating `AZURE_CLIENT_SECRET`, not `AZURE_CLIENT_SECRET_ID`**

#### For Python/Flask (frontend/app.py)

Update your `frontend/.env` file:
```env
AZURE_CLIENT_ID=9795693b-67cd-4165-b8a0-793833081db6
AZURE_CLIENT_SECRET=your-new-secret-value-here
AZURE_TENANT_ID=common
SECRET_KEY=your-flask-secret-key
```

### Step 3: Restart Your Application

After updating the `.env` file:

```bash
# For Node.js
# Stop the server (Ctrl+C) and restart:
node server.js

# For Python/Flask
cd frontend
# Stop the server (Ctrl+C) and restart:
python app.py
```

## Visual Guide: What to Copy

When viewing **Certificates & secrets** in Azure Portal:

```
Certificates & secrets
─────────────────────────────────────────────────
Client secrets

Description          Secret ID                              Value                    Expires
────────────────────────────────────────────────────────────────────────────────────────────
ARI Web App Secret   12345678-1234-...  ❌ DON'T COPY     A1b2C3d4...  ✅ COPY THIS!   12/31/2026
```

## Common Mistakes

### ❌ Mistake 1: Copying the Secret ID
```env
# WRONG - This is the Secret ID (looks like a GUID)
AZURE_CLIENT_SECRET=12345678-1234-1234-1234-123456789abc
```

### ✅ Correct: Copying the Secret Value
```env
# CORRECT - This is the Secret Value (random characters)
AZURE_CLIENT_SECRET=A1b~C2d3E4f5G6h7I8j9K0l1M2n3O4p5Q6r7S8t9
```

### ❌ Mistake 2: Using an Expired Secret

Check secret expiration in Azure Portal:
1. Go to **Certificates & secrets**
2. Look at the **Expires** column
3. If expired, create a new secret

### ❌ Mistake 3: Using the Wrong Environment Variable Name

Make sure your `.env` uses:
- ✅ `AZURE_CLIENT_SECRET=...` (correct)
- ❌ `AZURE_CLIENT_SECRET_ID=...` (wrong)
- ❌ `CLIENT_SECRET_ID=...` (wrong)

## Testing the Fix

1. Update your `.env` file with the correct secret value
2. Restart your application
3. Navigate to the login page
4. Enter your tenant ID and sign in
5. **You should no longer see AADSTS7000215!**

## Security Best Practices

### 🔒 Protecting Your Client Secret

1. **Never commit secrets to git**:
   ```bash
   # Make sure .env is in .gitignore
   echo ".env" >> .gitignore
   echo "frontend/.env" >> .gitignore
   ```

2. **Use Azure Key Vault in production**:
   - Store secrets in Azure Key Vault
   - Use Managed Identity to access them
   - See: [Azure Key Vault Documentation](https://learn.microsoft.com/en-us/azure/key-vault/)

3. **Rotate secrets regularly**:
   - Create a new secret before the old one expires
   - Update your application configuration
   - Delete the old secret after verifying the new one works

4. **Use short expiration periods**:
   - Recommended: 6-12 months
   - Set calendar reminders before expiration

### 🔄 Secret Rotation Process

1. **Create new secret** (while old one still works)
2. **Update .env** with new secret value
3. **Test** that authentication works
4. **Deploy** to production
5. **Delete old secret** from Azure Portal

## Troubleshooting

### Still Getting the Error After Updating?

**Check these:**

1. **Did you restart the application?**
   - Environment variables are loaded at startup
   - You must restart after changing `.env`

2. **Are you editing the correct .env file?**
   - Node.js: `/workspace/.env`
   - Python: `/workspace/frontend/.env`

3. **Is there whitespace in the secret?**
   ```env
   # WRONG - has space after =
   AZURE_CLIENT_SECRET= A1b2C3d4...
   
   # CORRECT - no spaces
   AZURE_CLIENT_SECRET=A1b2C3d4...
   ```

4. **Is the .env file being loaded?**
   ```bash
   # Node.js - check if dotenv is configured
   # Look for this in server.js:
   require('dotenv').config();
   
   # Python - check if python-dotenv is installed
   pip install python-dotenv
   ```

### How to Verify You're Using the Right Value

Add temporary logging (remove after testing):

**Node.js:**
```javascript
// Add temporarily to server.js
const clientSecret = process.env.AZURE_CLIENT_SECRET;
console.log('Secret length:', clientSecret?.length);
console.log('Looks like GUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(clientSecret));
// Should show: Secret length: 40+ and Looks like GUID: false
```

**Python:**
```python
# Add temporarily to app.py
import os
client_secret = os.environ.get('AZURE_CLIENT_SECRET')
print(f'Secret length: {len(client_secret) if client_secret else 0}')
import re
print(f'Looks like GUID: {bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-", client_secret or ""))}')
# Should show: Secret length: 40+ and Looks like GUID: False
```

### Secret Doesn't Work After Creation?

Wait 1-2 minutes after creating a new secret before using it. Azure AD needs time to propagate the secret.

## Related Errors

After fixing this error, you might encounter:

- **AADSTS500113**: No reply address registered → See [FIX_AADSTS500113_ERROR.md](./FIX_AADSTS500113_ERROR.md)
- **AADSTS650057**: Invalid resource → Run `.\add-api-permissions.ps1`
- **AADSTS50020**: User account does not exist → Check tenant ID

## Additional Resources

- 📖 **Complete Setup Guide**: [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)
- 📖 **Authentication Guide**: [README_AUTHENTICATION.md](./README_AUTHENTICATION.md)
- 📖 **Quick Start**: [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)
- 🔗 **Azure Portal - Your App**: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Credentials/appId/9795693b-67cd-4165-b8a0-793833081db6
- 🔗 **Microsoft Docs**: [Register an application](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

## Summary

🎯 **The Fix:**
1. Go to Azure Portal → App registrations → Certificates & secrets
2. Create new client secret
3. Copy the **Value** (not the Secret ID!)
4. Update `AZURE_CLIENT_SECRET` in your `.env` file
5. Restart your application

✅ **You're done!** The AADSTS7000215 error should be gone.

---

**Need Help?**
- Check [README_FIX_ERRORS.txt](./README_FIX_ERRORS.txt) for more error solutions
- See [SUPPORT.md](./SUPPORT.md) for getting help
