import React from 'react';

/**
 * Skeleton Loader Component Library
 * Provides smooth loading placeholders with shimmer animation
 */

// Add shimmer animation to document
if (typeof document !== 'undefined' && !document.querySelector('#skeleton-animation')) {
    const style = document.createElement('style');
    style.id = 'skeleton-animation';
    style.textContent = `
    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
  `;
    document.head.appendChild(style);
}

// Base skeleton styles - Theme aware
const baseStyle = {
    background: 'linear-gradient(90deg, var(--skeleton-bg, rgba(255, 255, 255, 0.05)) 25%, var(--skeleton-shine, rgba(255, 255, 255, 0.15)) 50%, var(--skeleton-bg, rgba(255, 255, 255, 0.05)) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite ease-in-out',
    borderRadius: '8px',
};

/**
 * Basic skeleton box - customizable rectangle
 */
export const SkeletonBox = ({
    width = '100%',
    height = '20px',
    borderRadius = '8px',
    style = {}
}) => (
    <div
        style={{
            ...baseStyle,
            width,
            height,
            borderRadius,
            ...style
        }}
    />
);

/**
 * Text line skeleton
 */
export const SkeletonText = ({
    width = '100%',
    lines = 1,
    style = {}
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
        {Array.from({ length: lines }).map((_, i) => (
            <div
                key={i}
                style={{
                    ...baseStyle,
                    width: i === lines - 1 && lines > 1 ? '70%' : width,
                    height: '14px',
                    borderRadius: '4px'
                }}
            />
        ))}
    </div>
);

/**
 * Circle skeleton (for avatars/icons)
 */
export const SkeletonCircle = ({
    size = 40,
    style = {}
}) => (
    <div
        style={{
            ...baseStyle,
            width: size,
            height: size,
            borderRadius: '50%',
            flexShrink: 0,
            ...style
        }}
    />
);

/**
 * Stat Card Skeleton - matches stat card layout
 */
export const SkeletonStatCard = ({ style = {} }) => (
    <div style={{
        backgroundColor: 'var(--card-bg, #ffffff)',
        borderRadius: '16px',
        padding: '22px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 4px 20px var(--shadow-color, rgba(0, 0, 0, 0.05))',
        ...style
    }}>
        <SkeletonBox width="56px" height="56px" borderRadius="12px" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SkeletonBox width="60px" height="28px" borderRadius="6px" />
            <SkeletonBox width="80px" height="14px" borderRadius="4px" />
        </div>
    </div>
);

/**
 * Table Row Skeleton
 */
export const SkeletonTableRow = ({ columns = 4, style = {} }) => (
    <tr style={{ borderBottom: '1px solid #f3f4f6', ...style }}>
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} style={{ padding: '16px' }}>
                <SkeletonBox
                    width={i === 0 ? '120px' : i === columns - 1 ? '80px' : '100px'}
                    height="16px"
                    borderRadius="4px"
                />
            </td>
        ))}
    </tr>
);

/**
 * Content Card Skeleton
 */
export const SkeletonContentCard = ({ style = {} }) => (
    <div style={{
        backgroundColor: 'var(--card-bg, #ffffff)',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 4px 20px var(--shadow-color, rgba(0, 0, 0, 0.05))',
        ...style
    }}>
        <SkeletonBox width="60%" height="20px" borderRadius="6px" style={{ marginBottom: '16px' }} />
        <SkeletonText lines={3} style={{ marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
            <SkeletonBox width="100px" height="36px" borderRadius="8px" />
            <SkeletonBox width="100px" height="36px" borderRadius="8px" />
        </div>
    </div>
);

/**
 * Dashboard Loading Skeleton - Full dashboard loading state
 */
export const SkeletonDashboard = ({ cardCount = 3, showTable = true }) => (
    <div style={{ padding: '24px 40px' }}>
        {/* Stat Cards Grid */}
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
        }}>
            {Array.from({ length: cardCount }).map((_, i) => (
                <SkeletonStatCard key={i} />
            ))}
        </div>

        {/* Navigation Skeleton */}
        <div style={{
            backgroundColor: 'var(--card-bg, #ffffff)',
            borderRadius: '16px',
            padding: '12px 16px',
            border: '1px solid var(--border-color, #e5e7eb)',
            marginBottom: '20px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto'
        }}>
            {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBox key={i} width="100px" height="40px" borderRadius="10px" />
            ))}
        </div>

        {/* Content Area */}
        <div style={{
            backgroundColor: 'var(--card-bg, #ffffff)',
            borderRadius: '16px',
            padding: '28px',
            border: '1px solid var(--border-color, #e5e7eb)',
            boxShadow: '0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.1))'
        }}>
            <SkeletonBox width="200px" height="24px" borderRadius="6px" style={{ marginBottom: '24px' }} />

            {showTable ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--bg-secondary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <th key={i} style={{ padding: '14px 16px', textAlign: 'left' }}>
                                        <SkeletonBox width="80px" height="12px" borderRadius="4px" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonTableRow key={i} columns={4} />
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonContentCard key={i} />
                    ))}
                </div>
            )}
        </div>
    </div>
);

// Default export with all components
const Skeleton = {
    Box: SkeletonBox,
    Text: SkeletonText,
    Circle: SkeletonCircle,
    StatCard: SkeletonStatCard,
    TableRow: SkeletonTableRow,
    ContentCard: SkeletonContentCard,
    Dashboard: SkeletonDashboard
};

export default Skeleton;
