import React from 'react';

/**
 * ChildSelector Component
 * Displays a list of children for the parent to select.
 * Now synchronized with ParentDashboard state for persistent highlighting.
 */
export const ChildSelector = ({ children = [], selectedChildId, onSelectChild }) => {
  
  const containerStyle = {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '20px',
    borderRadius: '20px',
    marginBottom: '24px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    color: '#ffffff'
  };

  const getButtonStyle = (isSelected) => ({
    flex: 1,
    minWidth: '220px',
    padding: '20px',
    border: isSelected ? '2px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: isSelected
      ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' // Vibrant Purple to Blue
      : 'rgba(255, 255, 255, 0.03)',
    color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
    boxShadow: isSelected 
      ? '0 0 25px rgba(139, 92, 246, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.2)' 
      : 'none',
    transform: isSelected ? 'translateY(-2px)' : 'none',
    position: 'relative',
    overflow: 'hidden'
  });

  const getBadgeStyle = (isSelected) => ({
    fontSize: '12px',
    fontWeight: '700',
    color: isSelected ? '#ffffff' : '#94a3b8',
    background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
    padding: '4px 12px',
    borderRadius: '20px',
    display: 'inline-block',
    marginTop: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  });

  if (children.length === 0) {
    return null; // ParentDashboard handles loading/empty states
  }

  return (
    <div style={containerStyle}>
      <h3 style={{ 
        color: '#ffffff', 
        marginBottom: '20px', 
        fontSize: '16px', 
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '20px' }}>👥</span> Select Your Child
      </h3>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {children.map((child) => {
          const isSelected = selectedChildId === child.id;
          return (
            <button
              key={child.id}
              onClick={() => onSelectChild(child)}
              style={getButtonStyle(isSelected)}
            >
              <div style={{ 
                fontWeight: '700', 
                fontSize: '18px', 
                marginBottom: '4px',
                textShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
              }}>
                {child.name}
              </div>
              <div style={getBadgeStyle(isSelected)}>
                Class {child.class}
              </div>
              
              {/* Selected indicator glow */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChildSelector;
