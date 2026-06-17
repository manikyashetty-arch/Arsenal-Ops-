"""WorkforceClient model — local cache of QuickBooks Customers.

The per-project client picker reads from this table instead of hitting
Intuit on every render. A refresh job (Saturday cron, OAuth connect, or
the manual "Refresh clients" button) keeps it in sync.

Refresh semantics:
- New QB customers → INSERT with `active=True`
- Existing customers (matched by `qb_customer_id`) → UPDATE name; clear
  `active=False` if it was previously inactive (QB re-activated)
- Customers no longer returned by QB → mark `active=False` (soft delete)
  so a project still tagged to them surfaces the staleness instead of
  appearing fine

`active` is the picker's filter: only `active=True` rows show up in the
project-link dropdown. Inactive rows linger so we can warn "this
project is tagged to a customer that no longer exists in QB" later
without needing audit logs.
"""

import sys
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, String

sys.path.append("..")
from database import Base


class WorkforceClient(Base):
    __tablename__ = "workforce_clients"

    # QB's own customer id is the natural primary key. String because
    # Intuit returns numeric ids as JSON strings in the response — we
    # don't try to coerce them.
    qb_customer_id = Column(String(64), primary_key=True)

    # Cached display name. Refreshed on every successful refresh; powers
    # the picker dropdown without a QB round-trip.
    name = Column(String(255), nullable=False)

    # The realm this customer belongs to. Singleton design means at most
    # one realm at a time, but storing it explicitly lets a disconnect
    # / reconnect to a different realm safely wipe the prior cache via
    # a single DELETE WHERE realm_id != current.
    realm_id = Column(String(64), nullable=False, index=True)

    # Soft-delete flag. False means QB returned this customer at one
    # point but no longer does (deactivated or deleted in QB). The
    # picker filters these out; the project chip can still show the
    # cached name on already-tagged projects.
    active = Column(Boolean, default=True, nullable=False, index=True)

    # Updated on every refresh that observes this customer. Doubles as
    # the freshness signal (latest `last_synced_at` across all rows in
    # a realm = when the cache was last refreshed) so we don't need a
    # separate "last refresh time" record.
    last_synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        # Picker queries always filter by `active=True` and sort by `name`.
        Index("idx_workforce_clients_active_name", "active", "name"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.qb_customer_id,
            "name": self.name,
            "active": self.active,
            "last_synced_at": (
                self.last_synced_at.isoformat() + "Z" if self.last_synced_at else None
            ),
        }
