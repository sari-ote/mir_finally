export const HALL_ELEMENT_TYPES = {
  stage_main: { label: 'במה ראשית', color: '#f59e0b', width: 1400, height: 240, priority: 0, family: 'stage' },
  stage: { label: 'במה', color: '#fbbf24', width: 1200, height: 200, priority: 1, family: 'stage' },
  stage_small: { label: 'במה קטנה', color: '#fde047', width: 820, height: 170, priority: 2, family: 'stage' },
  orchestra_stage: { label: 'במת תזמורת', color: '#f97316', width: 1000, height: 210, priority: 3, family: 'stage' },
  podium: { label: 'דוכן נואמים', color: '#ec4899', width: 320, height: 180, priority: 4, family: 'stage' },
  sound_booth: { label: 'עמדת סאונד', color: '#3b82f6', width: 320, height: 160, priority: 5 },
  screens: { label: 'מסכים', color: '#22d3ee', width: 640, height: 140, priority: 6 },
  amplification: { label: 'הגברה', color: '#0ea5e9', width: 280, height: 140, priority: 6 },
  production_area: { label: 'אזור הפקה', color: '#8b5cf6', width: 520, height: 240, priority: 7 },
  donation_booth: { label: 'עמדת התרמה', color: '#10b981', width: 320, height: 140, priority: 7 },
  entrance: { label: 'דלת כניסה', color: '#34d399', width: 60, height: 140, priority: 8 },
  exit: { label: 'יציאה', color: '#06b6d4', width: 60, height: 140, priority: 8 },
  kitchen: { label: 'מטבח', color: '#a3e635', width: 480, height: 260, priority: 9 },
  restroom: { label: 'שירותים', color: '#94a3b8', width: 360, height: 220, priority: 9 },
};

export const HALL_ELEMENT_ORDER = [
  'stage_main',
  'stage',
  'stage_small',
  'orchestra_stage',
  'podium',
  'sound_booth',
  'screens',
  'amplification',
  'production_area',
  'donation_booth',
  'entrance',
  'exit',
  'kitchen',
  'restroom',
];

export const getHallElementConfig = (type) => {
  return HALL_ELEMENT_TYPES[type] || { label: 'אלמנט', color: '#94a3b8', width: 300, height: 120, priority: 10 };
};

