"""add guest form shares support

Revision ID: 1f94d5cf1d3b
Revises: ffb37b4e6e13
Create Date: 2025-11-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1f94d5cf1d3b'
down_revision: Union[str, Sequence[str], None] = 'ffb37b4e6e13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # בדיקה אם העמודה כבר קיימת
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('guest_custom_fields')]
    if 'form_key' not in columns:
        op.add_column('guest_custom_fields', sa.Column('form_key', sa.String(), nullable=True))
    
    # בדיקה אם הטבלה כבר קיימת
    tables = inspector.get_table_names()
    if 'guest_form_shares' not in tables:
        op.create_table(
        'guest_form_shares',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('form_key', sa.String(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
        sa.Column('allow_submissions', sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['event_id'], ['events.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_guest_form_shares_event_id'), 'guest_form_shares', ['event_id'], unique=False)
        op.create_index(op.f('ix_guest_form_shares_form_key'), 'guest_form_shares', ['form_key'], unique=False)
        op.create_index(op.f('ix_guest_form_shares_token'), 'guest_form_shares', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_guest_form_shares_token'), table_name='guest_form_shares')
    op.drop_index(op.f('ix_guest_form_shares_form_key'), table_name='guest_form_shares')
    op.drop_index(op.f('ix_guest_form_shares_event_id'), table_name='guest_form_shares')
    op.drop_table('guest_form_shares')
    op.drop_column('guest_custom_fields', 'form_key')
