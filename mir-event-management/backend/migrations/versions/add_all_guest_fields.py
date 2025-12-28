"""add all guest fields to guests table

Revision ID: add_all_guest_fields
Revises: add_15_custom_fields
Create Date: 2025-01-20 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_all_guest_fields'
down_revision: Union[str, Sequence[str], None] = 'add_15_custom_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # בדיקה אם העמודות כבר קיימות
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('guests')]
    
    # פרטים אישיים
    if 'middle_name' not in columns:
        op.add_column('guests', sa.Column('middle_name', sa.String(), nullable=True))
    if 'first_name_split' not in columns:
        op.add_column('guests', sa.Column('first_name_split', sa.String(), nullable=True))
    if 'last_name_split' not in columns:
        op.add_column('guests', sa.Column('last_name_split', sa.String(), nullable=True))
    if 'first_name_without_wife' not in columns:
        op.add_column('guests', sa.Column('first_name_without_wife', sa.String(), nullable=True))
    if 'title_before' not in columns:
        op.add_column('guests', sa.Column('title_before', sa.String(), nullable=True))
    if 'title_after' not in columns:
        op.add_column('guests', sa.Column('title_after', sa.String(), nullable=True))
    if 'nickname' not in columns:
        op.add_column('guests', sa.Column('nickname', sa.String(), nullable=True))
    if 'spouse_name' not in columns:
        op.add_column('guests', sa.Column('spouse_name', sa.String(), nullable=True))
    if 'wife_name' not in columns:
        op.add_column('guests', sa.Column('wife_name', sa.String(), nullable=True))
    if 'wife_name_dinner' not in columns:
        op.add_column('guests', sa.Column('wife_name_dinner', sa.String(), nullable=True))
    if 'age' not in columns:
        op.add_column('guests', sa.Column('age', sa.Integer(), nullable=True))
    if 'birth_date' not in columns:
        op.add_column('guests', sa.Column('birth_date', sa.DateTime(), nullable=True))
    if 'student_code' not in columns:
        op.add_column('guests', sa.Column('student_code', sa.String(), nullable=True))
    if 'language' not in columns:
        op.add_column('guests', sa.Column('language', sa.String(), nullable=True))
    
    # פרטי קשר
    if 'mobile_phone' not in columns:
        op.add_column('guests', sa.Column('mobile_phone', sa.String(), nullable=True))
    if 'home_phone' not in columns:
        op.add_column('guests', sa.Column('home_phone', sa.String(), nullable=True))
    if 'alt_phone_1' not in columns:
        op.add_column('guests', sa.Column('alt_phone_1', sa.String(), nullable=True))
    if 'alt_phone_2' not in columns:
        op.add_column('guests', sa.Column('alt_phone_2', sa.String(), nullable=True))
    if 'email_2' not in columns:
        op.add_column('guests', sa.Column('email_2', sa.String(), nullable=True))
    if 'alt_email' not in columns:
        op.add_column('guests', sa.Column('alt_email', sa.String(), nullable=True))
    if 'work_email' not in columns:
        op.add_column('guests', sa.Column('work_email', sa.String(), nullable=True))
    if 'wife_phone' not in columns:
        op.add_column('guests', sa.Column('wife_phone', sa.String(), nullable=True))
    
    # מזהים
    if 'identifier' not in columns:
        op.add_column('guests', sa.Column('identifier', sa.String(), nullable=True))
    if 'import_identifier' not in columns:
        op.add_column('guests', sa.Column('import_identifier', sa.String(), nullable=True))
    if 'manager_personal_number' not in columns:
        op.add_column('guests', sa.Column('manager_personal_number', sa.String(), nullable=True))
    if 'card_id' not in columns:
        op.add_column('guests', sa.Column('card_id', sa.String(), nullable=True))
    if 'raf' not in columns:
        op.add_column('guests', sa.Column('raf', sa.String(), nullable=True))
    if 'previous_system_id' not in columns:
        op.add_column('guests', sa.Column('previous_system_id', sa.String(), nullable=True))
    
    # שיוך וניהול
    if 'groups' not in columns:
        op.add_column('guests', sa.Column('groups', sa.String(), nullable=True))
    if 'email_group' not in columns:
        op.add_column('guests', sa.Column('email_group', sa.String(), nullable=True))
    if 'user_link' not in columns:
        op.add_column('guests', sa.Column('user_link', sa.String(), nullable=True))
    if 'ambassador_id' not in columns:
        op.add_column('guests', sa.Column('ambassador_id', sa.String(), nullable=True))
    if 'ambassador' not in columns:
        op.add_column('guests', sa.Column('ambassador', sa.String(), nullable=True))
    if 'marked_as_ambassador' not in columns:
        op.add_column('guests', sa.Column('marked_as_ambassador', sa.Boolean(), nullable=True))
    if 'ambassador_status' not in columns:
        op.add_column('guests', sa.Column('ambassador_status', sa.String(), nullable=True))
    if 'display_type' not in columns:
        op.add_column('guests', sa.Column('display_type', sa.String(), nullable=True))
    if 'telephonist_assignment' not in columns:
        op.add_column('guests', sa.Column('telephonist_assignment', sa.String(), nullable=True))
    if 'telephonist_update' not in columns:
        op.add_column('guests', sa.Column('telephonist_update', sa.String(), nullable=True))
    if 'category' not in columns:
        op.add_column('guests', sa.Column('category', sa.String(), nullable=True))
    if 'women_category' not in columns:
        op.add_column('guests', sa.Column('women_category', sa.String(), nullable=True))
    if 'invitation_classification' not in columns:
        op.add_column('guests', sa.Column('invitation_classification', sa.String(), nullable=True))
    if 'arrival_source' not in columns:
        op.add_column('guests', sa.Column('arrival_source', sa.String(), nullable=True))
    if 'synagogue' not in columns:
        op.add_column('guests', sa.Column('synagogue', sa.String(), nullable=True))
    if 'treatment_status' not in columns:
        op.add_column('guests', sa.Column('treatment_status', sa.String(), nullable=True))
    
    # טלפניות ושיחות
    if 'eligibility_status_for_leads' not in columns:
        op.add_column('guests', sa.Column('eligibility_status_for_leads', sa.String(), nullable=True))
    if 'requested_return_date' not in columns:
        op.add_column('guests', sa.Column('requested_return_date', sa.DateTime(), nullable=True))
    if 'last_telephonist_call' not in columns:
        op.add_column('guests', sa.Column('last_telephonist_call', sa.DateTime(), nullable=True))
    if 'last_call_status' not in columns:
        op.add_column('guests', sa.Column('last_call_status', sa.String(), nullable=True))
    if 'notes' not in columns:
        op.add_column('guests', sa.Column('notes', sa.String(), nullable=True))
    if 'telephonist_notes' not in columns:
        op.add_column('guests', sa.Column('telephonist_notes', sa.String(), nullable=True))
    if 'status_description' not in columns:
        op.add_column('guests', sa.Column('status_description', sa.String(), nullable=True))
    
    # כתובת ראשית
    if 'street' not in columns:
        op.add_column('guests', sa.Column('street', sa.String(), nullable=True))
    if 'building_number' not in columns:
        op.add_column('guests', sa.Column('building_number', sa.String(), nullable=True))
    if 'apartment_number' not in columns:
        op.add_column('guests', sa.Column('apartment_number', sa.String(), nullable=True))
    if 'city' not in columns:
        op.add_column('guests', sa.Column('city', sa.String(), nullable=True))
    if 'neighborhood' not in columns:
        op.add_column('guests', sa.Column('neighborhood', sa.String(), nullable=True))
    if 'postal_code' not in columns:
        op.add_column('guests', sa.Column('postal_code', sa.String(), nullable=True))
    if 'country' not in columns:
        op.add_column('guests', sa.Column('country', sa.String(), nullable=True))
    if 'state' not in columns:
        op.add_column('guests', sa.Column('state', sa.String(), nullable=True))
    if 'mailing_address' not in columns:
        op.add_column('guests', sa.Column('mailing_address', sa.String(), nullable=True))
    if 'recipient_name' not in columns:
        op.add_column('guests', sa.Column('recipient_name', sa.String(), nullable=True))
    
    # בנקים ותשלומים
    if 'bank' not in columns:
        op.add_column('guests', sa.Column('bank', sa.String(), nullable=True))
    if 'branch' not in columns:
        op.add_column('guests', sa.Column('branch', sa.String(), nullable=True))
    if 'account_number' not in columns:
        op.add_column('guests', sa.Column('account_number', sa.String(), nullable=True))
    if 'bank_account_name' not in columns:
        op.add_column('guests', sa.Column('bank_account_name', sa.String(), nullable=True))
    if 'credit_card_number' not in columns:
        op.add_column('guests', sa.Column('credit_card_number', sa.String(), nullable=True))
    
    # תרומות
    if 'is_hok_active' not in columns:
        op.add_column('guests', sa.Column('is_hok_active', sa.Boolean(), nullable=True))
    if 'active_hok' not in columns:
        op.add_column('guests', sa.Column('active_hok', sa.String(), nullable=True))
    if 'hok_amount_05_2024' not in columns:
        op.add_column('guests', sa.Column('hok_amount_05_2024', sa.String(), nullable=True))
    if 'monthly_hok_amount' not in columns:
        op.add_column('guests', sa.Column('monthly_hok_amount', sa.String(), nullable=True))
    if 'donation' not in columns:
        op.add_column('guests', sa.Column('donation', sa.String(), nullable=True))
    if 'monthly_hok_amount_nis' not in columns:
        op.add_column('guests', sa.Column('monthly_hok_amount_nis', sa.String(), nullable=True))
    if 'payment' not in columns:
        op.add_column('guests', sa.Column('payment', sa.String(), nullable=True))
    if 'hok_amount_05_24' not in columns:
        op.add_column('guests', sa.Column('hok_amount_05_24', sa.String(), nullable=True))
    if 'receipt_sending_concentration' not in columns:
        op.add_column('guests', sa.Column('receipt_sending_concentration', sa.String(), nullable=True))
    if 'last_payment_date' not in columns:
        op.add_column('guests', sa.Column('last_payment_date', sa.DateTime(), nullable=True))
    if 'last_payment_amount' not in columns:
        op.add_column('guests', sa.Column('last_payment_amount', sa.String(), nullable=True))
    if 'last_transaction_date' not in columns:
        op.add_column('guests', sa.Column('last_transaction_date', sa.DateTime(), nullable=True))
    if 'last_transaction_amount' not in columns:
        op.add_column('guests', sa.Column('last_transaction_amount', sa.String(), nullable=True))
    if 'donations_payments_last_year' not in columns:
        op.add_column('guests', sa.Column('donations_payments_last_year', sa.String(), nullable=True))
    if 'total_donations_payments' not in columns:
        op.add_column('guests', sa.Column('total_donations_payments', sa.String(), nullable=True))
    if 'max_one_time_donation' not in columns:
        op.add_column('guests', sa.Column('max_one_time_donation', sa.String(), nullable=True))
    if 'max_recurring_donation' not in columns:
        op.add_column('guests', sa.Column('max_recurring_donation', sa.String(), nullable=True))
    if 'donation_commitment' not in columns:
        op.add_column('guests', sa.Column('donation_commitment', sa.String(), nullable=True))
    if 'donation_ability' not in columns:
        op.add_column('guests', sa.Column('donation_ability', sa.String(), nullable=True))
    
    # היסטוריית תרומות
    if 'donations_2019' not in columns:
        op.add_column('guests', sa.Column('donations_2019', sa.String(), nullable=True))
    if 'donations_2020' not in columns:
        op.add_column('guests', sa.Column('donations_2020', sa.String(), nullable=True))
    if 'total_donations_2021' not in columns:
        op.add_column('guests', sa.Column('total_donations_2021', sa.String(), nullable=True))
    if 'total_donations_2022' not in columns:
        op.add_column('guests', sa.Column('total_donations_2022', sa.String(), nullable=True))
    if 'total_donations_2023' not in columns:
        op.add_column('guests', sa.Column('total_donations_2023', sa.String(), nullable=True))
    if 'total_donations_2024' not in columns:
        op.add_column('guests', sa.Column('total_donations_2024', sa.String(), nullable=True))
    if 'total_donations_2019_2023' not in columns:
        op.add_column('guests', sa.Column('total_donations_2019_2023', sa.String(), nullable=True))
    if 'donated_this_year_2024' not in columns:
        op.add_column('guests', sa.Column('donated_this_year_2024', sa.String(), nullable=True))
    if 'total_donations' not in columns:
        op.add_column('guests', sa.Column('total_donations', sa.String(), nullable=True))
    
    # אירועים ודינרים
    if 'dinners_participated' not in columns:
        op.add_column('guests', sa.Column('dinners_participated', sa.String(), nullable=True))
    if 'assigned_to_dinners' not in columns:
        op.add_column('guests', sa.Column('assigned_to_dinners', sa.String(), nullable=True))
    if 'dinner_2024_invited_by_amount' not in columns:
        op.add_column('guests', sa.Column('dinner_2024_invited_by_amount', sa.String(), nullable=True))
    if 'dinner_2022_invited' not in columns:
        op.add_column('guests', sa.Column('dinner_2022_invited', sa.String(), nullable=True))
    if 'seating_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('seating_dinner_feb', sa.String(), nullable=True))
    if 'seating_dinner_2019' not in columns:
        op.add_column('guests', sa.Column('seating_dinner_2019', sa.String(), nullable=True))
    if 'participation_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('participation_dinner_feb', sa.String(), nullable=True))
    if 'sponsorship_blessing_status' not in columns:
        op.add_column('guests', sa.Column('sponsorship_blessing_status', sa.String(), nullable=True))
    if 'dinner_contact_person_name' not in columns:
        op.add_column('guests', sa.Column('dinner_contact_person_name', sa.String(), nullable=True))
    if 'dinner_contact_person_full_name' not in columns:
        op.add_column('guests', sa.Column('dinner_contact_person_full_name', sa.String(), nullable=True))
    if 'blessing_content_dinner_2024' not in columns:
        op.add_column('guests', sa.Column('blessing_content_dinner_2024', sa.String(), nullable=True))
    if 'blessing_signer_2024' not in columns:
        op.add_column('guests', sa.Column('blessing_signer_2024', sa.String(), nullable=True))
    if 'add_logo_2024' not in columns:
        op.add_column('guests', sa.Column('add_logo_2024', sa.String(), nullable=True))
    if 'arrival_confirmation_method' not in columns:
        op.add_column('guests', sa.Column('arrival_confirmation_method', sa.String(), nullable=True))
    if 'couple_participation' not in columns:
        op.add_column('guests', sa.Column('couple_participation', sa.String(), nullable=True))
    
    # הושבות גברים
    if 'men_seating_feb' not in columns:
        op.add_column('guests', sa.Column('men_seating_feb', sa.String(), nullable=True))
    if 'men_temporary_seating_feb' not in columns:
        op.add_column('guests', sa.Column('men_temporary_seating_feb', sa.String(), nullable=True))
    if 'men_table_number' not in columns:
        op.add_column('guests', sa.Column('men_table_number', sa.String(), nullable=True))
    if 'men_participation_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('men_participation_dinner_feb', sa.String(), nullable=True))
    if 'men_arrived_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('men_arrived_dinner_feb', sa.Boolean(), nullable=True))
    
    # הושבות נשים
    if 'women_seating_feb' not in columns:
        op.add_column('guests', sa.Column('women_seating_feb', sa.String(), nullable=True))
    if 'women_temporary_seating_feb' not in columns:
        op.add_column('guests', sa.Column('women_temporary_seating_feb', sa.String(), nullable=True))
    if 'women_table_number' not in columns:
        op.add_column('guests', sa.Column('women_table_number', sa.String(), nullable=True))
    if 'women_participation_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('women_participation_dinner_feb', sa.String(), nullable=True))
    if 'women_arrived_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('women_arrived_dinner_feb', sa.Boolean(), nullable=True))
    if 'women_title_before' not in columns:
        op.add_column('guests', sa.Column('women_title_before', sa.String(), nullable=True))
    
    # כללי
    if 'table_style' not in columns:
        op.add_column('guests', sa.Column('table_style', sa.String(), nullable=True))
    if 'temporary_table_seating_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('temporary_table_seating_dinner_feb', sa.String(), nullable=True))
    if 'seat_near_main' not in columns:
        op.add_column('guests', sa.Column('seat_near_main', sa.String(), nullable=True))
    if 'seat_near_participant_1' not in columns:
        op.add_column('guests', sa.Column('seat_near_participant_1', sa.String(), nullable=True))
    if 'seat_near_participant_2' not in columns:
        op.add_column('guests', sa.Column('seat_near_participant_2', sa.String(), nullable=True))
    if 'donor_status' not in columns:
        op.add_column('guests', sa.Column('donor_status', sa.String(), nullable=True))
    if 'donor_style' not in columns:
        op.add_column('guests', sa.Column('donor_style', sa.String(), nullable=True))
    if 'occupation_style' not in columns:
        op.add_column('guests', sa.Column('occupation_style', sa.String(), nullable=True))
    if 'collection_status_dinner_feb' not in columns:
        op.add_column('guests', sa.Column('collection_status_dinner_feb', sa.String(), nullable=True))
    if 'form_check' not in columns:
        op.add_column('guests', sa.Column('form_check', sa.String(), nullable=True))
    if 'not_participating' not in columns:
        op.add_column('guests', sa.Column('not_participating', sa.Boolean(), nullable=True))
    if 'license_plate' not in columns:
        op.add_column('guests', sa.Column('license_plate', sa.String(), nullable=True))
    if 'parking_entry' not in columns:
        op.add_column('guests', sa.Column('parking_entry', sa.String(), nullable=True))


def downgrade() -> None:
    # כללי
    op.drop_column('guests', 'parking_entry')
    op.drop_column('guests', 'license_plate')
    op.drop_column('guests', 'not_participating')
    op.drop_column('guests', 'form_check')
    op.drop_column('guests', 'collection_status_dinner_feb')
    op.drop_column('guests', 'occupation_style')
    op.drop_column('guests', 'donor_style')
    op.drop_column('guests', 'donor_status')
    op.drop_column('guests', 'seat_near_participant_2')
    op.drop_column('guests', 'seat_near_participant_1')
    op.drop_column('guests', 'seat_near_main')
    op.drop_column('guests', 'temporary_table_seating_dinner_feb')
    op.drop_column('guests', 'table_style')
    
    # הושבות נשים
    op.drop_column('guests', 'women_title_before')
    op.drop_column('guests', 'women_arrived_dinner_feb')
    op.drop_column('guests', 'women_participation_dinner_feb')
    op.drop_column('guests', 'women_table_number')
    op.drop_column('guests', 'women_temporary_seating_feb')
    op.drop_column('guests', 'women_seating_feb')
    
    # הושבות גברים
    op.drop_column('guests', 'men_arrived_dinner_feb')
    op.drop_column('guests', 'men_participation_dinner_feb')
    op.drop_column('guests', 'men_table_number')
    op.drop_column('guests', 'men_temporary_seating_feb')
    op.drop_column('guests', 'men_seating_feb')
    
    # אירועים ודינרים
    op.drop_column('guests', 'couple_participation')
    op.drop_column('guests', 'arrival_confirmation_method')
    op.drop_column('guests', 'add_logo_2024')
    op.drop_column('guests', 'blessing_signer_2024')
    op.drop_column('guests', 'blessing_content_dinner_2024')
    op.drop_column('guests', 'dinner_contact_person_full_name')
    op.drop_column('guests', 'dinner_contact_person_name')
    op.drop_column('guests', 'sponsorship_blessing_status')
    op.drop_column('guests', 'participation_dinner_feb')
    op.drop_column('guests', 'seating_dinner_2019')
    op.drop_column('guests', 'seating_dinner_feb')
    op.drop_column('guests', 'dinner_2022_invited')
    op.drop_column('guests', 'dinner_2024_invited_by_amount')
    op.drop_column('guests', 'assigned_to_dinners')
    op.drop_column('guests', 'dinners_participated')
    
    # היסטוריית תרומות
    op.drop_column('guests', 'total_donations')
    op.drop_column('guests', 'donated_this_year_2024')
    op.drop_column('guests', 'total_donations_2019_2023')
    op.drop_column('guests', 'total_donations_2024')
    op.drop_column('guests', 'total_donations_2023')
    op.drop_column('guests', 'total_donations_2022')
    op.drop_column('guests', 'total_donations_2021')
    op.drop_column('guests', 'donations_2020')
    op.drop_column('guests', 'donations_2019')
    
    # תרומות
    op.drop_column('guests', 'donation_ability')
    op.drop_column('guests', 'donation_commitment')
    op.drop_column('guests', 'max_recurring_donation')
    op.drop_column('guests', 'max_one_time_donation')
    op.drop_column('guests', 'total_donations_payments')
    op.drop_column('guests', 'donations_payments_last_year')
    op.drop_column('guests', 'last_transaction_amount')
    op.drop_column('guests', 'last_transaction_date')
    op.drop_column('guests', 'last_payment_amount')
    op.drop_column('guests', 'last_payment_date')
    op.drop_column('guests', 'receipt_sending_concentration')
    op.drop_column('guests', 'hok_amount_05_24')
    op.drop_column('guests', 'payment')
    op.drop_column('guests', 'monthly_hok_amount_nis')
    op.drop_column('guests', 'donation')
    op.drop_column('guests', 'monthly_hok_amount')
    op.drop_column('guests', 'hok_amount_05_2024')
    op.drop_column('guests', 'active_hok')
    op.drop_column('guests', 'is_hok_active')
    
    # בנקים ותשלומים
    op.drop_column('guests', 'credit_card_number')
    op.drop_column('guests', 'bank_account_name')
    op.drop_column('guests', 'account_number')
    op.drop_column('guests', 'branch')
    op.drop_column('guests', 'bank')
    
    # כתובת ראשית
    op.drop_column('guests', 'recipient_name')
    op.drop_column('guests', 'mailing_address')
    op.drop_column('guests', 'state')
    op.drop_column('guests', 'country')
    op.drop_column('guests', 'postal_code')
    op.drop_column('guests', 'neighborhood')
    op.drop_column('guests', 'city')
    op.drop_column('guests', 'apartment_number')
    op.drop_column('guests', 'building_number')
    op.drop_column('guests', 'street')
    
    # טלפניות ושיחות
    op.drop_column('guests', 'status_description')
    op.drop_column('guests', 'telephonist_notes')
    op.drop_column('guests', 'notes')
    op.drop_column('guests', 'last_call_status')
    op.drop_column('guests', 'last_telephonist_call')
    op.drop_column('guests', 'requested_return_date')
    op.drop_column('guests', 'eligibility_status_for_leads')
    
    # שיוך וניהול
    op.drop_column('guests', 'treatment_status')
    op.drop_column('guests', 'synagogue')
    op.drop_column('guests', 'arrival_source')
    op.drop_column('guests', 'invitation_classification')
    op.drop_column('guests', 'women_category')
    op.drop_column('guests', 'category')
    op.drop_column('guests', 'telephonist_update')
    op.drop_column('guests', 'telephonist_assignment')
    op.drop_column('guests', 'display_type')
    op.drop_column('guests', 'ambassador_status')
    op.drop_column('guests', 'marked_as_ambassador')
    op.drop_column('guests', 'ambassador')
    op.drop_column('guests', 'ambassador_id')
    op.drop_column('guests', 'user_link')
    op.drop_column('guests', 'email_group')
    op.drop_column('guests', 'groups')
    
    # מזהים
    op.drop_column('guests', 'previous_system_id')
    op.drop_column('guests', 'raf')
    op.drop_column('guests', 'card_id')
    op.drop_column('guests', 'manager_personal_number')
    op.drop_column('guests', 'import_identifier')
    op.drop_column('guests', 'identifier')
    
    # פרטי קשר
    op.drop_column('guests', 'wife_phone')
    op.drop_column('guests', 'work_email')
    op.drop_column('guests', 'alt_email')
    op.drop_column('guests', 'email_2')
    op.drop_column('guests', 'alt_phone_2')
    op.drop_column('guests', 'alt_phone_1')
    op.drop_column('guests', 'home_phone')
    op.drop_column('guests', 'mobile_phone')
    
    # פרטים אישיים
    op.drop_column('guests', 'language')
    op.drop_column('guests', 'student_code')
    op.drop_column('guests', 'birth_date')
    op.drop_column('guests', 'age')
    op.drop_column('guests', 'wife_name_dinner')
    op.drop_column('guests', 'wife_name')
    op.drop_column('guests', 'spouse_name')
    op.drop_column('guests', 'nickname')
    op.drop_column('guests', 'title_after')
    op.drop_column('guests', 'title_before')
    op.drop_column('guests', 'first_name_without_wife')
    op.drop_column('guests', 'last_name_split')
    op.drop_column('guests', 'first_name_split')
    op.drop_column('guests', 'middle_name')

