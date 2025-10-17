╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         AZURE AD AUTHENTICATION - ERROR FIX                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

You encountered authentication errors. Here's how to fix them:

ERROR 1: AADSTS7000215 - Invalid client secret
ERROR 2: AADSTS500113 - No reply address registered
ERROR 3: AADSTS650057 - Invalid resource

═══════════════════════════════════════════════════════════════
                    🔧 QUICK FIX (ONE COMMAND)
═══════════════════════════════════════════════════════════════

Windows PowerShell:
    .\setup-azure-ad.ps1

Linux/macOS:
    ./setup-azure-ad.sh

This automatically configures:
  ✓ Redirect URIs (reply URLs)
  ✓ API permissions
  ✓ Admin consent

═══════════════════════════════════════════════════════════════
                    📖 DOCUMENTATION
═══════════════════════════════════════════════════════════════

Quick Start Guide:        QUICK_START_GUIDE.md
Fix AADSTS7000215:        FIX_AADSTS7000215_ERROR.md  ⭐ NEW!
Fix AADSTS500113:         FIX_AADSTS500113_ERROR.md
Redirect URI Guide:       REDIRECT_URI_GUIDE.md
Complete Setup:           AZURE_AD_SETUP.md
Changes Summary:          CHANGES_SUMMARY.md

═══════════════════════════════════════════════════════════════
                    🚀 NEXT STEPS
═══════════════════════════════════════════════════════════════

1. Run the setup script (see above)
2. Start your application:   node server.js
3. Open in browser and test login
4. Enter your tenant ID when prompted
5. Should work without errors!

═══════════════════════════════════════════════════════════════

Need help? Check QUICK_START_GUIDE.md

═══════════════════════════════════════════════════════════════
