import React, { useState, useRef, useEffect } from 'react';
import { STYLE_CATEGORIES } from '../constants/styles';

/**
 * Multi-style picker component with chips and dropdown
 * 
 * @param {Object} props
 * @param {string[]} props.selectedStyles - Array of currently selected styles
 * @param {function} props.onStyleChange - Callback: receives style string to toggle
 * @param {boolean} props.compact - Use compact mode for floating action bar
 * @param {boolean} props.disabled - Disable interactions
 */
const StylePicker = ({ selectedStyles = [], onStyleChange, compact = false, disabled = false }) => {
    // Normalize: handle legacy single-string format for backward compatibility
    const selectedList = Array.isArray(selectedStyles)
        ? selectedStyles
        : (selectedStyles ? [selectedStyles] : ['Photorealistic']);

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const containerRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleStyle = (style) => {
        onStyleChange(style);
    };

    const handleRemoveStyle = (style, e) => {
        e.stopPropagation();
        onStyleChange({ action: 'remove', style });
    };

    return (
        <div
            className={`style-picker ${compact ? 'style-picker--compact' : ''}`}
            ref={containerRef}
        >
            {/* Selected styles as chips */}
            <div className="style-picker__selected">
                {selectedList.length === 0 && (
                    <span className="style-picker__empty-hint">No styles</span>
                )}
                {selectedList.map(style => (
                    <span key={style} className="style-chip">
                        {style}
                        {!disabled && (
                            <button
                                className="style-chip__remove"
                                onClick={(e) => handleRemoveStyle(style, e)}
                                title="Remove style"
                            >
                                ×
                            </button>
                        )}
                    </span>
                ))}
            </div>

            {/* Add button and dropdown - moved outside selected to avoid overflow clipping */}
            {!disabled && (
                <div className="style-picker__dropdown-container">
                    <button
                        className={`style-picker__add-btn ${selectedList.length === 0 ? 'style-picker__add-btn--empty' : ''}`}
                        onClick={() => setIsOpen(!isOpen)}
                        title="Add style"
                    >
                        {selectedList.length === 0 ? '+ Add Style' : '+ Add'}
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                        <div className="style-picker__dropdown" ref={dropdownRef}>
                            {Object.entries(STYLE_CATEGORIES).map(([category, styles]) => (
                                <div key={category} className="style-picker__category">
                                    <div className="style-picker__category-header">{category}</div>
                                    {styles.map(style => (
                                        <div
                                            key={style}
                                            className={`style-picker__item ${selectedList.includes(style) ? 'style-picker__item--selected' : ''}`}
                                            onClick={() => {
                                                handleToggleStyle(style);
                                                // Don't close on select to allow multiple selections
                                            }}
                                        >
                                            {style}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StylePicker;
