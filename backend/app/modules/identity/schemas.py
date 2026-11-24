from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    # Plain string: login must not reveal validation details, and local dev uses *.local addresses.
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class VerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: str
    mfa_enabled: bool
    organization_id: str
    client_id: str | None = None


class LoginResponse(BaseModel):
    mfa_required: bool
    mfa_enrolment_required: bool = False
    user: UserOut | None = None


class SessionState(BaseModel):
    mfa_pending: bool
    enrolment_required: bool
    email: str
    role: str


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class RecoveryRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
