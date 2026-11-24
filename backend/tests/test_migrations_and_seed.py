import os
import subprocess
import sys
from pathlib import Path

import pyotp

BACKEND = Path(__file__).resolve().parents[1]


def test_alembic_upgrade_and_seed_on_fresh_sqlite(tmp_path):
    db = tmp_path / "m.db"
    pwfile = tmp_path / "creds.txt"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db}", "APP_ENV": "test"}
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, env=env, check=True, capture_output=True)
    r = subprocess.run([sys.executable, "-m", "scripts.seed", "--password-file", str(pwfile)], cwd=BACKEND, env=env,
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert oct(pwfile.stat().st_mode & 0o777) == "0o600"
    creds = pwfile.read_text()
    assert "password=" in creds and "totp_secret=" in creds

    # The seeded owner can actually sign in with password + TOTP.
    lines = {ln.split("]")[0].strip("["): ln for ln in creds.splitlines() if "password=" in ln}
    pw = lines["owner"].split("password=")[1]
    secret = [ln for ln in creds.splitlines() if "totp_secret=" in ln][0].split("totp_secret=")[1].split()[0]
    code = pyotp.TOTP(secret).now()
    script = (
        "from fastapi.testclient import TestClient\n"
        "from app.main import app\n"
        "c=TestClient(app, base_url='https://t'); c.headers['X-RAGI-Request']='1'\n"
        f"r=c.post('/api/v1/auth/login', json={{'email':'owner@ragi.local','password':{pw!r}}}); assert r.json()['mfa_required'], r.text\n"
        f"r=c.post('/api/v1/auth/verify', json={{'code':{code!r}}}); assert r.status_code==200, r.text\n"
        "s=c.get('/api/v1/dashboard/summary').json(); assert not s['demo_data'] and s['agents']['total']==5\n"
        "assert c.get('/api/v1/clients').json()==[] and c.get('/api/v1/leads').json()==[]\n"
        "print('ok')\n"
    )
    r = subprocess.run([sys.executable, "-c", script], cwd=BACKEND, env=env, capture_output=True, text=True)
    assert r.returncode == 0 and "ok" in r.stdout, r.stderr[-2000:]


def test_sample_data_is_opt_in_generic_and_priceless(tmp_path):
    """Forge B1: no invented businesses, prices or completed client work — and only with --with-demo."""
    import sqlite3
    db = tmp_path / "d.db"
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db}", "APP_ENV": "test"}
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, env=env, check=True, capture_output=True)
    r = subprocess.run([sys.executable, "-m", "scripts.seed", "--password-file", str(tmp_path / "c.txt"), "--with-demo"],
                       cwd=BACKEND, env=env, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    con = sqlite3.connect(db)
    names = [n for (n,) in con.execute("select name from clients")]
    assert names and all(n.startswith("Sample client") for n in names)
    assert con.execute("select count(*) from projects where is_demo=1 and (hourly_rate is not null or status='completed')").fetchone()[0] == 0
    assert con.execute("select count(*) from leads where estimated_amount is not null").fetchone()[0] == 0
    assert con.execute("select count(*) from retainers where monthly_fee is not null").fetchone()[0] == 0
    assert con.execute("select count(*) from billing_handoffs").fetchone()[0] == 0
    assert con.execute("select count(*) from projects where is_demo=1 and name not like 'Sample%'").fetchone()[0] == 0
