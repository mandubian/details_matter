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

      <style>{`
        .dm-sheet {
          position: fixed;
          inset: 0;
          z-index: 1200;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 10px;
        }
        .dm-sheet__panel {
          width: min(720px, 100%);
          max-height: 92vh;
          background: rgba(14, 21, 38, 0.92);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 22px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.7);
          overflow: hidden;
        }
        .dm-sheet__handle {
          width: 46px;
          height: 5px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
          margin: 10px auto 4px auto;
        }
        .dm-sheet__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .dm-sheet__title {
          font-weight: 850;
          color: var(--text-primary);
        }
        .dm-sheet__content {
          padding: 12px 12px 18px 12px;
          overflow: auto;
          max-height: calc(92vh - 70px);
        }
      `}</style>
    </div>
  );
};

export default SettingsSheet;




