"""Column encryption for sensitive values (master spec §15: encrypted sensitive records)."""
import base64
import hashlib
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings



class EncryptionUnavailable(RuntimeError):
    pass


@lru_cache
def _fernet() -> Fernet:
    s = get_settings()
    key = s.field_encryption_key
    if not key:
        if not s.is_development:
            raise EncryptionUnavailable("FIELD_ENCRYPTION_KEY is not set")
        # Development only: derive a stable per-checkout key from a local file that is git-ignored.
        f = Path(__file__).resolve().parents[2] / ".dev-field-key"
        if not f.exists():
            f.write_bytes(Fernet.generate_key())
            f.chmod(0o600)
        key = f.read_text().strip()
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except ValueError:
        # Allow any passphrase by deriving a Fernet key from it.
        return Fernet(base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise EncryptionUnavailable("Could not decrypt value with the configured key") from exc
