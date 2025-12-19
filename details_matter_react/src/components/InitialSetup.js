import React, { useState } from 'react';
import { STYLES } from '../constants/styles';

const InitialSetup = ({
  initialPrompt,
  setInitialPrompt,
  onStartEvolution,
  isApiKeySet,
  isLoading,
  style,
  onStyleChange
}) => {
  const [showHelp, setShowHelp] = useState(true);

  return (
    <div className="controls-section">
      {showHelp && (
        <div style={{
          background: 'rgba(139, 90, 43, 0.08)',
          border: '1px solid rgba(139, 90, 43, 0.25)',
          borderRadius: '8px',
          padding: '16px 18px',
          marginBottom: '24px'
        }}>
          <div
            onClick={() => setShowHelp(false)}
            style={{
              color: '#8b5a2b',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: '0.95rem'
            }}
          >
            <span>Getting Started</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>× dismiss</span>
          </div>
          <div style={{ color: '#5c4033', marginTop: '14px', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>1.</strong> Add your Gemini API key in Settings</div>
              <div><strong>2.</strong> Describe your initial scene below</div>
              <div><strong>3.</strong> Begin the evolution</div>
            </div>
            <div style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'rgba(139, 90, 43, 0.06)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: '#6b4423',
              fontStyle: 'italic'
            }}>
              Your API key stays in your browser — open source, verify the code.
            </div>
          </div>
        </div>
      )}

      <h2 style={{
        color: '#3d2914',
        fontWeight: 500,
        fontSize: '1.4rem',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(139, 90, 43, 0.2)',
        paddingBottom: '12px'
      }}>
        Begin Your Detail Journey
      </h2>

      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '10px',
          fontWeight: 600,
          color: '#5c4033',
          fontSize: '0.95rem'
        }}>
          Initial Vision
        </label>
        <textarea
          placeholder="Describe the scene you wish to explore... A forgotten library with ancient tomes, a moonlit garden with hidden paths..."
          value={initialPrompt}
          onChange={(e) => setInitialPrompt(e.target.value)}
          rows={4}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(139, 90, 43, 0.3)',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '1rem',
            lineHeight: 1.6,
            color: '#3d2914',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical'
          }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '10px',
          fontWeight: 600,
          color: '#5c4033',
          fontSize: '0.95rem'
        }}>
          Visual Style
        </label>
        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value)}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(139, 90, 43, 0.3)',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '1rem',
            color: '#3d2914',
            width: '100%',
            boxSizing: 'border-box',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%233d2914%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px top 50%',
            backgroundSize: '12px auto'
          }}
        >
          {STYLES.map(styleOption => (
            <option key={styleOption} value={styleOption}>
              {styleOption}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onStartEvolution}
        disabled={!isApiKeySet || isLoading || !initialPrompt.trim()}
        className="primary-button"
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '14px 20px',
          fontSize: '1rem',
          fontWeight: 600
        }}
      >
        {isLoading ? (
          <span className="loading" style={{ color: 'white' }}>
            <span className="spinner" style={{ borderColor: 'white', borderTopColor: 'transparent' }}></span>
            Conjuring first image...
          </span>
        ) : (
          'Begin Evolution'
        )}
      </button>

      {!isApiKeySet && (
        <div className="warning" style={{ marginTop: '16px', fontSize: '0.9rem' }}>
          Please set your Gemini API key in Settings to begin.
        </div>
      )}

      {isApiKeySet && initialPrompt.trim() === '' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(139, 90, 43, 0.06)',
          borderRadius: '6px',
          color: '#6b4423',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          Enter your initial vision to begin the journey.
        </div>
      )}
    </div>
  );
};

export default InitialSetup;
