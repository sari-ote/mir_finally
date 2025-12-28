"""merge guest fields heads

Revision ID: merge_guest_fields_heads
Revises: add_all_guest_fields, a9a8accdf1cb
Create Date: 2025-01-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'merge_guest_fields_heads'
down_revision: Union[str, Sequence[str], None] = ('add_all_guest_fields', 'a9a8accdf1cb')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

