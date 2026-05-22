"""
Seed admin users from the ADMIN_EMAILS env var.

This logic used to run on every backend startup (one batch of writes per Gunicorn
worker, every deploy). It has been extracted here so it can be invoked once at
deploy time, keeping the hot startup path read-only.

Run from the backend/ directory:

    python scripts/seed_admins.py

Reads:
    ADMIN_EMAILS  comma-separated list of admin emails. If unset, defaults to
                  the same legacy value the old startup hook used so first-deploy
                  behavior stays identical.

Idempotent: only creates a User and/or Developer row when none exists for a
given email.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Make the parent backend/ package importable regardless of CWD
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("seed_admins")


def seed() -> int:
    """Seed admin users + matching Developer rows from ADMIN_EMAILS.

    Returns:
        Number of new admin User rows created.
    """
    # Import every model module so every SQLAlchemy mapper is registered
    # before the first query runs. Without this, lazy relationships (e.g.
    # Project.architectures -> Architecture) fail with InvalidRequestError
    # because the target class is unknown to the registry.
    import models  # noqa: F401
    from database import SessionLocal
    from models import architecture as _architecture  # noqa: F401
    from models import user as _user  # noqa: F401
    from models.developer import Developer
    from models.user import User, UserRole

    admin_emails_str = os.getenv("ADMIN_EMAILS", "manikya.shetty@arsenalai.com")
    admin_emails = [email.strip() for email in admin_emails_str.split(",") if email.strip()]

    if not admin_emails:
        logger.info("No admin emails configured; nothing to do")
        return 0

    created = 0
    session = SessionLocal()
    try:
        for email in admin_emails:
            existing = session.query(User).filter(User.email == email).first()
            if existing:
                logger.info("Admin %s already exists; skipping", email)
                continue

            name = email.split("@")[0].replace(".", " ").title()
            admin = User(
                email=email,
                name=name,
                hashed_password=None,  # No password for SSO users
                role=UserRole.ADMIN.value,
                is_active=True,
                is_first_login=False,  # SSO users don't need password change
            )
            session.add(admin)
            session.commit()
            created += 1
            logger.info("Created admin user %s <%s>", name, email)

            existing_dev = session.query(Developer).filter(Developer.email == email).first()
            if not existing_dev:
                developer = Developer(name=name, email=email)
                session.add(developer)
                session.commit()
                logger.info("Created Developer row for admin <%s>", email)
    except Exception:
        session.rollback()
        logger.exception("Admin seeding failed; rolled back")
        raise
    finally:
        session.close()

    return created


if __name__ == "__main__":
    try:
        n = seed()
    except Exception:  # pragma: no cover - logged above
        sys.exit(1)

    logger.info("Admin seeding complete: %d new admin(s) created", n)
    sys.exit(0)
