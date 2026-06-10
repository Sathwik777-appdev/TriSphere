import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * AdComponent - A reusable, highly optimized component for Google AdSense ad units.
 * Now implements lazy loading and lifecycle stability to use minimal background resources.
 */
const AdComponent = ({ slot, format = 'auto', responsive = 'true', style = {} }) => {
    const { isDark } = useTheme();
    const adRef = useRef(null);
    const initialized = useRef(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Observers for lazy loading to minimize background resource usage
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 } // Load when 10% visible
        );

        if (adRef.current) {
            observer.observe(adRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        // Only initialize ad if visible and not already pushed
        if (isVisible && !initialized.current) {
            // Use a small timeout to ensure React has committed the 'display: block' 
            // and the browser has calculated the layout dimensions.
            const timer = setTimeout(() => {
                try {
                    if (typeof window !== 'undefined' && window.adsbygoogle) {
                        console.info(`[AdComponent] Pushing ad for slot: ${slot}`);
                        window.adsbygoogle.push({});
                        initialized.current = true;
                    } else if (typeof window !== 'undefined') {
                        // If script isn't loaded yet, try again in a bit
                        initialized.current = false; 
                    }
                } catch (e) {
                    console.error("AdSense Error:", e);
                }
            }, 100); // 100ms is usually enough for a paint cycle

            return () => clearTimeout(timer);
        }
    }, [isVisible, slot]);

    const adClientId = "ca-pub-4010131707839577";

    return (
        <div
            className="ad-container"
            ref={adRef}
            style={{
                margin: '20px 0',
                textAlign: 'center',
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                borderRadius: '12px',
                padding: '15px',
                minHeight: '280px', // Prevent layout shift
                overflow: 'hidden', // Contain the ad
                transition: 'background 0.3s ease',
                ...style
            }}
        >
            <div style={{ 
                fontSize: '10px', 
                color: isDark ? '#64748b' : '#94a3b8', 
                marginBottom: '8px', 
                textTransform: 'uppercase', 
                letterSpacing: '1px', 
                opacity: 0.8,
                fontWeight: 600
            }}>
                Sponsored Content
            </div>
            
            <ins
                className="adsbygoogle"
                style={{
                    display: 'block', // Must be block for AdSense to measure correctly
                    opacity: isVisible ? 1 : 0, // Fade in when ready
                    minHeight: isVisible ? '250px' : '1px',
                    width: '100%',
                    backgroundColor: 'transparent',
                    transition: 'opacity 0.5s ease'
                }}
                data-ad-client={adClientId}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive}
            />

            {!isVisible && (
                <div style={{ 
                    height: '250px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    fontSize: '12px',
                    fontStyle: 'italic'
                }}>
                    Optimizing ad delivery...
                </div>
            )}
        </div>
    );
};

export default AdComponent;

