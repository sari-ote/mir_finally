import React from 'react';

// Trash icon component - iOS style clean and minimal
const TrashIcon = ({ size = 16, color = "var(--color-error, #ef4444)" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path
      d="M5.5 2.5V1.5C5.5 1.22386 5.72386 1 6 1H10C10.2761 1 10.5 1.22386 10.5 1.5V2.5H13C13.2761 2.5 13.5 2.72386 13.5 3C13.5 3.27614 13.2761 3.5 13 3.5H12.5V13.5C12.5 14.3284 11.8284 15 11 15H5C4.17157 15 3.5 14.3284 3.5 13.5V3.5H3C2.72386 3.5 2.5 3.27614 2.5 3C2.5 2.72386 2.72386 2.5 3 2.5H5.5ZM6.5 2.5H9.5V2H6.5V2.5ZM4.5 3.5V13.5C4.5 13.7761 4.72386 14 5 14H11C11.2761 14 11.5 13.7761 11.5 13.5V3.5H4.5ZM6.5 6C6.5 5.72386 6.72386 5.5 7 5.5C7.27614 5.5 7.5 5.72386 7.5 6V12C7.5 12.2761 7.27614 12.5 7 12.5C6.72386 12.5 6.5 12.2761 6.5 12V6ZM8.5 6C8.5 5.72386 8.72386 5.5 9 5.5C9.27614 5.5 9.5 5.72386 9.5 6V12C9.5 12.2761 9.27614 12.5 9 12.5C8.72386 12.5 8.5 12.2761 8.5 12V6Z"
      fill={color}
    />
  </svg>
);

export default TrashIcon;

