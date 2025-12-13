import React from 'react';

const SettingsSheet = ({ open, title = 'Settings', onClose, children }) => {
  if (!open) return null;

  return (
    <div className="dm-sheet" onClick={onClose}>
      <div className="dm-sheet__panel" onClick={(e) => e.stopPropagation()}>
        <div className="dm-sheet__handle" />
        <div className="dm-sheet__header">
          <div className="dm-sheet__title">{title}</div>
          <button className="secondary-button" onClick={onClose} style={{ width: 'auto' }}>
            ✕
          </button>
        </div>
        <div className="dm-sheet__content">
          {children}
        </div>
      </div>

    </div>
  );
};

export default SettingsSheet;




