import React, { useState } from 'react';
import TableHeadsTab from './TableHeadsTab';
import GuestsContent from './GuestsContent';
import '../../styles/theme-tropical.css';

export default function GuestList({ eventId }) {
  console.log('GuestList: eventId from props:', eventId);
  const [activeTab, setActiveTab] = useState('guests');

  return (
    <div>
      <div className="tropical-filters" style={{ marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('guests')}
          className={`tropical-pill-filter ${activeTab === 'guests' ? 'tropical-pill-filter--active' : ''}`}
          style={{ flex: 1 }}
        >
          רשימת מוזמנים
        </button>
        <button
          onClick={() => setActiveTab('tableHeads')}
          className={`tropical-pill-filter ${activeTab === 'tableHeads' ? 'tropical-pill-filter--active' : ''}`}
          style={{ flex: 1 }}
        >
          ראשי שולחן
        </button>
      </div>

      {activeTab === 'guests' ? <GuestsContent /> : <TableHeadsTab />}
    </div>
  );
}