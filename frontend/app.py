"""
Azure Resource Inventory (ARI) Web Frontend
Flask application for running ARI with Azure AD authentication
"""
import os
import json
import subprocess
import uuid
from datetime import datetime, timedelta
from flask import Flask, render_template, redirect, url_for, request, session, jsonify, send_file
from flask_session import Session
import msal
import requests
from azure.storage.fileshare import ShareServiceClient, ShareFileClient
from azure.identity import DefaultAzureCredential
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', str(uuid.uuid4()))
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = './flask_session'
Session(app)

# Azure AD Configuration
CLIENT_ID = os.environ.get('AZURE_CLIENT_ID')
CLIENT_SECRET = os.environ.get('AZURE_CLIENT_SECRET')
TENANT_ID = os.environ.get('AZURE_TENANT_ID', 'common')
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
REDIRECT_PATH = "/getAToken"
SCOPE = ["https://management.azure.com/.default"]

# Azure Storage Configuration
STORAGE_ACCOUNT_NAME = os.environ.get('AZURE_STORAGE_ACCOUNT_NAME')
STORAGE_ACCOUNT_KEY = os.environ.get('AZURE_STORAGE_ACCOUNT_KEY')
STORAGE_FILE_SHARE = os.environ.get('AZURE_STORAGE_FILE_SHARE', 'ari-reports')

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _build_msal_app(cache=None, authority=None):
    """Build MSAL application"""
    return msal.ConfidentialClientApplication(
        CLIENT_ID,
        authority=authority or AUTHORITY,
        client_credential=CLIENT_SECRET,
        token_cache=cache
    )


def _build_auth_url(authority=None, scopes=None, state=None):
    """Build authentication URL"""
    return _build_msal_app(authority=authority).get_authorization_request_url(
        scopes or [],
        state=state or str(uuid.uuid4()),
        redirect_uri=url_for("authorized", _external=True)
    )


def _get_token_from_cache(scope=None):
    """Get token from cache"""
    cache = session.get("token_cache")
    if cache:
        cca = _build_msal_app(cache=msal.SerializableTokenCache().deserialize(cache))
        accounts = cca.get_accounts()
        if accounts:
            result = cca.acquire_token_silent(scope or SCOPE, account=accounts[0])
            if result:
                session["token_cache"] = cca.token_cache.serialize()
                return result
    return None


def get_azure_storage_client():
    """Get Azure File Share client"""
    if STORAGE_ACCOUNT_NAME and STORAGE_ACCOUNT_KEY:
        connection_string = f"DefaultEndpointsProtocol=https;AccountName={STORAGE_ACCOUNT_NAME};AccountKey={STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net"
        service_client = ShareServiceClient.from_connection_string(connection_string)
        return service_client
    return None


def upload_to_azure_storage(local_file_path, remote_file_name):
    """Upload file to Azure File Share"""
    try:
        service_client = get_azure_storage_client()
        if not service_client:
            logger.error("Storage client not configured")
            return False
        
        # Create share if it doesn't exist
        share_client = service_client.get_share_client(STORAGE_FILE_SHARE)
        try:
            share_client.create_share()
        except Exception:
            pass  # Share already exists
        
        # Upload file
        file_client = share_client.get_file_client(remote_file_name)
        with open(local_file_path, "rb") as source_file:
            file_client.upload_file(source_file)
        
        logger.info(f"Uploaded {local_file_path} to Azure Storage as {remote_file_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to upload to Azure Storage: {str(e)}")
        return False


def list_azure_storage_files():
    """List files in Azure File Share"""
    try:
        service_client = get_azure_storage_client()
        if not service_client:
            return []
        
        share_client = service_client.get_share_client(STORAGE_FILE_SHARE)
        files = []
        
        try:
            for item in share_client.list_directories_and_files():
                if not item.get('is_directory'):
                    files.append({
                        'name': item['name'],
                        'size': item.get('size', 0),
                        'last_modified': item.get('last_modified', '')
                    })
        except Exception:
            pass  # Share might not exist yet
        
        return files
    except Exception as e:
        logger.error(f"Failed to list Azure Storage files: {str(e)}")
        return []


@app.route("/")
def index():
    """Home page"""
    if not session.get("user"):
        return redirect(url_for("login"))
    return render_template('index.html', user=session["user"])


@app.route("/login")
def login():
    """Login page"""
    tenant_id = request.args.get('tenant')
    
    # If tenant is provided, start the OAuth flow
    if tenant_id:
        session["state"] = str(uuid.uuid4())
        session["login_tenant"] = tenant_id
        
        # Build authority with specific tenant
        tenant_authority = f"https://login.microsoftonline.com/{tenant_id}"
        auth_url = _build_auth_url(authority=tenant_authority, scopes=SCOPE, state=session["state"])
        return redirect(auth_url)
    
    # Otherwise, show the login page with tenant selection
    return render_template("login.html", tenant_id=None)


@app.route(REDIRECT_PATH)
def authorized():
    """OAuth callback"""
    if request.args.get('state') != session.get("state"):
        return redirect(url_for("index"))
    
    if "error" in request.args:
        return render_template("error.html", error=request.args)
    
    if request.args.get('code'):
        tenant_id = session.get("login_tenant")
        
        cache = msal.SerializableTokenCache()
        if session.get("token_cache"):
            cache.deserialize(session["token_cache"])
        
        # Build MSAL app with the same tenant used for login
        if tenant_id:
            tenant_authority = f"https://login.microsoftonline.com/{tenant_id}"
            cca = _build_msal_app(cache=cache, authority=tenant_authority)
        else:
            cca = _build_msal_app(cache=cache)
        
        try:
            result = cca.acquire_token_by_authorization_code(
                request.args['code'],
                scopes=SCOPE,
                redirect_uri=url_for("authorized", _external=True)
            )
            
            if "error" in result:
                # Check for specific Azure AD errors
                error_description = result.get("error_description", "")
                
                # Handle AADSTS7000215: Invalid client secret error
                if "AADSTS7000215" in error_description:
                    logger.error(f"Invalid client secret error: {error_description}")
                    error_data = {
                        "error": "invalid_client_secret",
                        "error_code": "AADSTS7000215",
                        "error_description": error_description,
                        "help_title": "Invalid Client Secret",
                        "help_message": "You're using the Client Secret ID instead of the Client Secret Value.",
                        "fix_steps": [
                            f"Go to Azure Portal: <a href='https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Credentials/appId/{CLIENT_ID}' target='_blank'>Certificates & Secrets</a>",
                            "Create a new client secret",
                            "Copy the <strong>Value</strong> (not the Secret ID!)",
                            "Update your <code>frontend/.env</code> file:<br><code>AZURE_CLIENT_SECRET=your-secret-value-here</code>",
                            "Restart the application"
                        ],
                        "doc_link": "FIX_AADSTS7000215_ERROR.md"
                    }
                    return render_template("error.html", error=error_data)
                
                return render_template("error.html", error=result)
            
            session["user"] = result.get("id_token_claims")
            session["token_cache"] = cache.serialize()
            session["primary_tenant"] = tenant_id
            
            # Clear temporary login tenant
            if "login_tenant" in session:
                del session["login_tenant"]
        
        except Exception as e:
            logger.error(f"Token acquisition error: {str(e)}")
            error_data = {
                "error": "token_acquisition_failed",
                "error_description": str(e)
            }
            return render_template("error.html", error=error_data)
    
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    """Logout"""
    session.clear()
    return redirect(
        AUTHORITY + "/oauth2/v2.0/logout" +
        "?post_logout_redirect_uri=" + url_for("index", _external=True)
    )


@app.route("/api/tenants")
def get_tenants():
    """Get available tenants"""
    token = _get_token_from_cache(SCOPE)
    if not token:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        headers = {'Authorization': 'Bearer ' + token['access_token']}
        response = requests.get(
            'https://management.azure.com/tenants?api-version=2020-01-01',
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            tenants = [
                {
                    'tenantId': t['tenantId'],
                    'displayName': t.get('displayName', t['tenantId'])
                }
                for t in data.get('value', [])
            ]
            return jsonify(tenants)
        else:
            return jsonify({"error": "Failed to fetch tenants"}), response.status_code
    except Exception as e:
        logger.error(f"Error fetching tenants: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/subscriptions/<tenant_id>")
def get_subscriptions(tenant_id):
    """Get subscriptions for a tenant"""
    token = _get_token_from_cache(SCOPE)
    if not token:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        headers = {'Authorization': 'Bearer ' + token['access_token']}
        response = requests.get(
            'https://management.azure.com/subscriptions?api-version=2020-01-01',
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            subscriptions = [
                {
                    'subscriptionId': s['subscriptionId'],
                    'displayName': s.get('displayName', s['subscriptionId']),
                    'state': s.get('state', 'Unknown')
                }
                for s in data.get('value', [])
            ]
            return jsonify(subscriptions)
        else:
            return jsonify({"error": "Failed to fetch subscriptions"}), response.status_code
    except Exception as e:
        logger.error(f"Error fetching subscriptions: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/run-ari", methods=['POST'])
def run_ari():
    """Execute Invoke-ARI"""
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401
    
    data = request.json
    tenant_id = data.get('tenantId')
    subscription_id = data.get('subscriptionId')
    include_tags = data.get('includeTags', False)
    skip_diagram = data.get('skipDiagram', False)
    
    if not tenant_id:
        return jsonify({"error": "Tenant ID is required"}), 400
    
    token = _get_token_from_cache(SCOPE)
    if not token:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        # Create temp directory for output
        output_dir = os.path.join(os.getcwd(), 'temp_output')
        os.makedirs(output_dir, exist_ok=True)
        
        # Build PowerShell command
        ps_command = f"Import-Module AzureResourceInventory; "
        ps_command += f"Connect-AzAccount -AccessToken '{token['access_token']}' -AccountId '{session['user'].get('preferred_username', 'user')}'; "
        ps_command += f"Invoke-ARI -TenantID '{tenant_id}' "
        
        if subscription_id:
            ps_command += f"-SubscriptionID '{subscription_id}' "
        if include_tags:
            ps_command += "-IncludeTags "
        if skip_diagram:
            ps_command += "-SkipDiagram "
        
        ps_command += f"-ReportDir '{output_dir}' -Lite"
        
        logger.info(f"Executing PowerShell command for tenant {tenant_id}")
        
        # Execute PowerShell
        result = subprocess.run(
            ['pwsh', '-Command', ps_command],
            capture_output=True,
            text=True,
            timeout=1800  # 30 minutes timeout
        )
        
        if result.returncode == 0:
            # Find generated files
            files = []
            for f in os.listdir(output_dir):
                if f.endswith('.xlsx') or f.endswith('.xml'):
                    file_path = os.path.join(output_dir, f)
                    # Upload to Azure Storage
                    remote_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{f}"
                    upload_to_azure_storage(file_path, remote_name)
                    files.append(f)
            
            return jsonify({
                "status": "success",
                "message": "ARI execution completed successfully",
                "files": files,
                "output": result.stdout
            })
        else:
            logger.error(f"PowerShell execution failed: {result.stderr}")
            return jsonify({
                "status": "error",
                "message": "ARI execution failed",
                "error": result.stderr
            }), 500
    
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Execution timeout"}), 500
    except Exception as e:
        logger.error(f"Error executing ARI: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/reports")
def list_reports():
    """List available reports from Azure Storage"""
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401
    
    files = list_azure_storage_files()
    return jsonify(files)


@app.route("/api/download/<filename>")
def download_report(filename):
    """Download report from Azure Storage"""
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        service_client = get_azure_storage_client()
        if not service_client:
            return jsonify({"error": "Storage not configured"}), 500
        
        share_client = service_client.get_share_client(STORAGE_FILE_SHARE)
        file_client = share_client.get_file_client(filename)
        
        # Download to temp file
        temp_dir = os.path.join(os.getcwd(), 'temp_downloads')
        os.makedirs(temp_dir, exist_ok=True)
        local_path = os.path.join(temp_dir, filename)
        
        with open(local_path, "wb") as file_handle:
            data = file_client.download_file()
            data.readinto(file_handle)
        
        return send_file(local_path, as_attachment=True, download_name=filename)
    
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/health")
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})


if __name__ == "__main__":
    # Ensure required environment variables are set
    if not CLIENT_ID or not CLIENT_SECRET:
        logger.warning("Azure AD credentials not configured. Set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET environment variables.")
    
    if not STORAGE_ACCOUNT_NAME or not STORAGE_ACCOUNT_KEY:
        logger.warning("Azure Storage not configured. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.")
    
    app.run(host='0.0.0.0', port=8000, debug=False)
