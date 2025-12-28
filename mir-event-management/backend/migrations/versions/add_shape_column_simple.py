"""Add shape column to tables

Revision ID: add_shape_column_simple
Revises: add_hallelement_simple
Create Date: 2025-08-13 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_shape_column_simple'
down_revision: Union[str, Sequence[str], None] = 'add_hallelement_simple'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # בדיקה אם העמודה כבר קיימת
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('tables')]
    
    # Add shape column to tables
    if 'shape' not in columns:
        op.add_column('tables', sa.Column('shape', sa.String(), nullable=True, server_default='circular'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove shape column from tables
    op.drop_column('tables', 'shape') 