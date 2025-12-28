import React, { useState, useRef, useEffect } from 'react';
import NedarimPlusIframe from '../../NedarimPlusIframe.jsx';
import '../../../styles/theme-tropical.css';
import TrashIcon from '../../ui/TrashIcon';

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
		gender: ''
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
			const trimmedId = (details.idNumber || '').trim();
			if (!trimmedId) {
				setPreviousGreetingError('יש להזין תעודת זהות לפני שימוש בברכה קודמת');
				setGreetingOption('');
				return;
			}

			setPreviousGreetingLoading(true);
			setPreviousGreetingError(null);
			setPreviousGreetingMeta(null);

			try {
				const token = localStorage.getItem('access_token');
				if (!token) {
					throw new Error('לא נמצא אסימון אימות');
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
	}, [greetingOption, details.idNumber, eventId]);

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

	const presetTiles = [
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
		<div className="tropical-card" style={{
			display: 'flex', 
			flexDirection: 'row',
			alignItems: 'center', 
			justifyContent: 'flex-start',
			flexWrap: 'nowrap',
			gap: 8,
			background: 'rgba(255, 255, 255, 0.95)', 
			backdropFilter: 'blur(20px)',
			WebkitBackdropFilter: 'blur(20px)',
			border: '1px solid rgba(148, 163, 184, 0.3)', 
			borderRadius: '18px', 
			padding: '12px 16px',
			boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
			marginBottom: '20px',
			direction: 'rtl',
			width: '100%',
			boxSizing: 'border-box',
			overflowX: 'auto',
			overflowY: 'hidden'
		}}>
			<input
				type="number"
				min={0}
				value={donationAmount || ''}
				onChange={e => setDonationAmount(Number(e.target.value) || 0)}
				placeholder="הזנת סכום חופשי"
				className="tropical-input"
				style={{ 
					width: '180px', 
					minWidth: '180px',
					maxWidth: '180px',
					padding: '10px 14px', 
					borderRadius: '999px', 
					border: '1px solid rgba(148, 163, 184, 0.6)', 
					background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
					fontWeight: 600, 
					textAlign: 'right', 
					fontSize: '0.9rem',
					fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
					boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
					direction: 'rtl',
					flexShrink: 0,
					boxSizing: 'border-box',
					margin: 0
				}}
			/>
			<div style={{ 
				display: 'flex', 
				alignItems: 'center', 
				gap: '3px',
				background: 'rgba(242, 242, 247, 0.8)',
				backdropFilter: 'blur(20px)',
				WebkitBackdropFilter: 'blur(20px)',
				borderRadius: '999px',
				padding: '3px',
				border: 'none',
				boxShadow: 'none',
				flexShrink: 0
			}}>
				<button
					type="button"
					onClick={() => setCurrency('ILS')}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: '50px',
						height: '38px',
						borderRadius: '999px',
						border: 'none',
						background: currency === 'ILS' 
							? '#ffffff' 
							: 'transparent',
						color: currency === 'ILS' 
							? '#09b0cb' 
							: 'rgba(142, 142, 147, 0.8)',
						fontWeight: 500,
						fontSize: '1.15rem',
						cursor: 'pointer',
						transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
						boxShadow: 'none',
						fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
						WebkitTapHighlightColor: 'transparent',
						outline: 'none'
					}}
					onMouseDown={(e) => {
						e.currentTarget.style.transform = 'scale(0.96)';
					}}
					onMouseUp={(e) => {
						e.currentTarget.style.transform = 'scale(1)';
					}}
					onMouseEnter={(e) => {
						if (currency !== 'ILS') {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
						}
					}}
					onMouseLeave={(e) => {
						if (currency !== 'ILS') {
							e.currentTarget.style.background = 'transparent';
						}
						e.currentTarget.style.transform = 'scale(1)';
					}}
				>
					₪
				</button>
				<button
					type="button"
					onClick={() => setCurrency('USD')}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: '50px',
						height: '38px',
						borderRadius: '999px',
						border: 'none',
						background: currency === 'USD' 
							? '#ffffff' 
							: 'transparent',
						color: currency === 'USD' 
							? '#09b0cb' 
							: 'rgba(142, 142, 147, 0.8)',
						fontWeight: 500,
						fontSize: '1.15rem',
						cursor: 'pointer',
						transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
						boxShadow: 'none',
						fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
						WebkitTapHighlightColor: 'transparent',
						outline: 'none'
					}}
					onMouseDown={(e) => {
						e.currentTarget.style.transform = 'scale(0.96)';
					}}
					onMouseUp={(e) => {
						e.currentTarget.style.transform = 'scale(1)';
					}}
					onMouseEnter={(e) => {
						if (currency !== 'USD') {
							e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
						}
					}}
					onMouseLeave={(e) => {
						if (currency !== 'USD') {
							e.currentTarget.style.background = 'transparent';
						}
						e.currentTarget.style.transform = 'scale(1)';
					}}
				>
					$
				</button>
			</div>
			<label style={{ 
				display: 'inline-flex', 
				alignItems: 'center', 
				gap: 6, 
				cursor: 'pointer', 
				fontSize: '0.9rem', 
				color: 'var(--color-text-main, #10131A)', 
				fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
				whiteSpace: 'nowrap',
				flexShrink: 0,
				margin: 0
			}}>
				<input 
					type="checkbox" 
					checked={isRecurring} 
					onChange={e => setIsRecurring(e.target.checked)}
					style={{ 
						width: '16px', 
						height: '16px', 
						cursor: 'pointer',
						accentColor: 'var(--color-primary, #09b0cb)',
						flexShrink: 0,
						margin: 0
					}} 
				/>
				<span>הוראת קבע למשך</span>
			</label>
			<select disabled={!isRecurring} value={months} onChange={e => setMonths(Number(e.target.value))} className="tropical-input"
				style={{ 
					padding: '10px 12px', 
					borderRadius: '999px', 
					border: '1px solid rgba(148, 163, 184, 0.6)', 
					background: isRecurring ? 'linear-gradient(to bottom, #ffffff, #f8fafc)' : 'rgba(148, 163, 184, 0.1)',
					width: '47px',
					minWidth: '47px',
					maxWidth: '47px',
					fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
					fontSize: '0.9rem',
					cursor: isRecurring ? 'pointer' : 'not-allowed',
					opacity: isRecurring ? 1 : 0.6,
					flexShrink: 0,
					boxSizing: 'border-box',
					margin: 0
				}}>
				{[12, 18, 24, 36].map(m => <option key={m} value={m}>{m}</option>)}
			</select>
			<span style={{ 
				fontSize: '0.9rem', 
				color: 'var(--color-text-main, #10131A)', 
				fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
				whiteSpace: 'nowrap',
				flexShrink: 0,
				margin: 0
			}}>
				חודשים
			</span>
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
					<button 
						key={i} 
						onClick={() => setDonationAmount(t.amount)}
						className="tropical-card"
						style={{
							textAlign: 'center', 
							background: selected 
								? 'rgba(8, 200, 230, 0.15)' 
								: 'rgba(255, 255, 255, 0.95)', 
							backdropFilter: 'blur(20px)',
							WebkitBackdropFilter: 'blur(20px)',
							borderRadius: '18px',
							border: selected 
								? '2px solid rgba(8, 200, 230, 0.95)' 
								: '1px solid rgba(148, 163, 184, 0.3)',
							padding: 20, 
							minHeight: 140, 
							boxShadow: selected 
								? '0 8px 24px rgba(8, 200, 230, 0.25), 0 4px 12px rgba(8, 200, 230, 0.15)' 
								: '0 4px 12px rgba(15, 23, 42, 0.08)',
							cursor: 'pointer', 
							transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
							fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
						}}
						onMouseEnter={(e) => {
							if (!selected) {
								e.currentTarget.style.transform = 'translateY(-2px)';
								e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.12)';
								e.currentTarget.style.borderColor = 'rgba(8, 200, 230, 0.5)';
							}
						}}
						onMouseLeave={(e) => {
							if (!selected) {
								e.currentTarget.style.transform = 'translateY(0)';
								e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
								e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
							}
						}}
					>
						<div style={{ 
							color: selected ? 'var(--color-primary, #09b0cb)' : 'var(--color-text-secondary, #6B7280)', 
							marginBottom: 10, 
							fontWeight: 600,
							fontSize: '0.95rem'
						}}>
							{t.title}
						</div>
						<div style={{ 
							fontSize: 36, 
							fontWeight: 700,
							color: selected ? 'var(--color-primary, #09b0cb)' : 'var(--color-text-main, #10131A)',
							marginBottom: 4
						}}>
							₪{t.amount.toLocaleString()}
						</div>
						{t.per && (
							<div style={{ 
								color: selected ? 'var(--color-primary, #09b0cb)' : 'var(--color-text-secondary, #6B7280)', 
								marginTop: 8,
								fontSize: '0.85rem',
								fontWeight: 500
							}}>
								{t.per}
							</div>
						)}
					</button>
				);
			})}
		</div>
	);

	const isEmailValid = (val) => /^(?!.*\.{2})[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(val.trim());
	const isDetailsValid = () => {
		const { firstName, lastName, phone, email, idNumber, city, gender } = details;
		const hasContact = phone.trim().length >= 9 || email.trim().length >= 5;
		const customOk = customFields.every(f => {
			const isReq = !!(f?.required || String(f?.name || '').trim().endsWith(' *'));
			if (!isReq) return true;
			return String(customValues[f.name] || '').trim() !== '';
		});
		return (
			firstName.trim() &&
			lastName.trim() &&
			hasContact &&
			idNumber.trim().length >= 5 &&
			city.trim() &&
			gender.trim() &&
			(!email.trim() || isEmailValid(email)) &&
			customOk
		);
	};

	const handleSaveAndContinue = async () => {
		if (!isDetailsValid() || saving) {
			setShowErrors(true);
			if (details.email.trim() && !isEmailValid(details.email)) {
				alert('האימייל שהוזן אינו תקין');
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
				address: [details.street, details.apt, details.city].filter(Boolean).join(' '),
				phone: details.phone,
				email: details.email,
				referral_source: null,
				gender: details.gender,
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

			// Create spouse automatically based on participation choices
			if (participationWomen === 'השתתפות יחידה נשים') {
				// Create husband with same last name
				const spousePayload = {
					event_id: Number(eventId),
					first_name: 'הרב',
					last_name: details.lastName, // Same last name as the woman
					id_number: generateTempId(),
					address: details.address || '',
					phone: details.phone || '',
					email: details.email || '',
					referral_source: 'new_donors_form_spouse',
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
					if (details.occupation) await saveGuestFieldValue(eventId, spouseGuest.id, 'עיסוק', details.occupation);
					if (details.city) await saveGuestFieldValue(eventId, spouseGuest.id, 'עיר', details.city);
				}
			} else if (participationMen === 'השתתפות יחיד') {
				// Create wife with same last name
				const spousePayload = {
					event_id: Number(eventId),
					first_name: 'גברת',
					last_name: details.lastName, // Same last name as the man
					id_number: generateTempId(),
					address: details.address || '',
					phone: details.phone || '',
					email: details.email || '',
					referral_source: 'new_donors_form_spouse',
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
					if (details.occupation) await saveGuestFieldValue(eventId, spouseGuest.id, 'עיסוק', details.occupation);
					if (details.city) await saveGuestFieldValue(eventId, spouseGuest.id, 'עיר', details.city);
				}
			}

			setStep(3);
		} catch (e) {
			console.error('Save donor failed:', e);
			alert('שגיאה בשמירת פרטי התורם: ' + e.message);
		} finally {
			setSaving(false);
		}
	};

	const renderDetailsPanel = () => (
		<div ref={topRef} className="tropical-card" style={{
			marginTop: 24,
			background: 'rgba(255, 255, 255, 0.95)',
			backdropFilter: 'blur(20px)',
			WebkitBackdropFilter: 'blur(20px)',
			border: '1px solid rgba(148, 163, 184, 0.3)',
			borderRadius: '20px',
			padding: 24,
			boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)'
		}}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
				<div style={{ 
					fontWeight: 700, 
					fontSize: '1.25rem', 
					color: 'var(--color-text-main, #10131A)',
					fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
				}}>
					פרטי נותן תרומה • {isRecurring ? `₪${donationAmount.toLocaleString()} לחודש × ${months}` : `₪${donationAmount.toLocaleString()} חד פעמי`}
				</div>
				<div style={{ display: 'flex', gap: 10 }}>
					<button 
						onClick={() => setStep(1)} 
						className="tropical-button-secondary"
						style={{ 
							padding: '12px 20px', 
							borderRadius: '999px', 
							cursor: 'pointer', 
							fontWeight: 600,
							fontSize: '0.95rem',
							fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
						}}
					>
						חזרה
					</button>
				</div>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
				<input placeholder="שם פרטי" value={details.firstName} onChange={e => setDetails({ ...details, firstName: e.target.value })} className="tropical-input" style={inputStyle} />
				<input placeholder="שם משפחה" value={details.lastName} onChange={e => setDetails({ ...details, lastName: e.target.value })} className="tropical-input" style={inputStyle} />
				<input placeholder="מספר זהות" value={details.idNumber} onChange={e => setDetails({ ...details, idNumber: e.target.value })} className="tropical-input" style={inputStyle} />
				<input placeholder="טלפון" value={details.phone} onChange={e => setDetails({ ...details, phone: e.target.value })} className="tropical-input" style={inputStyle} />
				<input placeholder="אימייל" value={details.email} onChange={e => setDetails({ ...details, email: e.target.value })} className="tropical-input" style={inputStyle} />
				<select value={details.gender} onChange={e => setDetails({ ...details, gender: e.target.value })} className="tropical-input" style={{ ...inputStyle }}>
					<option value="">בחר מגדר</option>
					<option value="זכר">זכר</option>
					<option value="נקבה">נקבה</option>
				</select>

				{/* עדכון השתתפות נשים דינר פ"נ */}
				<select value={participationWomen} onChange={e => setParticipationWomen(e.target.value)} className="tropical-input" style={{ ...inputStyle }}>
					<option value="">עדכון השתתפות נשים דינר פ"נ *</option>
					<option value="השתתפות יחידה נשים">השתתפות יחידה נשים</option>
					<option value="לא משתתפת אחר">לא משתתפת אחר</option>
					<option value='לא משתתפת חו"ל'>לא משתתפת חו"ל</option>
					<option value="לא משתתפת עם משפחתית">לא משתתפת עם משפחתית</option>
					<option value="ספק">ספק</option>
				</select>

				{/* עדכון השתתפות גברים דינר פ"נ */}
				<select value={participationMen} onChange={e => setParticipationMen(e.target.value)} className="tropical-input" style={{ ...inputStyle }}>
					<option value="">עדכון השתתפות גברים דינר פ"נ *</option>
					<option value="השתתפות יחיד">השתתפות יחיד</option>
					<option value="לא משתתף אחר">לא משתתף אחר</option>
					<option value='לא משתתף חו"ל'>לא משתתף חו"ל</option>
					<option value="לא משתתף עם משפחתית">לא משתתף עם משפחתית</option>
					<option value="ספק">ספק</option>
				</select>

				<input placeholder="עיר" value={details.city} onChange={e => setDetails({ ...details, city: e.target.value })} className="tropical-input" style={inputStyle} />
				<input placeholder="רחוב" value={details.street} onChange={e => setDetails({ ...details, street: e.target.value })} className="tropical-input" style={inputStyle} />
				<input placeholder="דירה" value={details.apt} onChange={e => setDetails({ ...details, apt: e.target.value })} className="tropical-input" style={inputStyle} />
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
								style={{ padding: 14, borderRadius: 999, border: (showErrors && isReq && !hasVal) ? '1px solid #ef4444' : '1px solid #e2e8f0' }}
							/>
							<button
								type="button"
								onClick={() => deleteField(f.id)}
								title="מחק שדה"
								style={{
									padding: '6px',
									borderRadius: 8,
									border: 'none',
									background: 'transparent',
									cursor: canManageFields ? 'pointer' : 'not-allowed',
									opacity: canManageFields ? 1 : 0.5,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: 28,
									height: 28,
									transition: 'all 0.2s ease'
								}}
								onMouseEnter={(e) => {
									if (canManageFields) {
										e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
									}
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "transparent";
								}}
							>
								<TrashIcon size={14} />
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
						style={{ padding: 14, borderRadius: 999, border: '1px solid #e2e8f0' }}
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
						הוסף
					</button>
				</div>
			</div>

			{/* Greeting section */}
			<div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
				<label style={{ fontWeight: 800, color: '#334155', marginBottom: 8, display: 'block' }}>ברכה בספר הברכות</label>
						<select value={greetingOption} onChange={e => setGreetingOption(e.target.value)} className="tropical-input" style={{ ...inputStyle, width: '40%' }}>
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
							<input placeholder="שם חותם הברכה" value={greetingSigner} onChange={e => setGreetingSigner(e.target.value)} className="tropical-input" style={compactInputStyle} />
							<input type="file" accept="image/*" onChange={e => setGreetingLogo(e.target.files?.[0] || null)} className="tropical-input" style={compactInputStyle} />
							<textarea placeholder="תוכן הברכה *" value={greetingContent} onChange={e => setGreetingContent(e.target.value)} className="tropical-input" style={{ ...compactInputStyle, gridColumn: '1 / span 2', minHeight: 60, borderRadius: '999px' }} />
						</div>
					</div>
				)}
			</div>

			{/* Extra Guests */}
			<div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
				<select value={extraCount === '' || extraCount === '0' || extraCount === 0 ? '' : extraCount} onChange={e => setExtraCount(e.target.value)} className="tropical-input" style={{ ...inputStyle, width: 220 }}>
					<option value="" disabled>הבאת אורח/ת נוספ/ת *</option>
					{[0,1,2,3,4,5,6].map(n => (<option key={n} value={n}>{n}</option>))}
				</select>
				{extraGuests.map((g, idx) => (
					<div key={idx} className="tropical-card" style={{ 
						marginTop: 12, 
						display: 'grid', 
						gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', 
						gap: 12, 
						background: 'rgba(255, 255, 255, 0.95)', 
						backdropFilter: 'blur(10px)',
						WebkitBackdropFilter: 'blur(10px)',
						padding: 16, 
						borderRadius: '16px',
						border: '1px solid rgba(148, 163, 184, 0.2)',
						boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)'
					}}>						
						<input placeholder={`שם משפחה משתתף (${idx+1})`} value={g.lastName} onChange={e => updateExtra(idx, { lastName: e.target.value })} className="tropical-input" style={inputStyle} />
						<input placeholder={`שם פרטי משתתף (${idx+1})`} value={g.firstName} onChange={e => updateExtra(idx, { firstName: e.target.value })} className="tropical-input" style={inputStyle} />
						<input placeholder={`מספר זהות משתתף (${idx+1})`} value={g.idNumber} onChange={e => updateExtra(idx, { idNumber: e.target.value })} className="tropical-input" style={inputStyle} />
                        <select value={g.gender} onChange={e => updateExtra(idx, { gender: e.target.value })} className="tropical-input" style={{ ...inputStyle }}>
							<option value="">מגדר משתתף ({idx+1})</option>
							<option value="זכר">זכר</option>
							<option value="נקבה">נקבה</option>
						</select>
						<input placeholder={`ליד מי תרצו לשבת? (משתתף ${idx+1})`} value={g.seatNear} onChange={e => updateExtra(idx, { seatNear: e.target.value })} className="tropical-input" style={inputStyle} />
					</div>
				))}
			</div>

			<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
				<button 
					onClick={handleSaveAndContinue} 
					disabled={!isDetailsValid() || saving} 
					className="tropical-button-primary" 
					style={{ 
						minWidth: 180,
						padding: '14px 28px',
						borderRadius: '999px',
						fontWeight: 600,
						fontSize: '1rem',
						fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
					}}
				>
					{saving ? 'שומר...' : 'לשלב התשלום'}
				</button>
			</div>
		</div>
	);

	// Handle payment completion
	const handlePaymentComplete = async (transactionData) => {
		console.log('Payment completed:', transactionData);
		setPaymentCompleted(true);
		
		// Save payment record in backend
		try {
			const token = localStorage.getItem('access_token');
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
		<div ref={topRef} className="tropical-card" style={{
			marginTop: 24,
			background: 'rgba(255, 255, 255, 0.95)',
			backdropFilter: 'blur(20px)',
			WebkitBackdropFilter: 'blur(20px)',
			border: '1px solid rgba(148, 163, 184, 0.3)',
			borderRadius: '20px',
			padding: 24,
			boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)'
		}}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
				<div style={{ 
					fontWeight: 700, 
					fontSize: '1.25rem', 
					color: 'var(--color-text-main, #10131A)',
					fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
				}}>
						סה"כ לתשלום: {isRecurring ? `₪${donationAmount.toLocaleString()} לחודש × ${months}` : `₪${donationAmount.toLocaleString()} חד פעמי`}
				</div>
					<button 
						onClick={() => setStep(2)} 
						className="tropical-button-secondary"
						style={{ 
							padding: '12px 20px', 
							borderRadius: '999px', 
							cursor: 'pointer', 
							fontWeight: 600,
							fontSize: '0.95rem',
							fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
						}}
					>
						חזרה
					</button>
				</div>
				
				<div className="tropical-card" style={{ 
					marginBottom: 20, 
					padding: 18, 
					background: 'rgba(8, 200, 230, 0.08)', 
					borderRadius: '16px', 
					border: '1px solid rgba(8, 200, 230, 0.2)',
					backdropFilter: 'blur(10px)',
					WebkitBackdropFilter: 'blur(10px)'
				}}>
					<p style={{ 
						margin: 0, 
						color: 'var(--color-primary, #09b0cb)', 
						fontWeight: 600,
						fontSize: '1rem',
						fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
					}}>
						🔒 תשלום מאובטח באמצעות נדרים פלוס
					</p>
					<p style={{ 
						margin: '8px 0 0', 
						color: 'var(--color-text-secondary, #6B7280)', 
						fontSize: '0.9rem',
						fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
					}}>
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

	const inputStyle = { 
		padding: '14px 18px', 
		borderRadius: '999px', 
		border: '1px solid rgba(148, 163, 184, 0.6)', 
		background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
		fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
		fontSize: '0.95rem',
		boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
		transition: 'all 0.2s ease'
	};
	const compactInputStyle = { 
		...inputStyle, 
		padding: '10px 14px', 
		borderRadius: '999px', 
		fontSize: '0.9rem' 
	};

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
					<div style={{ 
						display: 'flex', 
						justifyContent: 'space-between', 
						alignItems: 'center', 
						marginTop: 24,
						padding: '18px 20px',
						background: 'rgba(255, 255, 255, 0.95)',
						backdropFilter: 'blur(20px)',
						WebkitBackdropFilter: 'blur(20px)',
						border: '1px solid rgba(148, 163, 184, 0.3)',
						borderRadius: '18px',
						boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)'
					}}>
						<div style={{ 
							fontWeight: 700, 
							fontSize: '1.1rem',
							color: 'var(--color-text-main, #10131A)',
							fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
						}}>
							סכום נבחר: {donationAmount > 0 ? `₪${donationAmount.toLocaleString()}` : '—'} {isRecurring ? `לחודש × ${months}` : '(חד פעמי)'}
						</div>
						<div style={{ display: 'flex', gap: 10 }}>
							<button
								onClick={() => setStep(2)}
								disabled={donationAmount <= 0}
								className="tropical-button-primary"
								style={{ 
									minWidth: 180,
									padding: '14px 28px',
									borderRadius: '999px',
									fontWeight: 600,
									fontSize: '1rem',
									fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
								}}
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
	return fetch(`http://localhost:8001/events/${eventId}/guests/${guestId}/field-values`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
		body: JSON.stringify({ guest_id: guestId, field_name, value })
	});
} 