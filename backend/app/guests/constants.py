BASE_FORM_FIELDS = [
    {"key": "first_name", "label": "שם", "field_type": "text", "required": True},
    {"key": "last_name", "label": "שם משפחה", "field_type": "text", "required": True},
    {"key": "id_number", "label": "תעודת זהות", "field_type": "text", "required": True},
    {"key": "phone", "label": "טלפון", "field_type": "text", "required": True},
    {"key": "email", "label": "אימייל", "field_type": "text", "required": True},
    {
        "key": "gender",
        "label": "מגדר",
        "field_type": "select",
        "required": True,
        "options": [
            {"value": "male", "label": "זכר"},
            {"value": "female", "label": "נקבה"},
        ],
    },
    {
        "key": "referral_source",
        "label": "מי הביא אותך?",
        "field_type": "text",
        "required": False,
    },
]


