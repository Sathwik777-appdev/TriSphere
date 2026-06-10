import React from 'react';

export const TeacherClassSelector = ({
    availableClasses,
    selectedClass,
    setSelectedClass,
    styles
}) => {
    return (
        <div style={{
            display: 'flex',
            gap: '12px',
            padding: '0 20px',
            overflowX: 'auto',
            paddingBottom: '10px',
            scrollbarWidth: 'none',
            marginBottom: '20px'
        }}>
            {availableClasses.map(cls => (
                <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    style={{
                        ...styles.classButton,
                        ...(selectedClass === cls ? styles.classButtonActive : {})
                    }}
                >
                    Class {cls}
                </button>
            ))}
        </div>
    );
};
