"""remove unused guest fields from guests table

Revision ID: remove_unused_guest_fields
Revises: add_all_guest_fields
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_unused_guest_fields'
down_revision: Union[str, Sequence[str], None] = '8d3b1c4b1d2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # בדיקה אם העמודות קיימות לפני מחיקתן
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('guests')]
    
    # שדות בסיסיים שהוסרו
    if 'address' in columns:
        op.drop_column('guests', 'address')
    if 'phone' in columns:
        op.drop_column('guests', 'phone')
    if 'referral_source' in columns:
        op.drop_column('guests', 'referral_source')
    if 'whatsapp_number' in columns:
        op.drop_column('guests', 'whatsapp_number')
    
    # פרטים אישיים שהוסרו
    if 'first_name_split' in columns:
        op.drop_column('guests', 'first_name_split')
    if 'last_name_split' in columns:
        op.drop_column('guests', 'last_name_split')
    if 'first_name_without_wife' in columns:
        op.drop_column('guests', 'first_name_without_wife')
    if 'nickname' in columns:
        op.drop_column('guests', 'nickname')
    if 'wife_name_dinner' in columns:
        op.drop_column('guests', 'wife_name_dinner')
    if 'student_code' in columns:
        op.drop_column('guests', 'student_code')
    
    # פרטי קשר שהוסרו
    if 'alt_email' in columns:
        op.drop_column('guests', 'alt_email')
    if 'work_email' in columns:
        op.drop_column('guests', 'work_email')
    
    # מזהים שהוסרו
    if 'identifier' in columns:
        op.drop_column('guests', 'identifier')
    if 'import_identifier' in columns:
        op.drop_column('guests', 'import_identifier')
    if 'raf' in columns:
        op.drop_column('guests', 'raf')
    if 'previous_system_id' in columns:
        op.drop_column('guests', 'previous_system_id')
    
    # שיוך וניהול שהוסרו
    if 'marked_as_ambassador' in columns:
        op.drop_column('guests', 'marked_as_ambassador')
    if 'ambassador_status' in columns:
        op.drop_column('guests', 'ambassador_status')
    if 'display_type' in columns:
        op.drop_column('guests', 'display_type')
    if 'telephonist_update' in columns:
        op.drop_column('guests', 'telephonist_update')
    if 'category' in columns:
        op.drop_column('guests', 'category')
    if 'women_category' in columns:
        op.drop_column('guests', 'women_category')
    if 'invitation_classification' in columns:
        op.drop_column('guests', 'invitation_classification')
    if 'arrival_source' in columns:
        op.drop_column('guests', 'arrival_source')
    if 'treatment_status' in columns:
        op.drop_column('guests', 'treatment_status')
    
    # בנקים ותשלומים שהוסרו
    if 'bank_account_name' in columns:
        op.drop_column('guests', 'bank_account_name')
    
    # תרומות שהוסרו
    if 'active_hok' in columns:
        op.drop_column('guests', 'active_hok')
    if 'hok_amount_05_2024' in columns:
        op.drop_column('guests', 'hok_amount_05_2024')
    if 'monthly_hok_amount' in columns:
        op.drop_column('guests', 'monthly_hok_amount')
    if 'donation' in columns:
        op.drop_column('guests', 'donation')
    if 'payment' in columns:
        op.drop_column('guests', 'payment')
    if 'hok_amount_05_24' in columns:
        op.drop_column('guests', 'hok_amount_05_24')
    if 'receipt_sending_concentration' in columns:
        op.drop_column('guests', 'receipt_sending_concentration')
    if 'last_payment_date' in columns:
        op.drop_column('guests', 'last_payment_date')
    if 'last_transaction_date' in columns:
        op.drop_column('guests', 'last_transaction_date')
    if 'last_transaction_amount' in columns:
        op.drop_column('guests', 'last_transaction_amount')
    if 'max_one_time_donation' in columns:
        op.drop_column('guests', 'max_one_time_donation')
    if 'max_recurring_donation' in columns:
        op.drop_column('guests', 'max_recurring_donation')
    
    # היסטוריית תרומות שהוסרה
    if 'donations_2019' in columns:
        op.drop_column('guests', 'donations_2019')
    if 'donations_2020' in columns:
        op.drop_column('guests', 'donations_2020')
    if 'total_donations_2021' in columns:
        op.drop_column('guests', 'total_donations_2021')
    if 'total_donations_2022' in columns:
        op.drop_column('guests', 'total_donations_2022')
    if 'total_donations_2023' in columns:
        op.drop_column('guests', 'total_donations_2023')
    if 'total_donations_2024' in columns:
        op.drop_column('guests', 'total_donations_2024')
    if 'total_donations_2019_2023' in columns:
        op.drop_column('guests', 'total_donations_2019_2023')
    if 'donated_this_year_2024' in columns:
        op.drop_column('guests', 'donated_this_year_2024')
    if 'total_donations' in columns:
        op.drop_column('guests', 'total_donations')
    
    # אירועים ודינרים שהוסרו
    if 'assigned_to_dinners' in columns:
        op.drop_column('guests', 'assigned_to_dinners')
    if 'dinner_2024_invited_by_amount' in columns:
        op.drop_column('guests', 'dinner_2024_invited_by_amount')
    if 'dinner_2022_invited' in columns:
        op.drop_column('guests', 'dinner_2022_invited')
    if 'seating_dinner_feb' in columns:
        op.drop_column('guests', 'seating_dinner_feb')
    if 'seating_dinner_2019' in columns:
        op.drop_column('guests', 'seating_dinner_2019')
    if 'participation_dinner_feb' in columns:
        op.drop_column('guests', 'participation_dinner_feb')
    if 'dinner_contact_person_name' in columns:
        op.drop_column('guests', 'dinner_contact_person_name')
    if 'dinner_contact_person_full_name' in columns:
        op.drop_column('guests', 'dinner_contact_person_full_name')
    if 'blessing_signer_2024' in columns:
        op.drop_column('guests', 'blessing_signer_2024')
    if 'add_logo_2024' in columns:
        op.drop_column('guests', 'add_logo_2024')
    if 'arrival_confirmation_method' in columns:
        op.drop_column('guests', 'arrival_confirmation_method')
    if 'couple_participation' in columns:
        op.drop_column('guests', 'couple_participation')
    
    # הושבות גברים שהוסרו
    if 'men_participation_dinner_feb' in columns:
        op.drop_column('guests', 'men_participation_dinner_feb')
    if 'men_arrived_dinner_feb' in columns:
        op.drop_column('guests', 'men_arrived_dinner_feb')
    
    # הושבות נשים שהוסרו
    if 'women_arrived_dinner_feb' in columns:
        op.drop_column('guests', 'women_arrived_dinner_feb')
    if 'women_title_before' in columns:
        op.drop_column('guests', 'women_title_before')
    
    # כללי שהוסרו
    if 'table_style' in columns:
        op.drop_column('guests', 'table_style')
    if 'temporary_table_seating_dinner_feb' in columns:
        op.drop_column('guests', 'temporary_table_seating_dinner_feb')
    if 'seat_near_participant_1' in columns:
        op.drop_column('guests', 'seat_near_participant_1')
    if 'seat_near_participant_2' in columns:
        op.drop_column('guests', 'seat_near_participant_2')
    if 'donor_status' in columns:
        op.drop_column('guests', 'donor_status')
    if 'donor_style' in columns:
        op.drop_column('guests', 'donor_style')
    if 'occupation_style' in columns:
        op.drop_column('guests', 'occupation_style')
    if 'collection_status_dinner_feb' in columns:
        op.drop_column('guests', 'collection_status_dinner_feb')
    if 'form_check' in columns:
        op.drop_column('guests', 'form_check')
    if 'not_participating' in columns:
        op.drop_column('guests', 'not_participating')
    if 'license_plate' in columns:
        op.drop_column('guests', 'license_plate')
    if 'parking_entry' in columns:
        op.drop_column('guests', 'parking_entry')


def downgrade() -> None:
    # שדות בסיסיים
    op.add_column('guests', sa.Column('address', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('phone', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('referral_source', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('whatsapp_number', sa.String(), nullable=True))
    
    # פרטים אישיים
    op.add_column('guests', sa.Column('first_name_split', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('last_name_split', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('first_name_without_wife', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('nickname', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('wife_name_dinner', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('student_code', sa.String(), nullable=True))
    
    # פרטי קשר
    op.add_column('guests', sa.Column('alt_email', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('work_email', sa.String(), nullable=True))
    
    # מזהים
    op.add_column('guests', sa.Column('identifier', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('import_identifier', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('raf', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('previous_system_id', sa.String(), nullable=True))
    
    # שיוך וניהול
    op.add_column('guests', sa.Column('marked_as_ambassador', sa.Boolean(), nullable=True))
    op.add_column('guests', sa.Column('ambassador_status', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('display_type', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('telephonist_update', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('category', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('women_category', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('invitation_classification', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('arrival_source', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('treatment_status', sa.String(), nullable=True))
    
    # בנקים ותשלומים
    op.add_column('guests', sa.Column('bank_account_name', sa.String(), nullable=True))
    
    # תרומות
    op.add_column('guests', sa.Column('active_hok', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('hok_amount_05_2024', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('monthly_hok_amount', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('donation', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('payment', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('hok_amount_05_24', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('receipt_sending_concentration', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('last_payment_date', sa.DateTime(), nullable=True))
    op.add_column('guests', sa.Column('last_transaction_date', sa.DateTime(), nullable=True))
    op.add_column('guests', sa.Column('last_transaction_amount', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('max_one_time_donation', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('max_recurring_donation', sa.String(), nullable=True))
    
    # היסטוריית תרומות
    op.add_column('guests', sa.Column('donations_2019', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('donations_2020', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('total_donations_2021', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('total_donations_2022', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('total_donations_2023', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('total_donations_2024', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('total_donations_2019_2023', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('donated_this_year_2024', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('total_donations', sa.String(), nullable=True))
    
    # אירועים ודינרים
    op.add_column('guests', sa.Column('assigned_to_dinners', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('dinner_2024_invited_by_amount', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('dinner_2022_invited', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('seating_dinner_feb', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('seating_dinner_2019', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('participation_dinner_feb', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('dinner_contact_person_name', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('dinner_contact_person_full_name', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('blessing_signer_2024', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('add_logo_2024', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('arrival_confirmation_method', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('couple_participation', sa.String(), nullable=True))
    
    # הושבות גברים
    op.add_column('guests', sa.Column('men_participation_dinner_feb', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('men_arrived_dinner_feb', sa.Boolean(), nullable=True))
    
    # הושבות נשים
    op.add_column('guests', sa.Column('women_arrived_dinner_feb', sa.Boolean(), nullable=True))
    op.add_column('guests', sa.Column('women_title_before', sa.String(), nullable=True))
    
    # כללי
    op.add_column('guests', sa.Column('table_style', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('temporary_table_seating_dinner_feb', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('seat_near_participant_1', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('seat_near_participant_2', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('donor_status', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('donor_style', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('occupation_style', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('collection_status_dinner_feb', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('form_check', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('not_participating', sa.Boolean(), nullable=True))
    op.add_column('guests', sa.Column('license_plate', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('parking_entry', sa.String(), nullable=True))

