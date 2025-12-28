import React, { useEffect, useState } from 'react';
import '../../../styles/theme-tropical.css';

const PARTICIPATION_WOMEN = [
	'השתתפות יחידה נשים',
	'לא משתתפת אחר',
	'לא משתתפת חו"ל',
	'לא משתתפת עם משפחתית',
	'ספק'
];

const PARTICIPATION_MEN = [
	'השתתפות יחיד',
	'לא משתתף אחר',
	'לא משתתף חו"ל',
	'לא משתתף עם משפחתית',
	'ספק'
];

export default function IncreaseSddForm({ eventId }) {
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [spouseName, setSpouseName] = useState('');
	const [idNumber, setIdNumber] = useState('');

	const [dialCode, setDialCode] = useState('+972');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');

	const [street, setStreet] = useState('');
	const [city, setCity] = useState('');
	const [neighborhood, setNeighborhood] = useState('');
	const [buildingNumber, setBuildingNumber] = useState('');
	const [apartment, setApartment] = useState('');
	const [occupation, setOccupation] = useState('');

	const [sddIncrease, setSddIncrease] = useState('');
	const [participationWomen, setParticipationWomen] = useState('');
	const [participationMen, setParticipationMen] = useState('');
	const [donationAbility, setDonationAbility] = useState('');
	const [enteredBy, setEnteredBy] = useState('');
	const [blessingOption, setBlessingOption] = useState(''); // הוספת פרטים עכשיו | לא נצרך | שימוש בברכה של הדינר הקודם
	const [remarks, setRemarks] = useState(''); // תוכן הברכה
	const [blessingSigner, setBlessingSigner] = useState('');
	const [blessingLogo, setBlessingLogo] = useState(null);
	const [previousBlessingMeta, setPreviousBlessingMeta] = useState(null);
	const [previousBlessingError, setPreviousBlessingError] = useState(null);
	const [previousBlessingLoading, setPreviousBlessingLoading] = useState(false);
	const [extraGuestsMain, setExtraGuestsMain] = useState('');
	const [extraGuests, setExtraGuests] = useState([]); // [{firstName,lastName,idNumber,gender,seatNear}]
	const [seatNearMain, setSeatNearMain] = useState('');
	const [saving, setSaving] = useState(false);
	const [showErrors, setShowErrors] = useState(false);
	const [loadedGuestFields, setLoadedGuestFields] = useState(null);

	// Dynamic custom fields for this form
	const [customFields, setCustomFields] = useState([]); // [{id,name,field_type}]
	const [customValues, setCustomValues] = useState({}); // name->value
	const [newFieldName, setNewFieldName] = useState('');
	const [requireNewField, setRequireNewField] = useState(false);
	const role = localStorage.getItem('role');
	const canManageFields = role === 'admin' || role === 'event_admin';
	const [permissionMessage, setPermissionMessage] = useState('');

	const inputStyle = { padding: 14, borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff' };
	const compactInputStyle = { ...inputStyle, padding: 10, borderRadius: 12, fontSize: 14 };
	const invalidStyle = { border: '2px solid #ef4444' };
	const isEmailValid = (val) => /^(?!.*\.{2})[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(val.trim());
	const generateTempId = () => `TEMP-${eventId}-${Date.now()}-${Math.floor(Math.random()*10000)}`;

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

	useEffect(() => {
		if (!permissionMessage) return;
		const t = setTimeout(() => setPermissionMessage(''), 3000);
		return () => clearTimeout(t);
	}, [permissionMessage]);

	const showNoPermission = () => {
		setPermissionMessage('אין לך את ההרשאות לפעולה זו');
	};

	useEffect(() => {
		// load custom fields for this form
		(async () => {
			try {
				const token = localStorage.getItem('access_token');
				const res = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields?form_key=increase-sdd`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				const data = res.ok ? await res.json() : [];
				setCustomFields(Array.isArray(data) ? data : []);
			} catch (e) { console.error('load custom fields failed', e); }
		})();
	}, [eventId]);

	const reloadFields = async () => {
		try {
			const token = localStorage.getItem('access_token');
			const res = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields?form_key=increase-sdd`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = res.ok ? await res.json() : [];
			setCustomFields(Array.isArray(data) ? data : []);
		} catch (e) { console.error('reload custom fields failed', e); }
	};

	// sync extra guests array with selected count
	useEffect(() => {
		const count = Number(extraGuestsMain) || 0;
		setExtraGuests(prev => {
			const arr = [...prev];
			if (count > arr.length) {
				for (let i = arr.length; i < count; i++) {
					arr.push({ firstName: '', lastName: '', idNumber: '', gender: '', seatNear: '' });
				}
			}
			if (count < arr.length) {
				arr.length = count;
			}
			return arr;
		});
	}, [extraGuestsMain]);

	useEffect(() => {
		const trimmedId = idNumber.trim();
		if (!trimmedId || trimmedId.length < 5 || !eventId) {
			setLoadedGuestFields(null);
			return;
		}

		let cancelled = false;

		const fetchGuest = async () => {
			try {
				const token = localStorage.getItem('access_token');
				if (!token) {
					throw new Error('לא נמצא אסימון אימות');
				}
				const res = await fetch(`http://localhost:8001/guests/events/${eventId}/guests/by-id-number?id_number=${encodeURIComponent(trimmedId)}`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (cancelled) return;
				if (!res.ok) {
					setLoadedGuestFields(null);
					return;
				}
				const data = await res.json();
				if (cancelled) return;

				const guest = data?.guest ?? {};
				const fields = { ...(data?.fields ?? {}) };

				setFirstName(guest.first_name || '');
				setLastName(guest.last_name || '');

				const phoneValue = guest.phone || '';
				if (phoneValue) {
					const parts = phoneValue.trim().split(/\s+/);
					if (parts.length > 1 && parts[0].startsWith('+')) {
						setDialCode(parts[0]);
						setPhone(parts.slice(1).join(' '));
					} else {
						setPhone(phoneValue);
					}
				} else {
					setPhone('');
				}

				setEmail(guest.email || '');

				if (fields['שם בת הזוג'] !== undefined) {
					setSpouseName(fields['שם בת הזוג'] || '');
					delete fields['שם בת הזוג'];
				}
				if (fields['רחוב'] !== undefined) {
					setStreet(fields['רחוב'] || '');
					delete fields['רחוב'];
				}
				if (fields['עיר'] !== undefined) {
					setCity(fields['עיר'] || '');
					delete fields['עיר'];
				}
				if (fields['שכונה'] !== undefined) {
					setNeighborhood(fields['שכונה'] || '');
					delete fields['שכונה'];
				}
				if (fields['מספר בנין'] !== undefined) {
					setBuildingNumber(fields['מספר בנין'] || '');
					delete fields['מספר בנין'];
				}
				if (fields['מספר דירה'] !== undefined) {
					setApartment(fields['מספר דירה'] || '');
					delete fields['מספר דירה'];
				}
				if (fields['עיסוק'] !== undefined) {
					setOccupation(fields['עיסוק'] || '');
					delete fields['עיסוק'];
				}
				if (fields['הגדלת הו"ק חודשית ב:'] !== undefined) {
					setSddIncrease(fields['הגדלת הו"ק חודשית ב:'] || '');
					delete fields['הגדלת הו"ק חודשית ב:'];
				}
				if (fields['השתתפות גברים דינר פ"נ *'] !== undefined) {
					setParticipationMen(fields['השתתפות גברים דינר פ"נ *'] || '');
					delete fields['השתתפות גברים דינר פ"נ *'];
				}
				if (fields['עדכון השתתפות נשים דינר פ"נ *'] !== undefined) {
					setParticipationWomen(fields['עדכון השתתפות נשים דינר פ"נ *'] || '');
					delete fields['עדכון השתתפות נשים דינר פ"נ *'];
				}
				if (fields['יכולת תרומה'] !== undefined) {
					setDonationAbility(fields['יכולת תרומה'] || '');
					delete fields['יכולת תרומה'];
				}
				if (fields['הוכנס למערכת ע"י *'] !== undefined) {
					setEnteredBy(fields['הוכנס למערכת ע"י *'] || '');
					delete fields['הוכנס למערכת ע"י *'];
				}
				if (fields['ברכה בספר הברכות'] !== undefined) {
					setBlessingOption(fields['ברכה בספר הברכות'] || '');
					delete fields['ברכה בספר הברכות'];
				}
				if (fields['ברכה - חותם'] !== undefined) {
					setBlessingSigner(fields['ברכה - חותם'] || '');
					delete fields['ברכה - חותם'];
				}
				if (fields['ברכה - תוכן'] !== undefined) {
					setRemarks(fields['ברכה - תוכן'] || '');
					delete fields['ברכה - תוכן'];
				}
				if (fields['ברכה - לוגו'] !== undefined) {
					setBlessingLogo(null);
					delete fields['ברכה - לוגו'];
				}
				if (fields['הבאת אורח/ת נוסף/ת *'] !== undefined) {
					setExtraGuestsMain(fields['הבאת אורח/ת נוסף/ת *'] || '');
					delete fields['הבאת אורח/ת נוסף/ת *'];
				}
				if (fields['ליד מי תרצו לשבת? (משתתף ראשי)'] !== undefined) {
					setSeatNearMain(fields['ליד מי תרצו לשבת? (משתתף ראשי)'] || '');
					delete fields['ליד מי תרצו לשבת? (משתתף ראשי)'];
				}

				setLoadedGuestFields(fields);
			} catch (error) {
				if (cancelled) return;
				console.error('fetch guest by id failed', error);
				setLoadedGuestFields(null);
			}
		};

		fetchGuest();

		return () => {
			cancelled = true;
		};
	}, [idNumber, eventId]);

	useEffect(() => {
		if (!loadedGuestFields) {
			setCustomValues({});
			return;
		}
		const next = {};
		customFields.forEach((field) => {
			if (loadedGuestFields[field.name] !== undefined) {
				next[field.name] = loadedGuestFields[field.name] ?? '';
			}
		});
		setCustomValues(next);
	}, [customFields, loadedGuestFields]);

	useEffect(() => {
		let cancelled = false;

		const fetchPreviousGreeting = async () => {
			// קודם כל נבדוק אם יש ברכה באירוע הנוכחי לפי שם וטלפון
			const trimmedFirstName = firstName.trim();
			const trimmedLastName = lastName.trim();
			const trimmedPhone = phone.trim();
			const fullPhone = dialCode && phone ? `${dialCode}${phone}` : phone;

			setPreviousBlessingLoading(true);
			setPreviousBlessingError(null);
			setPreviousBlessingMeta(null);

			try {
				const token = localStorage.getItem('access_token');
				if (!token) {
					throw new Error('לא נמצא אסימון אימות');
				}

				// ניסיון 1: חיפוש באירוע הנוכחי לפי שם וטלפון
				if ((trimmedFirstName || trimmedLastName) && trimmedPhone) {
					const currentResponse = await fetch(
						`http://localhost:8001/greetings/current/by-name-phone?event_id=${eventId}&first_name=${encodeURIComponent(trimmedFirstName)}&last_name=${encodeURIComponent(trimmedLastName)}&phone=${encodeURIComponent(fullPhone)}`,
						{ headers: { Authorization: `Bearer ${token}` } }
					);

					if (cancelled) return;

					if (currentResponse.ok) {
						const currentData = await currentResponse.json();
						setBlessingSigner(currentData.signer_name || '');
						setRemarks(currentData.formatted_content || currentData.content || '');
						setPreviousBlessingMeta({
							eventName: 'אירוע נוכחי',
							eventDate: null,
						});
						if (!cancelled) {
							setPreviousBlessingLoading(false);
						}
						return; // מצאנו ברכה באירוע הנוכחי, לא צריך לחפש באירועים קודמים
					}
				}

				// ניסיון 2: חיפוש באירועים קודמים לפי תעודת זהות
				const trimmedId = idNumber.trim();
				if (!trimmedId) {
					setPreviousBlessingError('יש להזין תעודת זהות או שם וטלפון לפני שימוש בברכה קודמת');
					setBlessingOption('');
					if (!cancelled) {
						setPreviousBlessingLoading(false);
					}
					return;
				}

				const response = await fetch(`http://localhost:8001/greetings/previous/by-id?event_id=${eventId}&id_number=${encodeURIComponent(trimmedId)}`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				if (cancelled) return;

				if (!response.ok) {
					if (response.status === 404) {
						setPreviousBlessingError('לא נמצאה ברכה מדינר קודם');
						setBlessingSigner('');
						setRemarks('');
						return;
					}
					const body = await response.json().catch(() => ({}));
					throw new Error(body.detail || 'לא ניתן לטעון ברכה קודמת');
				}

				const data = await response.json();
				setBlessingSigner(data.signer_name || '');
				setRemarks(data.content || '');
				setPreviousBlessingMeta({
					eventName: data.event_name || '',
					eventDate: data.event_date || null,
				});
			} catch (error) {
				if (cancelled) return;
				setPreviousBlessingError(error.message || 'לא ניתן לטעון ברכה קודמת');
				setBlessingSigner('');
				setRemarks('');
			} finally {
				if (!cancelled) {
					setPreviousBlessingLoading(false);
				}
			}
		};

		if (blessingOption === 'שימוש בברכה של הדינר הקודם') {
			fetchPreviousGreeting();
		} else {
			setPreviousBlessingMeta(null);
			setPreviousBlessingError(null);
			setPreviousBlessingLoading(false);
		}

		return () => {
			cancelled = true;
		};
	}, [blessingOption, idNumber, eventId, firstName, lastName, phone, dialCode]);

	const updateExtra = (idx, patch) => {
		setExtraGuests(prev => {
			const arr = [...prev];
			arr[idx] = { ...arr[idx], ...patch };
			return arr;
		});
	};

	const isCustomRequiredFilled = () => customFields.every(f => {
		const isReq = !!(f?.required || String(f?.name || '').trim().endsWith(' *'));
		if (!isReq) return true;
		return String(customValues[f.name] || '').trim() !== '';
	});
	const isMainGuestIdValid = () => idNumber.trim().length >= 5;
	const isRequiredFilled = () => participationMen && participationWomen && enteredBy.trim() && isCustomRequiredFilled() && isMainGuestIdValid();

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
			const payload = {
				event_id: Number(eventId),
				first_name: firstName,
				last_name: lastName,
				id_number: idNumber.trim(),
				// כתובת - שדות נפרדים
				street: street || '',
				building_number: buildingNumber || '',
				apartment_number: apartment || '',
				neighborhood: neighborhood || '',
				city: city || '',
				// טלפון
				mobile_phone: `${dialCode} ${phone}`.trim(),
				email,
				referral_source: 'increase_sdd_form',
				gender: 'male',
				// שדות נוספים
				spouse_name: spouseName || '',
				ambassador: enteredBy || '',
				donation_ability: donationAbility || '',
				seat_near_main: seatNearMain || '',
				women_participation_dinner_feb: participationWomen || '',
			};
			const res = await fetch('http://localhost:8001/guests', {
				method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`(${res.status}) ${txt}`);
			}
			const guest = await res.json();

			const requests = [];
			if (spouseName) requests.push(saveGuestFieldValue(eventId, guest.id, 'שם בת הזוג', spouseName));
			if (street) requests.push(saveGuestFieldValue(eventId, guest.id, 'רחוב', street));
			if (buildingNumber) requests.push(saveGuestFieldValue(eventId, guest.id, 'מספר בנין', buildingNumber));
			if (apartment) requests.push(saveGuestFieldValue(eventId, guest.id, 'מספר דירה', apartment));
			if (neighborhood) requests.push(saveGuestFieldValue(eventId, guest.id, 'שכונה', neighborhood));
			if (city) requests.push(saveGuestFieldValue(eventId, guest.id, 'עיר', city));
			if (occupation) requests.push(saveGuestFieldValue(eventId, guest.id, 'עיסוק', occupation));
			if (sddIncrease) requests.push(saveGuestFieldValue(eventId, guest.id, 'הגדלת הו"ק חודשית ב:', sddIncrease));
			if (participationMen) requests.push(saveGuestFieldValue(eventId, guest.id, 'השתתפות גברים דינר פ"נ *', participationMen));
			if (participationWomen) requests.push(saveGuestFieldValue(eventId, guest.id, 'עדכון השתתפות נשים דינר פ"נ *', participationWomen));
			if (donationAbility) requests.push(saveGuestFieldValue(eventId, guest.id, 'יכולת תרומה', donationAbility));
			if (enteredBy) requests.push(saveGuestFieldValue(eventId, guest.id, 'הוכנס למערכת ע"י *', enteredBy));
			if (blessingOption) requests.push(saveGuestFieldValue(eventId, guest.id, 'ברכה בספר הברכות', blessingOption));
			if (
				blessingOption === 'הוספת פרטים עכשיו' ||
				(blessingOption === 'שימוש בברכה של הדינר הקודם' && (blessingSigner.trim() || remarks.trim()))
			) {
				if (blessingSigner) requests.push(saveGuestFieldValue(eventId, guest.id, 'ברכה - חותם', blessingSigner));
				if (remarks) requests.push(saveGuestFieldValue(eventId, guest.id, 'ברכה - תוכן', remarks));
				if (blessingLogo) requests.push(saveGuestFieldValue(eventId, guest.id, 'ברכה - לוגו', blessingLogo.name));
				
				// שמירת ברכה במודל Greeting
				if (remarks && blessingSigner) {
					const formData = new FormData();
					formData.append('guest_id', guest.id);
					formData.append('event_id', eventId);
					formData.append('content', remarks);
					formData.append('formatted_content', remarks);
					formData.append('signer_name', blessingSigner);
					if (blessingLogo) {
						formData.append('file', blessingLogo);
					}
					
					try {
						const greetingResponse = await fetch('http://localhost:8001/greetings/with-file', {
							method: 'POST',
							headers: { 'Authorization': `Bearer ${token}` },
							body: formData
						});
						if (!greetingResponse.ok) {
							console.error('Error saving greeting:', await greetingResponse.text());
						}
					} catch (err) {
						console.error('Error saving greeting:', err);
					}
				}
			}
			requests.push(saveGuestFieldValue(eventId, guest.id, 'הבאת אורח/ת נוסף/ת *', String(Number(extraGuestsMain) || 0)));
			if (seatNearMain) requests.push(saveGuestFieldValue(eventId, guest.id, 'ליד מי תרצו לשבת? (משתתף ראשי)', seatNearMain));

			// Create extra guests
			for (let i = 0; i < extraGuests.length; i++) {
				const eg = extraGuests[i];
				if (!eg.firstName && !eg.lastName) continue;
				const egPayload = {
					event_id: Number(eventId),
					first_name: eg.firstName || '',
					last_name: eg.lastName || '',
					address: '',
					phone: '',
					email: '',
					referral_source: 'extra_guest',
					gender: eg.gender === 'זכר' ? 'male' : eg.gender === 'נקבה' ? 'female' : 'male'
				};
				if ((eg.idNumber || '').trim()) { egPayload.id_number = eg.idNumber.trim(); }
				/* eslint-disable no-await-in-loop */
				const r = await fetch('http://localhost:8001/guests', {
					method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
					body: JSON.stringify(egPayload)
				});
				if (r.ok) {
					const gjson = await r.json();
					if (eg.seatNear) await saveGuestFieldValue(eventId, gjson.id, `ליד מי תרצו לשבת? (משתתף ${i+1})`, eg.seatNear);
				}
			}

			// Save dynamic custom field values
			for (const f of customFields) {
				const val = customValues[f.name];
				if (val !== undefined && val !== null && String(val).trim() !== '') {
					requests.push(saveGuestFieldValue(eventId, guest.id, f.name, String(val)));
				}
			}
			await Promise.all(requests);

			// Create spouse automatically based on participation choices
			if (participationWomen === 'השתתפות יחידה נשים') {
				// Create husband with same last name
				const spousePayload = {
					event_id: Number(eventId),
					first_name: 'הרב',
					last_name: lastName, // Same last name as the woman
					id_number: generateTempId(),
					address: [street, buildingNumber, neighborhood, city].filter(Boolean).join(' '),
					phone: `${dialCode} ${phone}`.trim(), // Same phone
					email: email, // Same email
					referral_source: 'increase_sdd_form_spouse',
					gender: 'male'
				};
				
				const spouseRes = await fetch('http://localhost:8001/guests', {
					method: 'POST', 
					headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
					body: JSON.stringify(spousePayload)
				});
				
				if (spouseRes.ok) {
					const spouseGuest = await spouseRes.json();
					// Save spouse participation field
					await saveGuestFieldValue(eventId, spouseGuest.id, 'עדכון השתתפות גברים דינר פ"נ *', 'השתתפות יחיד');
					// Copy other relevant fields to spouse
					if (occupation) await saveGuestFieldValue(eventId, spouseGuest.id, 'עיסוק', occupation);
					if (donationAbility) await saveGuestFieldValue(eventId, spouseGuest.id, 'יכולת תרומה', donationAbility);
					if (enteredBy) await saveGuestFieldValue(eventId, spouseGuest.id, 'הוכנס למערכת ע"י *', enteredBy);
				}
			} else if (participationMen === 'השתתפות יחיד') {
				// Create wife with same last name
				const spousePayload = {
					event_id: Number(eventId),
					first_name: 'גברת',
					last_name: lastName, // Same last name as the man
					id_number: generateTempId(),
					address: [street, buildingNumber, neighborhood, city].filter(Boolean).join(' '),
					phone: `${dialCode} ${phone}`.trim(), // Same phone
					email: email, // Same email
					referral_source: 'increase_sdd_form_spouse',
					gender: 'female'
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
					if (occupation) await saveGuestFieldValue(eventId, spouseGuest.id, 'עיסוק', occupation);
					if (donationAbility) await saveGuestFieldValue(eventId, spouseGuest.id, 'יכולת תרומה', donationAbility);
					if (enteredBy) await saveGuestFieldValue(eventId, spouseGuest.id, 'הוכנס למערכת ע"י *', enteredBy);
				}
			}

			alert('הטופס נשמר בהצלחה');
			setFirstName(''); setLastName(''); setSpouseName(''); setIdNumber('');
			setDialCode('+972'); setPhone(''); setEmail('');
			setStreet(''); setCity(''); setNeighborhood(''); setBuildingNumber(''); setApartment(''); setOccupation('');
			setSddIncrease(''); setParticipationMen(''); setParticipationWomen(''); setDonationAbility(''); setEnteredBy(''); setBlessingOption(''); setRemarks(''); setBlessingSigner(''); setBlessingLogo(null); setExtraGuestsMain(''); setExtraGuests([]); setSeatNearMain('');
			setShowErrors(false);
		} catch (e) {
			console.error(e);
			alert('שגיאה בשמירה: ' + e.message);
		} finally {
			setSaving(false);
		}
	}

	async function handleAddCustomField() {
		if (!canManageFields) {
			showNoPermission();
			return;
		}
		const name = newFieldName.trim();
		if (!name) return;
		try {
			const token = localStorage.getItem('access_token');
			await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ field_name: name, field_type: 'text', form_key: 'increase-sdd', required: requireNewField })
			});
			setNewFieldName('');
			// reload list
			const res = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields?form_key=increase-sdd`, {
				headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
			});
			const data = res.ok ? await res.json() : [];
			setCustomFields(Array.isArray(data) ? data : []);
		} catch (e) { console.error('add custom field failed', e); }
	}

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

	return (
		<div style={{ background: '#f3f4f6', borderRadius: 16, padding: 20, position: 'relative' }}>
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
			<div style={{ textAlign: 'center', marginBottom: 22 }}>
				<div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a' }}>עד לפתיחת שערים</div>
			</div>

			{/* Row 1: first, last, email */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
				<input placeholder="שם פרטי (משתתף ראשי)" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
				<input placeholder="שם משפחה (משתתף ראשי)" value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input 
						placeholder="מייל (משתתף ראשי)" 
						value={email} 
						onChange={e => setEmail(e.target.value)} 
						onBlur={() => validateField('email', email)}
						style={{ ...inputStyle, ...(validationErrors.email ? invalidStyle : {}) }} 
					/>
					{validationErrors.email && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.email}</span>}
				</div>
			</div>

			{/* Row 1.5: ID number */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 12 }}>
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

			{/* Row 2: phone (single) */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
						<select value={dialCode} onChange={e => setDialCode(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
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
							placeholder="מספר נייד (משתתף ראשי)" 
							value={phone} 
							onChange={e => setPhone(e.target.value)} 
							onBlur={() => validateField('phone', phone, { dialCode })}
							style={{ ...inputStyle, ...(validationErrors.phone ? invalidStyle : {}) }} 
						/>
					</div>
					{validationErrors.phone && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.phone}</span>}
				</div>
				<input placeholder="עיר" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
				<input placeholder="רחוב" value={street} onChange={e => setStreet(e.target.value)} style={inputStyle} />
			</div>

			{/* Row 3: building, apt (street moved up) */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<input placeholder="מספר בניין" value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} style={inputStyle} />
				<input placeholder="מספר דירה" value={apartment} onChange={e => setApartment(e.target.value)} style={inputStyle} />
				<input placeholder='הוכנס למערכת ע"י *' value={enteredBy} onChange={e => setEnteredBy(e.target.value)} style={{ ...inputStyle, ...(showErrors && !enteredBy.trim() ? invalidStyle : {}) }} />
			</div>

			{/* Row 4: HOK, blessing select */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<select value={sddIncrease} onChange={e => setSddIncrease(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
					<option value="">הגדלת הו"ק חודשית ב:</option>
					{Array.from({ length: 10 }, (_, i) => (i + 1) * 100).map(v => (
						<option key={v} value={`${v}₪`}>{`${v}₪`}</option>
					))}
				</select>
				<select value={blessingOption} onChange={e => setBlessingOption(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
					<option value="">ברכה בספר הברכות</option>
					<option value="הוספת פרטים עכשיו">הוספת פרטים עכשיו</option>
					<option value="לא נצרך">לא נצרך</option>
					<option value="שימוש בברכה של הדינר הקודם">שימוש בברכה של הדינר הקודם</option>
				</select>
				<input placeholder="ליד מי תרצו לשבת? (משתתף ראשי)" value={seatNearMain} onChange={e => setSeatNearMain(e.target.value)} style={inputStyle} />
			</div>

			{/* Row 4.5: participation selections */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<select
					value={participationWomen}
					onChange={e => setParticipationWomen(e.target.value)}
					style={{ ...inputStyle, background: '#fff', ...(showErrors && !participationWomen ? invalidStyle : {}) }}
				>
					<option value="">עדכון השתתפות נשים דינר פ"נ *</option>
					{PARTICIPATION_WOMEN.map(opt => (
						<option key={opt} value={opt}>{opt}</option>
					))}
				</select>
				<select
					value={participationMen}
					onChange={e => setParticipationMen(e.target.value)}
					style={{ ...inputStyle, background: '#fff', ...(showErrors && !participationMen ? invalidStyle : {}) }}
				>
					<option value="">עדכון השתתפות גברים דינר פ"נ *</option>
					{PARTICIPATION_MEN.map(opt => (
						<option key={opt} value={opt}>{opt}</option>
					))}
				</select>
				<div />
			</div>

			{(blessingOption === 'הוספת פרטים עכשיו' || blessingOption === 'שימוש בברכה של הדינר הקודם') && (
				<div style={{ marginTop: 12 }}>
					{blessingOption === 'שימוש בברכה של הדינר הקודם' && (
						<div style={{ marginBottom: 12, background: '#f1f5f9', borderRadius: 12, padding: 12, fontSize: 14, color: '#0f172a' }}>
							{previousBlessingLoading && 'טוען ברכה קודמת...'}
							{!previousBlessingLoading && previousBlessingError && <span>{previousBlessingError}</span>}
							{!previousBlessingLoading && !previousBlessingError && previousBlessingMeta && (
								<span>
									הברכה נטענה מאירוע {previousBlessingMeta.eventName || ''}{previousBlessingMeta.eventDate ? ` (${new Date(previousBlessingMeta.eventDate).toLocaleDateString()})` : ''}.
								</span>
							)}
						</div>
					)}
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
						<input placeholder="שם חותם הברכה" value={blessingSigner} onChange={e => setBlessingSigner(e.target.value)} style={compactInputStyle} />
						<textarea placeholder="תוכן הברכה *" value={remarks} onChange={e => setRemarks(e.target.value)} style={{ ...compactInputStyle, minHeight: 60 }} />
						<input type="file" accept="image/*" onChange={e => setBlessingLogo(e.target.files?.[0] || null)} style={compactInputStyle} />
					</div>
				</div>
			)}

			{/* Row 5: donation ability, extra guests */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				<select value={donationAbility} onChange={e => setDonationAbility(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
					<option value="">יכולת תרומה:</option>
					<option value='הו"ק גבוהה'>הו"ק גבוהה</option>
					<option value='הו"ק רגילה'>הו"ק רגילה</option>
					<option value="יכולת גבוהה">יכולת גבוהה</option>
					<option value="לא ידוע">לא ידוע</option>
					<option value="VIP">VIP</option>
				</select>
				<select value={(extraGuestsMain === '' || extraGuestsMain === '0' || extraGuestsMain === 0) ? '' : extraGuestsMain} onChange={e => setExtraGuestsMain(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
					<option value="" disabled>הבאת אורח/ת נוספ/ת *</option>
					{[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
				</select>
				<div />
			</div>

			{/* Extra guests dynamic fields */}
			{extraGuests.length > 0 && (
				<div style={{ marginTop: 12 }}>
					{extraGuests.map((g, idx) => (
						<div key={idx} style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 10 }}>
							<input placeholder={`שם פרטי משתתף (${idx+1})`} value={g.firstName} onChange={e => updateExtra(idx, { firstName: e.target.value })} style={inputStyle} />
							<input placeholder={`שם משפחה משתתף (${idx+1})`} value={g.lastName} onChange={e => updateExtra(idx, { lastName: e.target.value })} style={inputStyle} />
							<input placeholder={`מספר זהות משתתף (${idx+1})`} value={g.idNumber} onChange={e => updateExtra(idx, { idNumber: e.target.value })} style={inputStyle} />
							<select value={g.gender} onChange={e => updateExtra(idx, { gender: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
								<option value="">מגדר</option>
								<option value="זכר">זכר</option>
								<option value="נקבה">נקבה</option>
							</select>
							<input placeholder={`ליד מי תרצו לשבת? (משתתף ${idx+1})`} value={g.seatNear} onChange={e => updateExtra(idx, { seatNear: e.target.value })} style={inputStyle} />
						</div>
					))}
				</div>
			)}


			{/* Row 6: dynamic custom fields and add-input */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
				{customFields.map((f) => {
					const isReq = !!(f?.required || String(f.name).trim().endsWith(' *'));
					const hasVal = String(customValues[f.name] || '').trim() !== '';
					return (
						<div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
							<input
								placeholder={isReq && !String(f.name).trim().endsWith(' *') ? `${f.name} *` : f.name}
								value={customValues[f.name] || ''}
								onChange={e => setCustomValues(v => ({ ...v, [f.name]: e.target.value }))}
								style={{ ...inputStyle, ...(showErrors && isReq && !hasVal ? invalidStyle : {}) }}
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
				{/* add-field control as a field in-grid */}
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
						onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomField(); } }}
						style={inputStyle}
					/>
					<button
						type="button"
						onClick={handleAddCustomField}
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