import React, { lazy, Suspense } from 'react';

const ThreeBackground = lazy(() => import('./ThreeBackground'));

const VideoBackground = ({ isLoginPage = false }) => {
    return (
        <>
            {/* Three.js Earth + Stars Background */}
            <Suspense fallback={
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: -2,
                    backgroundColor: '#000308',
                    pointerEvents: 'none',
                }} />
            }>
                <ThreeBackground isLoginPage={isLoginPage} />
            </Suspense>

            {/* Subtle overlay for content readability */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
                pointerEvents: 'none',
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(30, 58, 95, 0.3))',
            }} />
        </>
    );
};

export default VideoBackground;
