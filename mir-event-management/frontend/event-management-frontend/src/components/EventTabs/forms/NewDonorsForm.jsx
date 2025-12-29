import React, { useState, useRef, useEffect } from 'react';
import NedarimPlusIframe from '../../NedarimPlusIframe.jsx';
import '../../../styles/theme-tropical.css';

export default function NewDonorsForm({ eventId }) {
	const [donationAmount, setDonationAmount] = useState(0);
	const [isRecurring, setIsRecurring] = useState(false);
	const [months, setMonths] = useState(24);
	const [currency, setCurrency] = useState('ILS');
	const [paymentTab, setPaymentTab] = useState('credit');
	const [step, setStep] = useState(1); // 1: amounts, 2: details, 3: payment
	const topRef = useRef(null);
	const [details, setDetails] = useState({
		firstName: '',
		lastName: '',
		phone: '',
		email: '',
		idNumber: '',
		city: '',
		street: '',
		apt: '',
		gender: '',
		seatNear: '',      // ליד מי תרצו לשבת
		enteredBy: ''      // הוכנס למערכת ע"י
	});
	const [guestId, setGuestId] = useState(null);
	const [saving, setSaving] = useState(false);
	const [showErrors, setShowErrors] = useState(false);
	
	// Nedarim Plus configuration
	const [nedarimConfig, setNedarimConfig] = useState(null);
	const [paymentCompleted, setPaymentCompleted] = useState(false);

	// Dynamic custom fields (per form)
	const [customFields, setCustomFields] = useState([]); // [{id,name,field_type}]
	const [customValues, setCustomValues] = useState({}); // name->value
	const [newFieldName, setNewFieldName] = useState('');
	const [requireNewField, setRequireNewField] = useState(false);

	// Participation (דינר פ"נ)
	const [participationWomen, setParticipationWomen] = useState('');
	const [participationMen, setParticipationMen] = useState('');

	// Greeting (ברכה בספר הברכות)
	const [greetingOption, setGreetingOption] = useState(''); // 'now' | 'not_needed' | 'reuse_previous'
	const [greetingSigner, setGreetingSigner] = useState('');
	const [greetingContent, setGreetingContent] = useState('');
	const [greetingLogo, setGreetingLogo] = useState(null); // file
	const [previousGreetingMeta, setPreviousGreetingMeta] = useState(null);
	const [previousGreetingError, setPreviousGreetingError] = useState(null);
	const [previousGreetingLoading, setPreviousGreetingLoading] = useState(false);

	// Extra guests
	const [extraCount, setExtraCount] = useState(''); // placeholder, then 0..6
	const [extraGuests, setExtraGuests] = useState([]); // [{firstName,lastName,idNumber,gender,seatNear}]
	useEffect(() => {
		const count = Number(extraCount) || 0;
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
	}, [extraCount]);

	useEffect(() => {
		if (topRef.current) {
			topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}, [step]);

	// Load custom fields for this form
	useEffect(() => {
		(async () => {
			try {
				const token = localStorage.getItem('access_token');
				const res = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields?form_key=new-donors`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				const data = res.ok ? await res.json() : [];
				setCustomFields(Array.isArray(data) ? data : []);
			} catch (e) { console.error('load custom fields failed', e); }
		})();
	}, [eventId]);
	
	// Load Nedarim Plus configuration
	useEffect(() => {
		(async () => {
			try {
				const token = localStorage.getItem('access_token');
				const res = await fetch(`http://localhost:8001/payments/config`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (res.ok) {
					const config = await res.json();
					setNedarimConfig(config);
				}
			} catch (e) { console.error('load nedarim config failed', e); }
		})();
	}, []);

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

	useEffect(() => {
		let cancelled = false;

		const fetchPreviousGreeting = async () => {
			// קודם כל נבדוק אם יש ברכה באירוע הנוכחי לפי שם וטלפון
			const trimmedFirstName = (details.firstName || '').trim();
			const trimmedLastName = (details.lastName || '').trim();
			const trimmedPhone = (details.phone || '').trim();

			setPreviousGreetingLoading(true);
			setPreviousGreetingError(null);
			setPreviousGreetingMeta(null);

			try {
				const token = localStorage.getItem('access_token');
				if (!token) {
					throw new Error('לא נמצא אסימון אימות');
				}

				// ניסיון 1: חיפוש באירוע הנוכחי לפי שם וטלפון
				if ((trimmedFirstName || trimmedLastName) && trimmedPhone) {
					const currentResponse = await fetch(
						`http://localhost:8001/greetings/current/by-name-phone?event_id=${eventId}&first_name=${encodeURIComponent(trimmedFirstName)}&last_name=${encodeURIComponent(trimmedLastName)}&phone=${encodeURIComponent(trimmedPhone)}`,
						{ headers: { Authorization: `Bearer ${token}` } }
					);

					if (cancelled) return;

					if (currentResponse.ok) {
						const currentData = await currentResponse.json();
						setGreetingSigner(currentData.signer_name || '');
						setGreetingContent(currentData.formatted_content || currentData.content || '');
						setPreviousGreetingMeta({
							eventName: 'אירוע נוכחי',
							eventDate: null,
						});
						if (!cancelled) {
							setPreviousGreetingLoading(false);
						}
						return; // מצאנו ברכה באירוע הנוכחי, לא צריך לחפש באירועים קודמים
					}
				}

				// ניסיון 2: חיפוש באירועים קודמים לפי תעודת זהות
				const trimmedId = (details.idNumber || '').trim();
				if (!trimmedId) {
					setPreviousGreetingError('יש להזין תעודת זהות או שם וטלפון לפני שימוש בברכה קודמת');
					setGreetingOption('');
					if (!cancelled) {
						setPreviousGreetingLoading(false);
					}
					return;
				}

				const response = await fetch(`http://localhost:8001/greetings/previous/by-id?event_id=${eventId}&id_number=${encodeURIComponent(trimmedId)}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (cancelled) return;
				if (!response.ok) {
					if (response.status === 404) {
						setPreviousGreetingError('לא נמצאה ברכה מדינר קודם');
						setGreetingSigner('');
						setGreetingContent('');
						return;
					}
					const errorBody = await response.json().catch(() => ({}));
					throw new Error(errorBody.detail || 'לא ניתן לטעון ברכה קודמת');
				}
				const data = await response.json();
				setGreetingSigner(data.signer_name || '');
				setGreetingContent(data.content || '');
				setPreviousGreetingMeta({
					eventName: data.event_name || '',
					eventDate: data.event_date || null,
				});
			} catch (error) {
				if (cancelled) return;
				setPreviousGreetingError(error.message || 'לא ניתן לטעון ברכה קודמת');
				setGreetingSigner('');
				setGreetingContent('');
			} finally {
				if (!cancelled) {
					setPreviousGreetingLoading(false);
				}
			}
		};

		if (greetingOption === 'reuse_previous') {
			fetchPreviousGreeting();
		} else {
			setPreviousGreetingMeta(null);
			setPreviousGreetingError(null);
			setPreviousGreetingLoading(false);
		}

		return () => {
			cancelled = true;
		};
	}, [greetingOption, details.idNumber, details.firstName, details.lastName, details.phone, eventId]);

	const reloadFields = async () => {
		try {
			const token = localStorage.getItem('access_token');
			const res = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields?form_key=new-donors`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = res.ok ? await res.json() : [];
			setCustomFields(Array.isArray(data) ? data : []);
		} catch (e) { console.error('reload custom fields failed', e); }
	};

	// Add dynamic field (inside component to access state)
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

	const generateTempId = () => `TEMP-${eventId}-${Date.now()}-${Math.floor(Math.random()*10000)}`;

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

	// Includes a ₪1 test option for quick end-to-end checks
	const presetTiles = [
		{ title: 'בדיקה ₪1', amount: 1, per: 'חד פעמי' },
		{ title: 'ידיד', amount: 250, per: 'לחודש × 24' },
		{ title: 'מחזיק', amount: 360, per: 'לחודש × 24' },
		{ title: 'תומך', amount: 500, per: 'לחודש' },
		{ title: 'נועם נשאול', amount: 720, per: 'לחודש' },
		{ title: 'שותף', amount: 1000, per: 'לחודש' },
		{ title: 'זכות התורה אברך', amount: 1500, per: 'לחודש' },
		{ title: 'זכות התורה חברותא', amount: 3000, per: 'לחודש' },
		{ title: 'אוהב תורה', amount: 3600, per: 'לחודש' },
		{ title: 'פרנס חברות י"ח עשרה ת"ח', amount: 18000, per: 'לחודש' },
		{ title: 'פרנס חברות י"ח ת"ח', amount: 25000, per: 'לחודש' },
		{ title: 'פרנס ההסעות ליום', amount: 36000 },
		{ title: 'זכות בית המדרש', amount: 100000 },
	];

	const renderDonationHeader = () => (
		<div style={{
			display: 'flex', alignItems: 'center', justifyContent: 'space-between',
			background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
			boxShadow: '0 6px 18px rgba(0,0,0,0.06)'
		}}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
				<select value={currency} onChange={e => setCurrency(e.target.value)}
					style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontWeight: 700 }}>
					<option value="ILS">₪ ILS</option>
				</select>
				<input
					type="number"
					min={0}
					value={donationAmount || ''}
					onChange={e => setDonationAmount(Number(e.target.value) || 0)}
					placeholder="הזנת סכום חופשי"
					style={{ width: 200, padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'left', fontSize: 18 }}
				/>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#334155' }}>
					<input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
					הוראת קבע בסכום זה למשך
				</label>
				<select disabled={!isRecurring} value={months} onChange={e => setMonths(Number(e.target.value))}
					style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', minWidth: 80, fontWeight: 700 }}>
					{[12, 18, 24, 36].map(m => <option key={m} value={m}>{m}</option>)}
				</select>
				<span style={{ fontWeight: 700 }}>חודשים</span>
			</div>
		</div>
	);

	const renderDonationTiles = () => (
		<div style={{
			display: 'grid',
			gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
			gap: 18,
			marginTop: 16
		}}>
			{presetTiles.map((t, i) => {
				const selected = donationAmount === t.amount;
				return (
					<button key={i} onClick={() => setDonationAmount(t.amount)}
						style={{
							textAlign: 'center', background: selected ? 'linear-gradient(180deg,#eef2ff,#ffffff)' : '#fff', borderRadius: 16,
							border: selected ? '2px solid #6366f1' : '1px solid #e2e8f0',
							padding: 20, minHeight: 140, boxShadow: selected ? '0 10px 22px rgba(99,102,241,0.25)' : '0 4px 12px rgba(0,0,0,0.05)',
							cursor: 'pointer', transition: 'all .15s ease-in-out'
						}}>
						<div style={{ color: '#475569', marginBottom: 8, fontWeight: 800 }}>{t.title}</div>
						<div style={{ fontSize: 36, fontWeight: 900 }}>₪{t.amount.toLocaleString()}</div>
						{t.per && <div style={{ color: '#64748b', marginTop: 6 }}>{t.per}</div>}
					</button>
				);
			})}
		</div>
	);

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

	// Israeli phone validation (landline or mobile)
	const isPhoneValid = (phone) => {
		const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
		// Israeli mobile: 05X-XXXXXXX (10 digits starting with 05)
		// Israeli landline: 0X-XXXXXXX (9-10 digits starting with 0)
		// Also allow international format with country code
		return /^(0[23489]\d{7}|05\d{8}|(\+972|972)[235489]\d{7,8})$/.test(cleaned);
	};

	// Validation errors state
	const [validationErrors, setValidationErrors] = useState({});
	
	// Real-time field validation on blur
	const validateField = (fieldName, value) => {
		let error = null;
		
		switch (fieldName) {
			case 'firstName':
				if (!value.trim()) error = 'שם פרטי הוא שדה חובה';
				break;
			case 'lastName':
				if (!value.trim()) error = 'שם משפחה הוא שדה חובה';
				break;
			case 'idNumber':
				if (!value.trim()) {
					error = 'מספר זהות הוא שדה חובה';
				} else if (!isIsraeliIdValid(value)) {
					error = 'מספר הזהות אינו תקין';
				}
				break;
			case 'phone':
				if (value.trim() && !isPhoneValid(value)) {
					error = 'מספר הטלפון אינו תקין (נדרש מספר ישראלי)';
				}
				break;
			case 'email':
				if (value.trim() && !isEmailValid(value)) {
					error = 'כתובת האימייל אינה תקינה';
				}
				break;
			case 'city':
				if (!value.trim()) error = 'עיר היא שדה חובה';
				break;
			case 'gender':
				if (!value.trim()) error = 'יש לבחור מגדר';
				break;
			default:
				break;
		}
		
		setValidationErrors(prev => {
			const newErrors = { ...prev };
			if (error) {
				newErrors[fieldName] = error;
			} else {
				delete newErrors[fieldName];
			}
			return newErrors;
		});
		
		return error;
	};
	
	const handleFieldBlur = (fieldName) => {
		validateField(fieldName, details[fieldName] || '');
	};
	const isDetailsValid = () => {
		const { firstName, lastName, phone, email, idNumber, city, gender } = details;
		const hasValidContact = (phone.trim() && isPhoneValid(phone)) || (email.trim() && isEmailValid(email));
		const customOk = customFields.every(f => {
			const isReq = !!(f?.required || String(f?.name || '').trim().endsWith(' *'));
			if (!isReq) return true;
			return String(customValues[f.name] || '').trim() !== '';
		});
		return (
			firstName.trim() &&
			lastName.trim() &&
			hasValidContact &&
			isIsraeliIdValid(idNumber) &&
			city.trim() &&
			gender.trim() &&
			(!email.trim() || isEmailValid(email)) &&
			(!phone.trim() || isPhoneValid(phone)) &&
			customOk
		);
	};

	const validateForm = () => {
		const errors = {};
		const { firstName, lastName, phone, email, idNumber, city, gender } = details;
		
		if (!firstName.trim()) errors.firstName = 'שם פרטי הוא שדה חובה';
		if (!lastName.trim()) errors.lastName = 'שם משפחה הוא שדה חובה';
		if (!city.trim()) errors.city = 'עיר היא שדה חובה';
		if (!gender.trim()) errors.gender = 'יש לבחור מגדר';
		
		// ID validation
		if (!idNumber.trim()) {
			errors.idNumber = 'מספר זהות הוא שדה חובה';
		} else if (!isIsraeliIdValid(idNumber)) {
			errors.idNumber = 'מספר הזהות אינו תקין';
		}
		
		// Contact validation - at least one required
		const hasPhone = phone.trim().length >= 9;
		const hasEmail = email.trim().length >= 5;
		if (!hasPhone && !hasEmail) {
			errors.contact = 'יש להזין טלפון או אימייל';
		}
		
		// Phone validation
		if (phone.trim() && !isPhoneValid(phone)) {
			errors.phone = 'מספר הטלפון אינו תקין (נדרש מספר ישראלי)';
		}
		
		// Email validation
		if (email.trim() && !isEmailValid(email)) {
			errors.email = 'כתובת האימייל אינה תקינה';
		}
		
		// Custom fields validation
		customFields.forEach(f => {
			const isReq = !!(f?.required || String(f?.name || '').trim().endsWith(' *'));
			const hasVal = String(customValues[f.name] || '').trim() !== '';
			if (isReq && !hasVal) {
				errors[`custom_${f.id}`] = `${f.name} הוא שדה חובה`;
			}
		});
		
		return errors;
	};

	const handleSaveAndContinue = async () => {
		const errors = validateForm();
		setValidationErrors(errors);
		
		if (Object.keys(errors).length > 0 || saving) {
			setShowErrors(true);
			// Show first error as alert
			const firstError = Object.values(errors)[0];
			if (firstError) {
				alert(firstError);
			}
			return;
		}
		try {
			setSaving(true);
			const token = localStorage.getItem('access_token');
			const payload = {
				event_id: Number(eventId),
				first_name: details.firstName,
				last_name: details.lastName,
				id_number: details.idNumber,
				// כתובת - שדות נפרדים כמו בדטהבייס
				street: details.street || '',
				apartment_number: details.apt || '',
				city: details.city || '',
				// טלפון - שם השדה הנכון בדטהבייס
				mobile_phone: details.phone || '',
				email: details.email,
				referral_source: null,
				gender: details.gender,
				// שמירת בחירות ההשתתפות
				women_participation_dinner_feb: participationWomen || '',
				// ליד מי תרצו לשבת
				seat_near_main: details.seatNear || '',
				// הוכנס למערכת ע"י -> שגריר
				ambassador: details.enteredBy || '',
				// סכום התרומה
				last_payment_amount: donationAmount ? String(donationAmount) : '',
			};
			const res = await fetch(`http://localhost:8001/guests`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const txt = await res.text();
				try {
					const errJson = JSON.parse(txt);
					if (errJson.detail) {
						throw new Error(errJson.detail);
					}
				} catch (parseErr) {
					// If not JSON, use raw text
				}
				throw new Error(`(${res.status}) ${txt}`);
			}
			const guest = await res.json();
			setGuestId(guest?.id || null);

			// Save greeting as field-values if chosen
			if (greetingOption) {
				await saveGuestFieldValue(eventId, guest.id, 'ברכה - מצב', greetingOption);
				if (
					greetingOption === 'now' ||
					(greetingOption === 'reuse_previous' && (greetingSigner.trim() || greetingContent.trim()))
				) {
					if (greetingSigner) await saveGuestFieldValue(eventId, guest.id, 'ברכה - חותם', greetingSigner);
					if (greetingContent) await saveGuestFieldValue(eventId, guest.id, 'ברכה - תוכן', greetingContent);
					// לוגו: שליחה נפרדת/אופציונלית אם יש API לקבצים. נשמור רק שם קובץ כעת
					if (greetingLogo) await saveGuestFieldValue(eventId, guest.id, 'ברכה - לוגו', greetingLogo.name);
					
					// שמירת ברכה במודל Greeting
					if (greetingContent && greetingSigner) {
						const formData = new FormData();
						formData.append('guest_id', guest.id);
						formData.append('event_id', eventId);
						formData.append('content', greetingContent);
						formData.append('formatted_content', greetingContent);
						formData.append('signer_name', greetingSigner);
						if (greetingLogo) {
							formData.append('file', greetingLogo);
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
			}

			// Save participation choices as field-values
			if (participationWomen) await saveGuestFieldValue(eventId, guest.id, 'עדכון השתתפות נשים דינר פ"נ *', participationWomen);
			if (participationMen) await saveGuestFieldValue(eventId, guest.id, 'עדכון השתתפות גברים דינר פ"נ *', participationMen);

			// Save dynamic custom field values
			await Promise.all(customFields.map(f => {
				const val = customValues[f.name];
				if (val !== undefined && val !== null && String(val).trim() !== '') {
					return saveGuestFieldValue(eventId, guest.id, f.name, String(val));
				}
				return null;
			}));

			// Create extra guests concurrently
			await Promise.all(extraGuests.map(async (eg, i) => {
				if (!eg.firstName && !eg.lastName) return null;
				const egPayload = {
					event_id: Number(eventId),
					first_name: eg.firstName || '',
					last_name: eg.lastName || '',
					// only send id_number if provided
					address: '',
					phone: '',
					email: '',
					referral_source: 'extra_guest',
					gender: eg.gender || details.gender || 'male'
				};
				if ((eg.idNumber || '').trim()) { egPayload.id_number = eg.idNumber.trim(); }
				const r = await fetch(`http://localhost:8001/guests`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
					body: JSON.stringify(egPayload)
				});
				if (r.ok) {
					const gjson = await r.json();
					if (eg.seatNear) await saveGuestFieldValue(eventId, gjson.id, `ליד מי תרצו לשבת? (משתתף ${i+1})`, eg.seatNear);
				}
				return null;
			}));

			setStep(3);
		} catch (e) {
			console.error('Save donor failed:', e);
			alert(e.message);
		} finally {
			setSaving(false);
		}
	};

	const renderDetailsPanel = () => (
		<div ref={topRef} style={{
			marginTop: 24,
			background: '#fff',
			border: '1px solid #e2e8f0',
			borderRadius: 16,
			padding: 20,
			boxShadow: '0 10px 28px rgba(0,0,0,0.08)'
		}}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
				<div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>
					פרטי נותן תרומה • {isRecurring ? `₪${donationAmount.toLocaleString()} לחודש × ${months}` : `₪${donationAmount.toLocaleString()} חד פעמי`}
				</div>
				<div style={{ display: 'flex', gap: 10 }}>
					<button onClick={() => setStep(1)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>חזרה</button>
				</div>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input placeholder="שם פרטי *" value={details.firstName} 
						onChange={e => setDetails({ ...details, firstName: e.target.value })} 
						onBlur={() => handleFieldBlur('firstName')}
						style={{ ...inputStyle, border: validationErrors.firstName ? '2px solid #ef4444' : inputStyle.border }} />
					{validationErrors.firstName && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.firstName}</span>}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input placeholder="שם משפחה *" value={details.lastName} 
						onChange={e => setDetails({ ...details, lastName: e.target.value })} 
						onBlur={() => handleFieldBlur('lastName')}
						style={{ ...inputStyle, border: validationErrors.lastName ? '2px solid #ef4444' : inputStyle.border }} />
					{validationErrors.lastName && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.lastName}</span>}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input placeholder="מספר זהות *" value={details.idNumber} 
						onChange={e => setDetails({ ...details, idNumber: e.target.value })} 
						onBlur={() => handleFieldBlur('idNumber')}
						style={{ ...inputStyle, border: validationErrors.idNumber ? '2px solid #ef4444' : inputStyle.border }} />
					{validationErrors.idNumber && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.idNumber}</span>}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input placeholder="טלפון" value={details.phone} 
						onChange={e => setDetails({ ...details, phone: e.target.value })} 
						onBlur={() => handleFieldBlur('phone')}
						style={{ ...inputStyle, border: validationErrors.phone ? '2px solid #ef4444' : inputStyle.border }} />
					{validationErrors.phone && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.phone}</span>}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input placeholder="אימייל" value={details.email} 
						onChange={e => setDetails({ ...details, email: e.target.value })} 
						onBlur={() => handleFieldBlur('email')}
						style={{ ...inputStyle, border: validationErrors.email ? '2px solid #ef4444' : inputStyle.border }} />
					{validationErrors.email && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.email}</span>}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<select value={details.gender} 
						onChange={e => { setDetails({ ...details, gender: e.target.value }); validateField('gender', e.target.value); }} 
						style={{ ...inputStyle, background: '#fff', border: validationErrors.gender ? '2px solid #ef4444' : inputStyle.border }}>
						<option value="">בחר מגדר *</option>
						<option value="זכר">זכר</option>
						<option value="נקבה">נקבה</option>
					</select>
					{validationErrors.gender && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.gender}</span>}
				</div>

				{/* עדכון השתתפות נשים דינר פ"נ */}
				<select value={participationWomen} onChange={e => setParticipationWomen(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
					<option value="">עדכון השתתפות נשים דינר פ"נ *</option>
					<option value="השתתפות יחידה נשים">השתתפות יחידה נשים</option>
					<option value="לא משתתפת אחר">לא משתתפת אחר</option>
					<option value='לא משתתפת חו"ל'>לא משתתפת חו"ל</option>
					<option value="לא משתתפת עם משפחתית">לא משתתפת עם משפחתית</option>
					<option value="ספק">ספק</option>
				</select>

				{/* עדכון השתתפות גברים דינר פ"נ */}
				<select value={participationMen} onChange={e => setParticipationMen(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
					<option value="">עדכון השתתפות גברים דינר פ"נ *</option>
					<option value="השתתפות יחיד">השתתפות יחיד</option>
					<option value="לא משתתף אחר">לא משתתף אחר</option>
					<option value='לא משתתף חו"ל'>לא משתתף חו"ל</option>
					<option value="לא משתתף עם משפחתית">לא משתתף עם משפחתית</option>
					<option value="ספק">ספק</option>
				</select>

				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<input placeholder="עיר *" value={details.city} 
						onChange={e => setDetails({ ...details, city: e.target.value })} 
						onBlur={() => handleFieldBlur('city')}
						style={{ ...inputStyle, border: validationErrors.city ? '2px solid #ef4444' : inputStyle.border }} />
					{validationErrors.city && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.city}</span>}
				</div>
				<input placeholder="רחוב" value={details.street} onChange={e => setDetails({ ...details, street: e.target.value })} style={inputStyle} />
				<input placeholder="דירה" value={details.apt} onChange={e => setDetails({ ...details, apt: e.target.value })} style={inputStyle} />
				<input placeholder="ליד מי תרצו לשבת?" value={details.seatNear} onChange={e => setDetails({ ...details, seatNear: e.target.value })} style={inputStyle} />
				<input placeholder="הוכנס למערכת ע״י" value={details.enteredBy} onChange={e => setDetails({ ...details, enteredBy: e.target.value })} style={inputStyle} />
			</div>

			{/* Dynamic custom fields */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
				{customFields.map((f) => {
					const isReq = !!(f?.required || String(f.name).trim().endsWith(' *'));
					const hasVal = String(customValues[f.name] || '').trim() !== '';
					return (
						<div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
							<input
								placeholder={isReq && !String(f.name).trim().endsWith(' *') ? `${f.name} *` : f.name}
								value={customValues[f.name] || ''}
								onChange={e => setCustomValues(v => ({ ...v, [f.name]: e.target.value }))}
								style={{ padding: 14, borderRadius: 16, border: (showErrors && isReq && !hasVal) ? '1px solid #ef4444' : '1px solid #e2e8f0' }}
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
						style={{ padding: 14, borderRadius: 16, border: '1px solid #e2e8f0' }}
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

			{/* Greeting section */}
			<div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
				<label style={{ fontWeight: 800, color: '#334155', marginBottom: 8, display: 'block' }}>ברכה בספר הברכות</label>
				<select value={greetingOption} onChange={e => setGreetingOption(e.target.value)} style={{ ...inputStyle, background: '#fff', width: '40%' }}>
					<option value="">בחר</option>
					<option value="now">הוספת פרטים עכשיו</option>
					<option value="not_needed">לא נצרך</option>
					<option value="reuse_previous">שימוש בברכה של הדינר הקודם</option>
				</select>
				{(greetingOption === 'now' || greetingOption === 'reuse_previous') && (
					<div style={{ marginTop: 10 }}>
						{greetingOption === 'reuse_previous' && (
							<div style={{ marginBottom: 12, background: '#f1f5f9', borderRadius: 12, padding: 12, fontSize: 14, color: '#0f172a' }}>
								{previousGreetingLoading && 'טוען ברכה קודמת...'}
								{!previousGreetingLoading && previousGreetingError && <span>{previousGreetingError}</span>}
								{!previousGreetingLoading && !previousGreetingError && previousGreetingMeta && (
									<span>
										הברכה נטענה מאירוע {previousGreetingMeta.eventName || ''}{previousGreetingMeta.eventDate ? ` (${new Date(previousGreetingMeta.eventDate).toLocaleDateString()})` : ''}.
									</span>
								)}
							</div>
						)}
						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
							<input placeholder="שם חותם הברכה" value={greetingSigner} onChange={e => setGreetingSigner(e.target.value)} style={compactInputStyle} />
							<input type="file" accept="image/png,image/jpeg,image/jpg,application/pdf,.png,.jpg,.jpeg,.pdf" onChange={e => setGreetingLogo(e.target.files?.[0] || null)} style={compactInputStyle} />
							<textarea placeholder="תוכן הברכה *" value={greetingContent} onChange={e => setGreetingContent(e.target.value)} style={{ ...compactInputStyle, gridColumn: '1 / span 2', minHeight: 60 }} />
						</div>
					</div>
				)}
			</div>

			{/* Extra Guests */}
			<div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
				<select value={extraCount === '' || extraCount === '0' || extraCount === 0 ? '' : extraCount} onChange={e => setExtraCount(e.target.value)} style={{ ...inputStyle, background: '#fff', width: 220 }}>
					<option value="" disabled>הבאת אורח/ת נוספ/ת *</option>
					{[0,1,2,3,4,5,6].map(n => (<option key={n} value={n}>{n}</option>))}
				</select>
				{extraGuests.map((g, idx) => (
					<div key={idx} style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 10 }}>						
						<input placeholder={`שם משפחה משתתף (${idx+1})`} value={g.lastName} onChange={e => updateExtra(idx, { lastName: e.target.value })} style={inputStyle} />
						<input placeholder={`שם פרטי משתתף (${idx+1})`} value={g.firstName} onChange={e => updateExtra(idx, { firstName: e.target.value })} style={inputStyle} />
						<input placeholder={`מספר זהות משתתף (${idx+1})`} value={g.idNumber} onChange={e => updateExtra(idx, { idNumber: e.target.value })} style={inputStyle} />
                        <select value={g.gender} onChange={e => updateExtra(idx, { gender: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
							<option value="">מגדר משתתף ({idx+1})</option>
							<option value="זכר">זכר</option>
							<option value="נקבה">נקבה</option>
						</select>
						<input placeholder={`ליד מי תרצו לשבת? (משתתף ${idx+1})`} value={g.seatNear} onChange={e => updateExtra(idx, { seatNear: e.target.value })} style={inputStyle} />
					</div>
				))}
			</div>

			<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
				<button onClick={handleSaveAndContinue} disabled={!isDetailsValid() || saving} className="tropical-button-primary" style={{ minWidth: 160 }}>{saving ? 'שומר...' : 'לשלב התשלום'}</button>
			</div>
		</div>
	);

	// Handle payment completion
	const handlePaymentComplete = async (transactionData) => {
		console.log('Payment completed:', transactionData);
		setPaymentCompleted(true);
		
		const token = localStorage.getItem('access_token');
		
		// Update guest with credit card info from Nedarim Plus
		if (guestId && transactionData) {
			try {
				const updateData = {};
				// 4 ספרות אחרונות של כרטיס אשראי
				if (transactionData.LastNum) {
					updateData.credit_card_number = `****${transactionData.LastNum}`;
				}
				// עדכון סכום תשלום אחרון
				if (transactionData.Amount) {
					updateData.last_payment_amount = transactionData.Amount;
				}
				
				if (Object.keys(updateData).length > 0) {
					await fetch(`http://localhost:8001/guests/${guestId}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${token}`
						},
						body: JSON.stringify({
							first_name: details.firstName,
							last_name: details.lastName,
							id_number: details.idNumber,
							gender: details.gender,
							...updateData
						})
					});
				}
			} catch (e) {
				console.error('Error updating guest with payment info:', e);
			}
		}
		
		// Save payment record in backend
		try {
			await fetch('http://localhost:8001/payments', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					event_id: eventId,
					guest_id: guestId,
					amount: donationAmount,
					payment_type: isRecurring ? 'HK' : 'Ragil',
					currency: currency === 'ILS' ? '1' : '2',
					tashloumim: isRecurring ? months : 1,
					client_name: `${details.firstName} ${details.lastName}`,
					zeout: details.idNumber,
					phone: details.phone,
					mail: details.email,
					address: `${details.street} ${details.apt} ${details.city}`,
					param1: `event_${eventId}`,
					param2: `guest_${guestId}`
				})
			});
		} catch (e) {
			console.error('Error saving payment:', e);
		}
		
		alert('התשלום בוצע בהצלחה! תודה רבה על תרומתכם.');
	};
	
	const handlePaymentError = (errorData) => {
		console.error('Payment error:', errorData);
		alert('התשלום נכשל: ' + (errorData.Message || 'שגיאה לא ידועה'));
	};
	
	const renderPaymentPanel = () => {
		if (!nedarimConfig) {
			return (
				<div ref={topRef} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
					טוען הגדרות תשלום...
				</div>
			);
		}
		
		if (paymentCompleted) {
			return (
				<div ref={topRef} style={{
					marginTop: 24,
					background: '#f0fdf4',
					border: '2px solid #86efac',
					borderRadius: 16,
					padding: 40,
					textAlign: 'center',
					boxShadow: '0 10px 28px rgba(0,0,0,0.08)'
				}}>
					<div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
					<h2 style={{ color: '#166534', marginBottom: 8 }}>התשלום בוצע בהצלחה!</h2>
					<p style={{ color: '#15803d', fontSize: 16 }}>
						תודה רבה על תרומתכם. 
						{isRecurring && ` הוראת הקבע שלכם בסך ₪${donationAmount.toLocaleString()} לחודש × ${months} חודשים נקלטה במערכת.`}
					</p>
				</div>
			);
		}
		
		// הכן את נתוני התשלום לנדרים פלוס
		const paymentData = {
			Mosad: nedarimConfig.mosad_id,
			ApiValid: nedarimConfig.api_valid,
			PaymentType: isRecurring ? 'HK' : 'Ragil',
			Currency: currency === 'ILS' ? '1' : '2',
			
			Zeout: details.idNumber || '',
			FirstName: details.firstName || '',
			LastName: details.lastName || '',
			Street: details.street || '',
			City: details.city || '',
			Phone: details.phone || '',
			Mail: details.email || '',
			
			Amount: String(donationAmount),
			Tashlumim: String(isRecurring ? months : 1),
			Day: isRecurring ? '1' : '',  // יום חיוב להוראת קבע
			
			Groupe: 'תורמים חדשים',
			Comment: `תרומה דרך טופס רישום - ${isRecurring ? 'הוראת קבע' : 'תשלום חד פעמי'}`,
			
			Param1: `event_${eventId}`,
			Param2: `guest_${guestId}`,
			ForceUpdateMatching: '0',
			
			CallBack: `${window.location.origin}/api/payments/webhook/nedarim-plus/regular`,
			CallBackMailError: ''
		};
		
		return (
		<div ref={topRef} style={{
			marginTop: 24,
			background: '#fff',
			border: '1px solid #e2e8f0',
			borderRadius: 16,
			padding: 20,
			boxShadow: '0 10px 28px rgba(0,0,0,0.08)'
		}}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
				<div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>
						סה"כ לתשלום: {isRecurring ? `₪${donationAmount.toLocaleString()} לחודש × ${months}` : `₪${donationAmount.toLocaleString()} חד פעמי`}
				</div>
					<button onClick={() => setStep(2)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>חזרה</button>
				</div>
				
				<div style={{ marginBottom: 20, padding: 16, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
					<p style={{ margin: 0, color: '#075985', fontWeight: 600 }}>
						🔒 תשלום מאובטח באמצעות נדרים פלוס
					</p>
					<p style={{ margin: '8px 0 0', color: '#0c4a6e', fontSize: 14 }}>
						המידע שלכם מאובטח ומוצפן לפי תקן PCI-DSS
					</p>
			</div>
				
				<NedarimPlusIframe
					paymentData={paymentData}
					onTransactionComplete={handlePaymentComplete}
					onTransactionError={handlePaymentError}
					language="he"
				/>
		</div>
	);
	};

	const inputStyle = { padding: 14, borderRadius: 16, border: '1px solid #e2e8f0' };
	const compactInputStyle = { ...inputStyle, padding: 10, borderRadius: 12, fontSize: 14 };

	const updateExtra = (idx, patch) => {
		setExtraGuests(prev => {
			const arr = [...prev];
			arr[idx] = { ...arr[idx], ...patch };
			return arr;
		});
	};

	return (
		<div ref={topRef} style={{ position: 'relative' }}>
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
			{step === 1 && (
				<>
					{renderDonationHeader()}
					{renderDonationTiles()}
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
						<div style={{ fontWeight: 800, color: '#334155' }}>
							סכום נבחר: {donationAmount > 0 ? `₪${donationAmount.toLocaleString()}` : '—'} {isRecurring ? `לחודש × ${months}` : '(חד פעמי)'}
						</div>
						<div style={{ display: 'flex', gap: 10 }}>
						<button
							onClick={() => setStep(2)}
							disabled={donationAmount <= 0}
							className="tropical-button-primary"
							style={{ minWidth: 160 }}
						>
							לשלב הבא
						</button>
						</div>
					</div>
				</>
			)}
			{step === 2 && renderDetailsPanel()}
			{step === 3 && renderPaymentPanel()}
		</div>
	);
}

async function addFieldRequest(eventId, name, required) {
	const token = localStorage.getItem('access_token');
	await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ field_name: name, field_type: 'text', form_key: 'new-donors', required })
	});
}

function saveGuestFieldValue(eventId, guestId, field_name, value) {
	const token = localStorage.getItem('access_token');
	return fetch(`http://localhost:8001/guests/events/${eventId}/guests/${guestId}/field-values`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
		body: JSON.stringify({ guest_id: guestId, field_name, value })
	});
} 