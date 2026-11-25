"""Password hashing, session tokens, TOTP and event signatures."""
import hashlib
import hmac
import secrets
import time

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# RFC 9106 "low memory" profile, pinned so hashes stay reproducible across upgrades.
_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16)

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except Exception:
        return False


# A real hash used to equalise timing when the email does not exist.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def burn_password_check(password: str) -> None:
    verify_password(_DUMMY_HASH, password)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_match_step(secret: str, code: str, now: float | None = None) -> int | None:
    """Return the 30-second time step the code belongs to (±1 step), or None."""
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit() or len(code) != 6:
        return None
    totp = pyotp.TOTP(secret)
    step = int((now if now is not None else time.time()) // 30)
    for d in (-1, 0, 1):
        if hmac.compare_digest(totp.at((step + d) * 30), code):
            return step + d
    return None


def verify_totp(secret: str, code: str) -> bool:
    return totp_match_step(secret, code) is not None


def totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="RAGI · Arnova Group")


def sign_body(secret: str, timestamp: str, body: bytes) -> str:
    """Ecosystem request signature: HMAC-SHA256 over "<timestamp>.<raw body>"."""
    return "sha256=" + hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
