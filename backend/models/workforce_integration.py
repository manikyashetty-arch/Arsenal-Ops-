"""WorkforceIntegration model — singleton row holding the QuickBooks OAuth
connection state for the whole Arsenal install.

There is at most ONE row in this table (`id=1`). The integration is
per-tenant / per-Arsenal-install, not per-user. The Arsenal admin
authorizes once via Intuit OAuth and the backend then writes
TimeActivity records on behalf of employees by setting EmployeeRef.

Tokens (`refresh_token`, `access_token`) are stored ENCRYPTED at rest
using Fernet symmetric crypto — see `services/workforce_crypto.py`. The
columns hold ciphertext; never read these directly. Use the helpers
`get_refresh_token()` / `get_access_token()` which decrypt on demand.
"""

import sys
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

sys.path.append("..")
from database import Base


class WorkforceIntegration(Base):
    __tablename__ = "workforce_integration"

    # Single-row table; PK kept on `id` for ORM convenience but in practice
    # `id` is always 1. The query convention is `db.query(WorkforceIntegration).first()`.
    id = Column(Integer, primary_key=True, index=True)

    # QB company id returned from the OAuth handshake. Required for every
    # subsequent API call (`/v3/company/{realm_id}/...`).
    realm_id = Column(String(64), nullable=False)

    # Human-friendly QB Company name, fetched once at connect time via
    # the CompanyInfo endpoint and refreshed each time we refresh the
    # client list. Shown in the Integrations card so the admin sees the
    # actual company they're talking to instead of the opaque realm id.
    # Nullable because the fetch is best-effort (an Intuit hiccup mid-
    # connect shouldn't fail the connect itself).
    company_name = Column(String(255), nullable=True)

    # Tokens are stored as ENCRYPTED ciphertext, not raw. The encryption
    # key lives in `WORKFORCE_TOKEN_ENCRYPTION_KEY` env var. See
    # `services/workforce_crypto.py` for the helpers that handle the
    # encrypt/decrypt boundary.
    refresh_token_ciphertext = Column(Text, nullable=False)
    access_token_ciphertext = Column(Text, nullable=True)

    # When the cached access token expires. The OAuth client re-mints it
    # from the refresh token on demand whenever this is past.
    access_token_expires_at = Column(DateTime, nullable=True)

    # QB id of the "Hours" Service Item, resolved once at connect time
    # (HR-mandated: all Arsenal hours go in under Service Item "Hours").
    # If the user renames it in QB, we'd need a re-resolution flow.
    service_item_id = Column(String(64), nullable=True)
    service_item_name = Column(String(255), nullable=True)

    # Audit — who connected, when.
    connected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    connected_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    connected_by = relationship("User", foreign_keys=[connected_by_user_id])

    # Observability — surfaced in the admin Integrations tab so admins can
    # see at a glance whether the last run was healthy.
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(20), nullable=True)  # ok | partial | error | not_connected
    last_sync_error = Column(Text, nullable=True)
    last_synced_count = Column(Integer, default=0, nullable=False)
    last_failed_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_safe_dict(self) -> dict:
        """Serialize for API responses — REDACTS the token ciphertext.

        The admin Integrations tab needs to know "is the integration
        connected and when did it last sync" but should never receive
        the encrypted token bytes. Token decryption stays server-side.

        Timestamps are stamped as naive UTC via `datetime.utcnow()` on
        the persistence side. We append "Z" here so JavaScript parses
        them as UTC instead of local time — otherwise the frontend
        renders an EDT/EST timestamp off by the viewer's UTC offset.
        """
        return {
            "id": self.id,
            "realm_id": self.realm_id,
            "company_name": self.company_name,
            "service_item_id": self.service_item_id,
            "service_item_name": self.service_item_name,
            "connected_at": _iso_utc(self.connected_at),
            "connected_by_user_id": self.connected_by_user_id,
            "last_sync_at": _iso_utc(self.last_sync_at),
            "last_sync_status": self.last_sync_status,
            "last_sync_error": self.last_sync_error,
            "last_synced_count": self.last_synced_count,
            "last_failed_count": self.last_failed_count,
        }


def _iso_utc(dt: datetime | None) -> str | None:
    """Serialize a naive UTC datetime as an ISO 8601 string with "Z".

    Without the "Z" suffix, JavaScript's `new Date()` parser treats the
    string as local time. Since every datetime we store via
    `datetime.utcnow()` is UTC, appending "Z" eliminates the silent
    offset bug that flips a stored 14:30 UTC into a rendered 14:30 EDT.
    """
    if dt is None:
        return None
    return dt.isoformat() + "Z"
