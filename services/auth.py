"""
Kraken Auth - Sistema de autenticación local con tokens JWT-like
Zero dependencias externas. Usa hmac + hashlib de la stdlib.
"""
import hashlib
import hmac
import json
import time
import os
import base64
import secrets

# Generar o cargar secreto persistente
def _get_or_create_secret():
    secret_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.kraken_secret')
    secret_path = os.path.normpath(secret_path)
    if os.path.exists(secret_path):
        with open(secret_path, 'r') as f:
            return f.read().strip()
    secret = secrets.token_hex(32)
    with open(secret_path, 'w') as f:
        f.write(secret)
    return secret

JWT_SECRET = _get_or_create_secret()
TOKEN_EXPIRY = 30 * 24 * 3600  # 30 días

def hash_password(password):
    """Hash a password with salt for storage."""
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return salt + ':' + h.hex()

def verify_password(password, stored_hash):
    """Verify a password against its stored hash."""
    if not stored_hash or ':' not in stored_hash:
        return False
    salt, expected = stored_hash.split(':', 1)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return hmac.compare_digest(h.hex(), expected)

# Alias for backwards compatibility
hash_pin = hash_password
verify_pin = verify_password

def create_token(user_email, username='', is_superadmin=False):
    """Create a signed token (JWT-like) for a user."""
    payload = {
        'email': user_email,
        'username': username,
        'is_superadmin': is_superadmin,
        'iat': int(time.time()),
        'exp': int(time.time()) + TOKEN_EXPIRY
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(JWT_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"

def verify_token(token):
    """Verify and decode a token. Returns payload dict or None."""
    if not token or '.' not in token:
        return None
    try:
        payload_b64, signature = token.rsplit('.', 1)
        expected_sig = hmac.new(JWT_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        if payload.get('exp', 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def generate_invite_code():
    """Generate a 6-char invite code like KRK-A7X9."""
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # Sin I/O/0/1 para evitar confusión
    code = ''.join(secrets.choice(chars) for _ in range(4))
    return f"KRK-{code}"

def get_user_from_request(request):
    """Extract user email from request. Checks JWT only."""
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        token = auth[7:]
        payload = verify_token(token)
        if payload:
            return payload.get('email', '')

    return ''
