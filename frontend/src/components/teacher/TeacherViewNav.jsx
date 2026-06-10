import React from 'react';

export const TeacherViewNav = ({
    views,
    activeView,
    setActiveView,
    themedStyles,
    styles
}) => {
    return (
        <div style={{ ...styles.viewNavigation, ...themedStyles.tabNavigation }} className="hide-on-mobile">
            {views.map(view => (
                <button
                    key={view.id}
                    onClick={() => setActiveView(view.id)}
                    style={{
                        ...styles.viewButton,
                        ...(activeView === view.id ? themedStyles.buttonPrimary : themedStyles.buttonInactive),
                        color: activeView === view.id ? '#ffffff' : themedStyles.text.primary
                    }}
                >
                    <span style={styles.viewIcon}>{view.icon}</span>
                    <span style={styles.viewLabel}>{view.label.replace(/^\S+\s/, '')}</span>
                </button>
            ))}
        </div>
    );
};
