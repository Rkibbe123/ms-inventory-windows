# Quick Fix for AADSTS650057 Error

## Immediate Action Required

You're getting this error because your Azure AD app registration is missing a required API permission.

### Fix Using Azure Portal (Fastest - 2 minutes)

1. **Go to**: https://portal.azure.com
2. **Search for**: "App registrations"
3. **Find your app**: Search for app ID `9795693b-67cd-4165-b8a0-793833081db6`
4. **Click**: "API permissions" in the left menu
5. **Click**: "+ Add a permission"
6. **Click**: "Azure Service Management"
7. **Check**: "user_impersonation"
8. **Click**: "Add permissions"
9. **Click**: "Grant admin consent for [Your Org]" (if you see this button)

### Fix Using Azure CLI (One Command)

```bash
az ad app permission add \
  --id 9795693b-67cd-4165-b8a0-793833081db6 \
  --api 797f4846-ba00-4fd7-ba43-dac1f8f63013 \
  --api-permissions 41094075-9dad-400e-a0bd-54e686782033=Scope

az ad app permission grant \
  --id 9795693b-67cd-4165-b8a0-793833081db6 \
  --api 797f4846-ba00-4fd7-ba43-dac1f8f63013
```

### After Adding the Permission

1. **Wait 1-2 minutes** for the changes to propagate
2. **Clear your browser cache/cookies**
3. **Try logging in again**
4. **Enter your tenant ID** when prompted (or use "common")

## What Was Changed in the Code

✅ Updated login page to accept Tenant ID
✅ Changed authentication to use tenant-specific authority
✅ Fixed API permission scopes (`user_impersonation` instead of `.default`)

## Need Help?

See [AZURE-AD-APP-SETUP.md](./AZURE-AD-APP-SETUP.md) for detailed instructions with screenshots and troubleshooting steps.
