import React from 'react';
import MobileTabDropdown from '../../components/MobileTabDropdown';

export const StudentTabNav = ({
    tabs,
    activeTab,
    setActiveTab,
    themedStyles,
    styles
}) => {
    return (
        <>
            {/* Desktop Tabs */}
            <div style={{ ...styles.tabNavigation, ...themedStyles.tabNavigation }} className="hide-on-mobile">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === tab.id ? themedStyles.buttonPrimary : themedStyles.buttonInactive),
                        }}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Mobile Tab Dropdown */}
            <div className="show-on-mobile" style={{ marginBottom: '20px' }}>
                <MobileTabDropdown
                    tabs={tabs}
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                    themedStyles={themedStyles}
                />
            </div>
        </>
    );
};
