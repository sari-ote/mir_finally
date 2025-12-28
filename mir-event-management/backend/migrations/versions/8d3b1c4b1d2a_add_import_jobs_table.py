"""add import_jobs table

Revision ID: 8d3b1c4b1d2a
Revises: merge_guest_fields_heads
Create Date: 2025-12-10 12:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d3b1c4b1d2a'
down_revision: Union[str, Sequence[str], None] = 'merge_guest_fields_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # בדיקה אם הטבלה כבר קיימת
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    
    if 'import_jobs' not in tables:
        op.create_table(
            'import_jobs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id'), nullable=False),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('file_name', sa.String(), nullable=False),
            sa.Column('status', sa.String(), nullable=False, default='pending'),
            sa.Column('total_rows', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('processed_rows', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('success_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('error_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('error_log_path', sa.String(), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('finished_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index('ix_import_jobs_id', 'import_jobs', ['id'], unique=False)
    else:
        # בדיקה אם האינדקס כבר קיים (אם הטבלה כבר הייתה קיימת)
        indexes = [idx['name'] for idx in inspector.get_indexes('import_jobs')]
        if 'ix_import_jobs_id' not in indexes:
            op.create_index('ix_import_jobs_id', 'import_jobs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_import_jobs_id', table_name='import_jobs')
    op.drop_table('import_jobs')

