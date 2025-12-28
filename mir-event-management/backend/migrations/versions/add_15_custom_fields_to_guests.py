"""add 15 custom fields to guests table

Revision ID: add_15_custom_fields
Revises: 1f94d5cf1d3b
Create Date: 2025-01-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_15_custom_fields'
down_revision: Union[str, Sequence[str], None] = '1f94d5cf1d3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # בדיקה אם העמודות כבר קיימות
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('guests')]
    
    # הוספת 15 עמודות דינמיות לטבלת guests
    if 'custom_field_1' not in columns:
        op.add_column('guests', sa.Column('custom_field_1', sa.String(), nullable=True))
    if 'custom_field_2' not in columns:
        op.add_column('guests', sa.Column('custom_field_2', sa.String(), nullable=True))
    if 'custom_field_3' not in columns:
        op.add_column('guests', sa.Column('custom_field_3', sa.String(), nullable=True))
    if 'custom_field_4' not in columns:
        op.add_column('guests', sa.Column('custom_field_4', sa.String(), nullable=True))
    if 'custom_field_5' not in columns:
        op.add_column('guests', sa.Column('custom_field_5', sa.String(), nullable=True))
    if 'custom_field_6' not in columns:
        op.add_column('guests', sa.Column('custom_field_6', sa.String(), nullable=True))
    if 'custom_field_7' not in columns:
        op.add_column('guests', sa.Column('custom_field_7', sa.String(), nullable=True))
    if 'custom_field_8' not in columns:
        op.add_column('guests', sa.Column('custom_field_8', sa.String(), nullable=True))
    if 'custom_field_9' not in columns:
        op.add_column('guests', sa.Column('custom_field_9', sa.String(), nullable=True))
    if 'custom_field_10' not in columns:
        op.add_column('guests', sa.Column('custom_field_10', sa.String(), nullable=True))
    if 'custom_field_11' not in columns:
        op.add_column('guests', sa.Column('custom_field_11', sa.String(), nullable=True))
    if 'custom_field_12' not in columns:
        op.add_column('guests', sa.Column('custom_field_12', sa.String(), nullable=True))
    if 'custom_field_13' not in columns:
        op.add_column('guests', sa.Column('custom_field_13', sa.String(), nullable=True))
    if 'custom_field_14' not in columns:
        op.add_column('guests', sa.Column('custom_field_14', sa.String(), nullable=True))
    if 'custom_field_15' not in columns:
        op.add_column('guests', sa.Column('custom_field_15', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('guests', 'custom_field_15')
    op.drop_column('guests', 'custom_field_14')
    op.drop_column('guests', 'custom_field_13')
    op.drop_column('guests', 'custom_field_12')
    op.drop_column('guests', 'custom_field_11')
    op.drop_column('guests', 'custom_field_10')
    op.drop_column('guests', 'custom_field_9')
    op.drop_column('guests', 'custom_field_8')
    op.drop_column('guests', 'custom_field_7')
    op.drop_column('guests', 'custom_field_6')
    op.drop_column('guests', 'custom_field_5')
    op.drop_column('guests', 'custom_field_4')
    op.drop_column('guests', 'custom_field_3')
    op.drop_column('guests', 'custom_field_2')
    op.drop_column('guests', 'custom_field_1')

