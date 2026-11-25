from pydantic import BaseModel, Field

from app.core.emails import EmailAddress


class LoginRequest(BaseModel):
    email: EmailAddress
    password: str = Field(min_length=1, max_length=128)


class VerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=12)


class RecoveryRequest(BaseModel):
    email: EmailAddress


class RegisterRequest(BaseModel):
    setup_token: str | None = Field(default=None, max_length=200)
    invite_token: str | None = Field(default=None, max_length=200)
    email: EmailAddress
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    mfa_enabled: bool
    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    mfa_required: bool
    mfa_enrolment_required: bool = False
    recovery_codes: list[str] | None = None
    user: UserOut | None = None


class SessionState(BaseModel):
    mfa_pending: bool
    enrolment_required: bool
    email: str
    role: str
    recovery_remaining: int = 0


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class AuthConfig(BaseModel):
    registration_mode: str
    owner_setup: bool
    providers: dict[str, bool]
    password_reset: str = "cli"
    app: str = "ragi"



class InvitePreviewIn(BaseModel):
    token: str | None = Field(default=None, max_length=200)


class InviteCreateIn(BaseModel):
    email: EmailAddress
    role: str = "viewer"
