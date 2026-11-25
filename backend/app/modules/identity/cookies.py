"""Session cookie helpers: __Host- name with a one-release fallback for the old name."""
from fastapi import Request, Response

from app.core.config import get_settings

HOST_ATTRS = dict(httponly=True, secure=True, samesite="lax", path="/")


def cookie_name() -> str:
    return get_settings().session_cookie_name


def legacy_cookie_name() -> str:
    return get_settings().session_cookie_legacy_name


def read_token(request: Request) -> str | None:
    return request.cookies.get(cookie_name()) or request.cookies.get(legacy_cookie_name())


def set_session_cookie(response: Response, token: str, *, max_age: int) -> None:
    s = get_settings()
    # __Host- requires Secure, Path=/, and no Domain.
    response.set_cookie(s.session_cookie_name, token, max_age=max_age, **HOST_ATTRS)
    # Retire the pre-Round-3 name if a client still has it.
    if s.session_cookie_legacy_name and s.session_cookie_legacy_name != s.session_cookie_name:
        response.delete_cookie(s.session_cookie_legacy_name, path="/")


def clear_session_cookie(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(s.session_cookie_name, path="/", secure=True, httponly=True, samesite="lax")
    if s.session_cookie_legacy_name:
        response.delete_cookie(s.session_cookie_legacy_name, path="/")


INVITE_COOKIE = "__Host-ragi_invite"


def read_invite_token(request: Request) -> str | None:
    return request.cookies.get(INVITE_COOKIE)


def set_invite_cookie(response: Response, token: str, *, max_age: int = 600) -> None:
    response.set_cookie(INVITE_COOKIE, token, max_age=max_age, **HOST_ATTRS)


def clear_invite_cookie(response: Response) -> None:
    response.delete_cookie(INVITE_COOKIE, path="/", secure=True, httponly=True, samesite="lax")


OAUTH_COOKIE = "__Host-ragi_oauth"


def read_oauth_cookie(request: Request) -> str | None:
    return request.cookies.get(OAUTH_COOKIE)


def set_oauth_cookie(response: Response, value: str, *, max_age: int = 600) -> None:
    response.set_cookie(OAUTH_COOKIE, value, max_age=max_age, **HOST_ATTRS)


def clear_oauth_cookie(response: Response) -> None:
    response.delete_cookie(OAUTH_COOKIE, path="/", secure=True, httponly=True, samesite="lax")


TRUSTED_COOKIE = "__Host-ragi_trusted"


def read_trusted_token(request: Request) -> str | None:
    return request.cookies.get(TRUSTED_COOKIE)


def set_trusted_cookie(response: Response, token: str, *, max_age: int) -> None:
    response.set_cookie(TRUSTED_COOKIE, token, max_age=max_age, **HOST_ATTRS)


def clear_trusted_cookie(response: Response) -> None:
    response.delete_cookie(TRUSTED_COOKIE, path="/", secure=True, httponly=True, samesite="lax")
