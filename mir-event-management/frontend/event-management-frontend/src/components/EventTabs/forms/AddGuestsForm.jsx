import React, { useState, useEffect } from 'react';
import '../../../styles/theme-tropical.css';

export default function AddGuestsForm({ eventId }) {
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [spouseName, setSpouseName] = useState('');
	const [idNumber, setIdNumber] = useState('');

	const [dialCode, setDialCode] = useState('+972');
	const [phone, setPhone] = useState('');
	const [altDialCode, setAltDialCode] = useState('+972');
	const [altPhone, setAltPhone] = useState('');
	const [email, setEmail] = useState('');

	const [street, setStreet] = useState('');
	const [city, setCity] = useState('');
	const [neighborhood, setNeighborhood] = useState('');
	const [buildingNumber, setBuildingNumber] = useState('');
	const [occupation, setOccupation] = useState('');

	const [participationWomen, setParticipationWomen] = useState('');
	const [participationMen, setParticipationMen] = useState('');
	const [donationAbility, setDonationAbility] = useState('');
	const [enteredBy, setEnteredBy] = useState('');
	const [groupAssociation, setGroupAssociation] = useState('ללא שיוך');
	const [tableHeads, setTableHeads] = useState([]); // fetched list of table heads
	const [remarks, setRemarks] = useState('');

	// removed extra guests feature
	const [saving, setSaving] = useState(false);
	const [showErrors, setShowErrors] = useState(false);

	// Dynamic custom fields
	const [customFields, setCustomFields] = useState([]);
	const [customValues, setCustomValues] = useState({});
	const [newFieldName, setNewFieldName] = useState('');
	const [requireNewField, setRequireNewField] = useState(false);
	const role = localStorage.getItem('role');
	const canManageFields = role === 'admin' || role === 'event_admin';
	const [permissionMessage, setPermissionMessage] = useState('');

	useEffect(() => {
		if (!permissionMessage) return;
		const t = setTimeout(() => setPermissionMessage(''), 3000);
		return () => clearTimeout(t);
	}, [permissionMessage]);

	const showNoPermission = () => {
		setPermissionMessage('אין לך את ההרשאות לפעולה זו');
	};

	const inputStyle = { padding: 14, borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff' };
	const tropicalInputClass = 'tropical-input';
	const invalidStyle = { border: '2px solid #ef4444' };
	const isEmailValid = (val) => /^(?!.*\.{2})[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(val.trim());
	
	// Israeli ID validation using Luhn algorithm
	const isIsraeliIdValid = (id) => {
		const trimmed = String(id || '').trim();
		if (!/^\d{5,9}$/.test(trimmed)) return false;
		const paddedId = trimmed.padStart(9, '0');
		let sum = 0;
		for (let i = 0; i < 9; i++) {
			let digit = parseInt(paddedId[i], 10) * ((i % 2) + 1);
			if (digit > 9) digit -= 9;
			sum += digit;
		}
		return sum % 10 === 0;
	};

	// Israeli phone validation
	const isPhoneValid = (phoneNum, code) => {
		const cleaned = String(phoneNum || '').replace(/[\s\-()]/g, '');
		if (!cleaned) return false;
		if (code === '+972') {
			return /^(5\d{8}|[23489]\d{7}|0?5\d{8}|0?[23489]\d{7})$/.test(cleaned);
		}
		return cleaned.length >= 7;
	};

	// Validation errors state
	const [validationErrors, setValidationErrors] = useState({});

	// Real-time field validation on blur
	const validateField = (fieldName, value, extra = {}) => {
		let error = null;
		switch (fieldName) {
			case 'idNumber':
				if (!value.trim()) {
					error = 'תעודת זהות היא שדה חובה';
				} else if (!isIsraeliIdValid(value)) {
					error = 'מספר הזהות אינו תקין';
				}
				break;
			case 'phone':
				if (value.trim() && !isPhoneValid(value, extra.dialCode || '+972')) {
					error = 'מספר הטלפון אינו תקין';
				}
				break;
			case 'email':
				if (value.trim() && !isEmailValid(value)) {
					error = 'כתובת האימייל אינה תקינה';
				}
				break;
			default:
				break;
		}
		setValidationErrors(prev => {
			const newErrors = { ...prev };
			if (error) newErrors[fieldName] = error;
			else delete newErrors[fieldName];
			return newErrors;
		});
		return error;
	};

	const generateSpouseId = () => {
		const base = idNumber.trim();
		if (base) return `${base}-spouse`;
		return `TEMP-${eventId}-spouse-${Date.now()}-${Math.floor(Math.random()*10000)}`;
	};

	const isCustomRequiredFilled = () => customFields.every(f => {
		const isReq = !!(f?.required || String(f?.name || '').trim().endsWith(' *'));
		if (!isReq) return true;
		return String(customValues[f.name] || '').trim() !== '';
	});

	const isRequiredFilled = () => participationMen && participationWomen && enteredBy.trim() && idNumber.trim() && isCustomRequiredFilled();

	// Load all table heads for this event
	useEffect(() => {
		const token = localStorage.getItem('access_token');
		if (!eventId || !token) return;
		fetch(`http://localhost:8001/tables/table-heads/event/${eventId}`, {
			headers: { 'Authorization': `Bearer ${token}` }
		})
		  .then(r => r.ok ? r.json() : [])
		  .then(list => setTableHeads(Array.isArray(list) ? list : []))
		  .catch(() => setTableHeads([]));
	}, [eventId]);

	// Load custom fields for this form
	useEffect(() => {
		(async () => {
			try {
				const token = localStorage.getItem('access_token');
				const res = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields?form_key=add-guests`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				const data = res.ok ? await res.json() : [];
				setCustomFields(Array.isArray(data) ? data : []);
			} catch (e) { console.error('load custom fields failed', e); }
		})();
	}, [eventId]);

	const addField = async () => {
		if (!canManageFields) {
			showNoPermission();
			return;
		}
		const name = newFieldName.trim();
		if (!name) return;
		try {
			await addFieldRequest(eventId, name, requireNewField);
			setNewFieldName('');
			setRequireNewField(false);
			reloadFields();
		} catch (e) { console.error('add custom field failed', e); }
	};

	const reloadFields = async () => {
		try {
			const token = localStorage.getItem('access_token');
			const res = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields?form_key=add-guests`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = res.ok ? await res.json() : [];
			setCustomFields(Array.isArray(data) ? data : []);
		} catch (e) { console.error('reload custom fields failed', e); }
	};

	async function deleteField(fieldId) {
		if (!canManageFields) {
			showNoPermission();
			return;
		}
		try {
			const token = localStorage.getItem('access_token');
			await fetch(`http://localhost:8001/guests/custom-field/${fieldId}`, {
				method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
			});
			reloadFields();
		} catch (e) { console.error('delete custom field failed', e); }
	}

	async function handleSubmit() {
		if (saving) return;
		
		// Validate all fields
		const errors = {};
		if (!idNumber.trim()) {
			errors.idNumber = 'תעודת זהות היא שדה חובה';
		} else if (!isIsraeliIdValid(idNumber)) {
			errors.idNumber = 'מספר הזהות אינו תקין';
		}
		if (phone.trim() && !isPhoneValid(phone, dialCode)) {
			errors.phone = 'מספר הטלפון אינו תקין';
		}
		if (email.trim() && !isEmailValid(email)) {
			errors.email = 'כתובת האימייל אינה תקינה';
		}
		
		if (Object.keys(errors).length > 0) {
			setValidationErrors(errors);
			setShowErrors(true);
			alert(Object.values(errors)[0]);
			return;
		}
		
		if (!isRequiredFilled()) { setShowErrors(true); return; }
		try {
			setSaving(true);
			const token = localStorage.getItem('access_token');
			const mainPayload = {
				event_id: Number(eventId),
				first_name: firstName,
				last_name: lastName,
				id_number: idNumber.trim(),
				// כתובת - שדות נפרדים
				street: street || '',
				building_number: buildingNumber || '',
				neighborhood: neighborhood || '',
				city: city || '',
				// טלפון
				mobile_phone: `${dialCode} ${phone}`.trim(),
				alt_phone_1: altPhone ? `${altDialCode} ${altPhone}`.trim() : '',
				email,
				referral_source: 'add_guests_form',
				gender: 'male',
				// שדות נוספים
				spouse_name: spouseName || '',
				ambassador: enteredBy || '',
				donation_ability: donationAbility || '',
				notes: remarks || '',
				women_participation_dinner_feb: participationWomen || '',
			};
			const res = await fetch('http://localhost:8001/guests', {
				method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
				body: JSON.stringify(mainPayload)
			});
			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`(${res.status}) ${txt}`);
			}
			const mainGuest = await res.json();

			const requests = [];
			// Save all additional fields as field-values to match the screenshot
			if (spouseName) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'שם בת הזוג', spouseName));
			if (altPhone) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'טלפון נוסף', `${altDialCode} ${altPhone}`.trim()));
			if (street) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'רחוב', street));
			if (city) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'עיר', city));
			if (neighborhood) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'שכונה', neighborhood));
			if (buildingNumber) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'מספר בנין', buildingNumber));
			if (occupation) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'עיסוק', occupation));
			if (participationMen) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'השתתפות גברים דינר פ"נ *', participationMen));
			if (participationWomen) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'עדכון השתתפות נשים דינר פ"נ *', participationWomen));
			if (donationAbility) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'יכולת תרומה', donationAbility));
			if (enteredBy) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'הוכנס למערכת ע"י *', enteredBy));
			if (groupAssociation) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'דרך קבוצה (שדה רשות)', groupAssociation));
			if (remarks) requests.push(saveGuestFieldValue(eventId, mainGuest.id, 'הערות', remarks));

			// dynamic custom values
			for (const f of customFields) {
				const val = customValues[f.name];
				if (val !== undefined && val !== null && String(val).trim() !== '') {
					requests.push(saveGuestFieldValue(eventId, mainGuest.id, f.name, String(val)));
				}
			}

			// extra guests removed per request

			await Promise.all(requests);

			// Create spouse automatically based on participation choices
			if (participationMen === 'השתתפות יחיד') {
				// Create wife with same last name
				const spousePayload = {
					event_id: Number(eventId),
					first_name: 'גברת',
					last_name: lastName,
					id_number: generateSpouseId(),
					street: street || '',
					building_number: buildingNumber || '',
					neighborhood: neighborhood || '',
					city: city || '',
					mobile_phone: `${dialCode} ${phone}`.trim(),
					email: email,
					referral_source: 'add_guests_form_spouse',
					gender: 'female',
					ambassador: enteredBy || '',
					donation_ability: donationAbility || '',
					women_participation_dinner_feb: 'השתתפות יחידה נשים',
				};
				
				const spouseRes = await fetch('http://localhost:8001/guests', {
					method: 'POST', 
					headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
					body: JSON.stringify(spousePayload)
				});
				
				if (spouseRes.ok) {
					const spouseGuest = await spouseRes.json();
					// Save spouse participation field
					await saveGuestFieldValue(eventId, spouseGuest.id, 'עדכון השתתפות נשים דינר פ"נ *', 'השתתפות יחידה נשים');
					// Copy other relevant fields to spouse
					if (street) await saveGuestFieldValue(eventId, spouseGuest.id, 'רחוב', street);
					if (city) await saveGuestFieldValue(eventId, spouseGuest.id, 'עיר', city);
					if (neighborhood) await saveGuestFieldValue(eventId, spouseGuest.id, 'שכונה', neighborhood);
					if (buildingNumber) await saveGuestFieldValue(eventId, spouseGuest.id, 'מספר בנין', buildingNumber);
					if (donationAbility) await saveGuestFieldValue(eventId, spouseGuest.id, 'יכולת תרומה', donationAbility);
					if (enteredBy) await saveGuestFieldValue(eventId, spouseGuest.id, 'הוכנס למערכת ע"י *', enteredBy);
					if (remarks) await saveGuestFieldValue(eventId, spouseGuest.id, 'הערות', remarks);
				}
			}

			alert('הוספת האורחים נשמרה בהצלחה');
			// reset
			setFirstName(''); setLastName(''); setSpouseName(''); setIdNumber('');
			setDialCode('+972'); setPhone(''); setAltDialCode('+972'); setAltPhone(''); setEmail('');
			setStreet(''); setCity(''); setNeighborhood(''); setBuildingNumber(''); setOccupation('');
			setParticipationMen(''); setParticipationWomen(''); setDonationAbility(''); setEnteredBy(''); setGroupAssociation('ללא שיוך'); setRemarks('');
			setShowErrors(false);
		} catch (e) {
			console.error(e);
			alert('שגיאה בשמירה: ' + e.message);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="tropical-card" style={{ position: 'relative', padding: '24px' }}>
			{permissionMessage && (
				<div style={{
					position: 'fixed',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					background: 'rgba(15,23,42,0.96)',
					color: '#fff',
					padding: '16px 24px',
					borderRadius: 16,
					fontSize: 14,
					zIndex: 2000,
					boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
					textAlign: 'center',
					minWidth: 260
				}}>
					{permissionMessage}
				</div>
			)}
			<div className="tropical-section-title" style={{ marginBottom: '24px' }}>יש להכין את מספר הפרטים המריבים</div>

			{/* Row 1 */}
			<div className="form-grid">
				<input placeholder="שם פרטי" value={firstName} onChange={e => setFirstName(e.target.value)} className={tropicalInputClass} />
				<input placeholder="שם משפחה" value={lastName} onChange={e => setLastName(e.target.value)} className={tropicalInputClass} />
				<input placeholder="שם בת הזוג" value={spouseName} onChange={e => setSpouseName(e.target.value)} className={tropicalInputClass} />
			</div>

			<div className="form-grid" style={{ marginTop: 12 }}>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input
						placeholder="תעודת זהות *"
						value={idNumber}
						onChange={e => setIdNumber(e.target.value)}
						onBlur={() => validateField('idNumber', idNumber)}
						style={{ ...inputStyle, ...(validationErrors.idNumber ? invalidStyle : {}) }}
					/>
					{validationErrors.idNumber && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.idNumber}</span>}
				</div>
			</div>

			{/* Row 2: phones + email */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
					<select value={altDialCode} onChange={e => setAltDialCode(e.target.value)} className="tropical-input">
						<option value="+972">ישראל +972</option>
						<option value="+1">ארה״ב/קנדה +1</option>
						<option value="+44">בריטניה +44</option>
						<option value="+49">גרמניה +49</option>
						<option value="+33">צרפת +33</option>
						<option value="+34">ספרד +34</option>
						<option value="+39">איטליה +39</option>
						<option value="+31">הולנד +31</option>
						<option value="+7">רוסיה +7</option>
						<option value="+380">אוקראינה +380</option>
						<option value="+91">הודו +91</option>
					</select>
					<input placeholder="טלפון נוסף" value={altPhone} onChange={e => setAltPhone(e.target.value)} className="tropical-input" />
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
						<select value={dialCode} onChange={e => setDialCode(e.target.value)} className="tropical-input">
							<option value="+972">ישראל +972</option>
							<option value="+1">ארה״ב/קנדה +1</option>
							<option value="+44">בריטניה +44</option>
							<option value="+49">גרמניה +49</option>
							<option value="+33">צרפת +33</option>
							<option value="+34">ספרד +34</option>
							<option value="+39">איטליה +39</option>
							<option value="+31">הולנד +31</option>
							<option value="+7">רוסיה +7</option>
							<option value="+380">אוקראינה +380</option>
							<option value="+91">הודו +91</option>
						</select>
						<input 
							placeholder="מספר נייד" 
							value={phone} 
							onChange={e => setPhone(e.target.value)} 
							onBlur={() => validateField('phone', phone, { dialCode })}
							className="tropical-input" 
							style={validationErrors.phone ? invalidStyle : {}}
						/>
					</div>
					{validationErrors.phone && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.phone}</span>}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input 
						placeholder="מייל" 
						value={email} 
						onChange={e => setEmail(e.target.value)} 
						onBlur={() => validateField('email', email)}
						className="tropical-input" 
						style={validationErrors.email ? invalidStyle : {}} 
					/>
					{validationErrors.email && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.email}</span>}
				</div>
			</div>

			{/* Row 3: address */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<input placeholder="שכונה" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="tropical-input" />
				<input placeholder="מספר בנין" value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} className="tropical-input" />
				<input placeholder="רחוב" value={street} onChange={e => setStreet(e.target.value)} className="tropical-input" />
			</div>

			{/* Row 4: city, occupation, men participation */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<select value={participationMen} onChange={e => setParticipationMen(e.target.value)} className="tropical-input" style={showErrors && !participationMen ? invalidStyle : {}}>
					<option value="">השתתפות גברים דינר פ"נ *</option>
					<option value="השתתפות יחיד">השתתפות יחיד</option>
					<option value='לא משתתף חו"ל'>לא משתתף חו"ל</option>
					<option value="לא משתתף אחר">לא משתתף אחר</option>
					<option value="לא משתתף עם משפחתית">לא משתתף עם משפחתית</option>
					<option value="ספק">ספק</option>
				</select>
				<input placeholder="עיסוק" value={occupation} onChange={e => setOccupation(e.target.value)} className="tropical-input" />
				<input placeholder="עיר" value={city} onChange={e => setCity(e.target.value)} className="tropical-input" />
			</div>
			{showErrors && !participationMen && (
				<div className="tropical-alert tropical-alert-error" style={{ fontSize: 12, marginTop: -8, padding: '4px 8px' }}>חובה</div>
			)}

			{/* Row 5: entered by, donation ability, women participation */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<input placeholder='הוכנס למערכת ע"י *' value={enteredBy} onChange={e => setEnteredBy(e.target.value)} className="tropical-input" style={showErrors && !enteredBy.trim() ? invalidStyle : {}} />
				<select value={donationAbility} onChange={e => setDonationAbility(e.target.value)} className="tropical-input">
					<option value="">יכולת תרומה:</option>
					<option value='הו"ק גבוהה'>הו"ק גבוהה</option>
					<option value='הו"ק רגילה'>הו"ק רגילה</option>
					<option value="יכולת גבוהה">יכולת גבוהה</option>
					<option value="לא ידוע">לא ידוע</option>
					<option value="VIP">VIP</option>
				</select>
				<select value={participationWomen} onChange={e => setParticipationWomen(e.target.value)} className="tropical-input" style={showErrors && !participationWomen ? invalidStyle : {}}>
					<option value="">עדכון השתתפות נשים דינר פ"נ *</option>
					<option value="השתתפות יחידה נשים">השתתפות יחידה נשים</option>
					<option value='לא משתתפת חו"ל'>לא משתתפת חו"ל</option>
					<option value="לא משתתפת אחר">לא משתתפת אחר</option>
					<option value="לא משתתפת עם משפחתית">לא משתתפת עם משפחתית</option>
					<option value="ספק">ספק</option>
				</select>
			</div>

			{/* Dynamic custom fields */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				{customFields.map((f) => {
					const isReq = !!(f?.required || String(f.name).trim().endsWith(' *'));
					const hasVal = String(customValues[f.name] || '').trim() !== '';
					return (
						<div key={f.id} style={{ display: 'grid', gridTemplateColumns: canManageFields ? '1fr auto' : '1fr', alignItems: 'center', gap: 8 }}>
							<input
								placeholder={isReq && !String(f.name).trim().endsWith(' *') ? `${f.name} *` : f.name}
								value={customValues[f.name] || ''}
								onChange={e => setCustomValues(v => ({ ...v, [f.name]: e.target.value }))}
								className="tropical-input"
								style={showErrors && isReq && !hasVal ? invalidStyle : {}}
							/>
							<button
								type="button"
								onClick={() => deleteField(f.id)}
								title="מחק שדה"
								style={{
									padding: '6px 8px',
									borderRadius: 10,
									border: '1px solid #e2e8f0',
									background: canManageFields ? '#fff' : '#e5e7eb',
									cursor: canManageFields ? 'pointer' : 'not-allowed',
									opacity: canManageFields ? 1 : 0.7
								}}
							>
								✕
							</button>
						</div>
					);
				})}
				<div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 8 }}>
					<label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', opacity: canManageFields ? 1 : 0.7 }}>
						<input
							type="checkbox"
							checked={requireNewField}
							disabled={!canManageFields}
							onChange={e => setRequireNewField(e.target.checked)}
						/> שדה חובה
					</label>
					<input
						placeholder="הוספת שדה"
						value={newFieldName}
						onChange={e => setNewFieldName(e.target.value)}
						onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }}
						style={inputStyle}
					/>
					<button
						type="button"
						onClick={addField}
						disabled={!newFieldName.trim()}
						style={{
							padding: '6px 12px',
							borderRadius: 10,
							border: '1px solid #e2e8f0',
							background: newFieldName.trim() ? '#fff' : '#e5e7eb',
							cursor: newFieldName.trim() ? 'pointer' : 'not-allowed',
							opacity: canManageFields ? 1 : 0.8
						}}
					>
						שמור
					</button>
				</div>
			</div>
			{showErrors && (!enteredBy.trim() || !participationWomen) && (
				<div style={{ color: '#ef4444', fontSize: 12, marginTop: -8 }}>חובה</div>
			)}

			{/* Row 6: group association + remarks */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<select value={groupAssociation} onChange={e => setGroupAssociation(e.target.value)} className="tropical-input" style={{ height: 48 }}>
					<option value="ללא שיוך">ללא שיוך</option>
					{tableHeads.map(th => (
						<option key={th.id || th.last_name} value={th.last_name}>{th.last_name}</option>
					))}
				</select>
				<div />
				<textarea placeholder="הערות:" value={remarks} onChange={e => setRemarks(e.target.value)} style={{ ...inputStyle, minHeight: 120 }} />
			</div>

			<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
				<button type="button" onClick={handleSubmit} disabled={saving} className="tropical-button-primary">
					שמירה
				</button>
			</div>

		</div>
	);
}

function saveGuestFieldValue(eventId, guestId, field_name, value) {
	const token = localStorage.getItem('access_token');
	return fetch(`http://localhost:8001/events/${eventId}/guests/${guestId}/field-values`, {
		method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
		body: JSON.stringify({ guest_id: guestId, field_name, value })
	});
} 

async function addFieldRequest(eventId, name, required) {
	const token = localStorage.getItem('access_token');
	await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ field_name: name, field_type: 'text', form_key: 'add-guests', required })
	});
}
