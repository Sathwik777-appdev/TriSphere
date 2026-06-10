import React from 'react';
import './RobotLoader.css';

/**
 * AI Brain Neural Network Loader
 * Elegant, modern neural network animation with pulsing nodes and connections
 */
const RobotLoader = ({ size = 200, showText = true }) => {
    return (
        <div className="neural-loader-container">
            {/* Outer glow */}
            <div className="neural-glow"></div>

            {/* Main brain container */}
            <div className="neural-brain" style={{ width: size, height: size }}>
                {/* Rotating outer ring */}
                <div className="brain-ring outer"></div>
                <div className="brain-ring middle"></div>
                <div className="brain-ring inner"></div>

                {/* Neural network nodes */}
                <div className="neural-network">
                    {/* Center core */}
                    <div className="core-node">
                        <div className="core-pulse"></div>
                        <div className="core-inner"></div>
                    </div>

                    {/* Inner layer nodes */}
                    <div className="node-layer inner-layer">
                        <div className="neural-node n1"><div className="node-glow"></div></div>
                        <div className="neural-node n2"><div className="node-glow"></div></div>
                        <div className="neural-node n3"><div className="node-glow"></div></div>
                        <div className="neural-node n4"><div className="node-glow"></div></div>
                        <div className="neural-node n5"><div className="node-glow"></div></div>
                        <div className="neural-node n6"><div className="node-glow"></div></div>
                    </div>

                    {/* Outer layer nodes */}
                    <div className="node-layer outer-layer">
                        <div className="neural-node n1"><div className="node-glow"></div></div>
                        <div className="neural-node n2"><div className="node-glow"></div></div>
                        <div className="neural-node n3"><div className="node-glow"></div></div>
                        <div className="neural-node n4"><div className="node-glow"></div></div>
                        <div className="neural-node n5"><div className="node-glow"></div></div>
                        <div className="neural-node n6"><div className="node-glow"></div></div>
                        <div className="neural-node n7"><div className="node-glow"></div></div>
                        <div className="neural-node n8"><div className="node-glow"></div></div>
                    </div>

                    {/* Connection lines SVG */}
                    <svg className="connections-svg" viewBox="0 0 200 200">
                        {/* Inner to core connections */}
                        <line className="connection c1" x1="100" y1="100" x2="100" y2="55" />
                        <line className="connection c2" x1="100" y1="100" x2="140" y2="75" />
                        <line className="connection c3" x1="100" y1="100" x2="140" y2="125" />
                        <line className="connection c4" x1="100" y1="100" x2="100" y2="145" />
                        <line className="connection c5" x1="100" y1="100" x2="60" y2="125" />
                        <line className="connection c6" x1="100" y1="100" x2="60" y2="75" />

                        {/* Outer connections */}
                        <line className="connection c7" x1="100" y1="55" x2="100" y2="20" />
                        <line className="connection c8" x1="140" y1="75" x2="170" y2="50" />
                        <line className="connection c9" x1="140" y1="125" x2="175" y2="100" />
                        <line className="connection c10" x1="140" y1="125" x2="170" y2="150" />
                        <line className="connection c11" x1="100" y1="145" x2="100" y2="180" />
                        <line className="connection c12" x1="60" y1="125" x2="30" y2="150" />
                        <line className="connection c13" x1="60" y1="125" x2="25" y2="100" />
                        <line className="connection c14" x1="60" y1="75" x2="30" y2="50" />

                        {/* Data pulses along connections */}
                        <circle className="data-pulse dp1" r="3" />
                        <circle className="data-pulse dp2" r="3" />
                        <circle className="data-pulse dp3" r="3" />
                        <circle className="data-pulse dp4" r="3" />
                        <circle className="data-pulse dp5" r="3" />
                        <circle className="data-pulse dp6" r="3" />
                    </svg>
                </div>

                {/* Floating particles */}
                <div className="brain-particles">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className={`brain-particle p${i + 1}`}></div>
                    ))}
                </div>

                {/* Scanning effect */}
                <div className="brain-scan"></div>
            </div>

            {showText && (
                <div className="neural-text-container">
                    <div className="neural-badge">
                        <span className="badge-dot"></span>
                        <span>AI</span>
                    </div>
                    <span className="neural-text">Processing</span>
                    <div className="neural-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            )}

            {/* Progress indicator */}
            <div className="neural-progress">
                <div className="progress-track">
                    <div className="progress-fill"></div>
                </div>
            </div>
        </div>
    );
};

export default RobotLoader;
