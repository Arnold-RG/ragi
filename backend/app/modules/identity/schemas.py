from pydantic import BaseModel, Field

from app.core.emails import EmailAddress


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    identifier: str | None = Field(default=None, max_length=320)
    email: str | None = Field(default=None, max_length=320)  # legacy alias

    def login_id(self) -> str:
        return (self.identifier or self.email or "").strip()


class VerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=12)


class RecoveryRequest(BaseModel):
    email: EmailAddress


class RegisterRequest(BaseModel):
    setup_token: str | None = Field(default=None, max_length=200)
    invite_token: str | None = Field(default=None, max_length=200)
    email: EmailAddress
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    id: str
    email: str
    username: str | None = None
    full_name: str
    role: str
    mfa_enabled: bool
    has_password: bool = True
    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            mfa_enabled=user.mfa_enabled,
            has_password=bool(user.password_hash),
        )


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
    password_reset: str = "email"
    app: str = "ragi"
    private: bool = False
    signup_enabled: bool = False



class InvitePreviewIn(BaseModel):
    token: str | None = Field(default=None, max_length=200)


class InviteCreateIn(BaseModel):
    email: EmailAddress
    role: str = "viewer"


class PasswordResetRequest(BaseModel):
    identifier: str | None = Field(default=None, max_length=320)
    email: str | None = Field(default=None, max_length=320)

    def login_id(self) -> str:
        return (self.identifier or self.email or "").strip()


class PasswordResetConfirm(BaseModel):
    identifier: str = Field(min_length=1, max_length=320)
    code: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=12, max_length=128)


class PasswordRecoveryReset(BaseModel):
    identifier: str = Field(min_length=1, max_length=320)
    recovery_code: str = Field(min_length=8, max_length=16)
    password: str = Field(min_length=12, max_length=128)


class PasswordSetIn(BaseModel):
    password: str = Field(min_length=12, max_length=128)


class OAuthStartResponse(BaseModel):
    authorization_url: str


class OAuthCallbackIn(BaseModel):
    code: str = Field(min_length=1, max_length=200)
    state: str = Field(min_length=1, max_length=200)
