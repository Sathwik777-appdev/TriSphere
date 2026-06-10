import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const ThreeBackground = ({ isLoginPage = false }) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const animationIdRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
        const performanceMode = isLowEnd;

        // Particle counts - reduced for mobile (and cut by 50% per user request)
        const MILKY_WAY_COUNT = performanceMode ? 2500 : 6000;
        const STAR_COUNT = performanceMode ? 2000 : 5000;
        const DUST_COUNT = performanceMode ? 500 : 1500;

        // Track if renderer was successfully added to DOM
        let rendererAdded = false;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera setup
        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            3000
        );
        camera.position.z = 1;
        cameraRef.current = camera;

        // Renderer setup with error handling
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: !performanceMode, // Disable antialiasing on mobile
                alpha: true,
                powerPreference: performanceMode ? 'low-power' : 'default',
                failIfMajorPerformanceCaveat: false
            });

            // Check if WebGL context was created successfully
            if (!renderer.getContext()) {
                console.error('Failed to get WebGL context');
                return;
            }

            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, performanceMode ? 1.5 : 2));
            renderer.setClearColor(0x000308, 1);

            // Only append if container still exists
            if (containerRef.current) {
                containerRef.current.appendChild(renderer.domElement);
                rendererAdded = true;
            }
            rendererRef.current = renderer;
        } catch (error) {
            console.error('Error creating WebGL renderer:', error);
            return;
        }

        // ============ MILKY WAY BAND ============
        const createMilkyWay = () => {
            const milkyWayGroup = new THREE.Group();

            // Create a band of dense stars for the Milky Way
            const milkyWayGeo = new THREE.BufferGeometry();
            const milkyWayCount = MILKY_WAY_COUNT;
            const positions = new Float32Array(milkyWayCount * 3);
            const colors = new Float32Array(milkyWayCount * 3);
            const sizes = new Float32Array(milkyWayCount);

            for (let i = 0; i < milkyWayCount; i++) {
                const i3 = i * 3;
                // Create a band across the sky
                const angle = (Math.random() - 0.5) * 0.45;
                const distance = 400 + Math.random() * 800;
                const theta = Math.random() * Math.PI * 2;

                positions[i3] = distance * Math.cos(theta);
                positions[i3 + 1] = distance * angle + (Math.random() - 0.5) * 100;
                // Ensure Milky Way is far behind Earth (which is at z: -150)
                positions[i3 + 2] = -Math.abs(distance * Math.sin(theta) * 0.6) - 300;

                // Warm colors for milky way
                const warmth = Math.random();
                colors[i3] = 0.9 + warmth * 0.1;
                colors[i3 + 1] = 0.85 + warmth * 0.1;
                colors[i3 + 2] = 0.75 + warmth * 0.25;

                sizes[i] = Math.random() * 2.0 + 0.5;
            }

            milkyWayGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            milkyWayGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const milkyWayMat = new THREE.PointsMaterial({
                size: 1.5, // Increased from 0.8
                vertexColors: true,
                transparent: true,
                opacity: 0.95, // Increased from 0.7
                blending: THREE.AdditiveBlending,
            });

            const milkyWay = new THREE.Points(milkyWayGeo, milkyWayMat);
            milkyWayGroup.add(milkyWay);

            return milkyWayGroup;
        };

        scene.add(createMilkyWay());

        // ============ TWINKLING STARS WITH ANIMATION ============
        const starsData = {
            geometry: null,
            material: null,
            mesh: null,
            originalSizes: null
        };

        const createStars = () => {
            const starsGeometry = new THREE.BufferGeometry();
            const starCount = STAR_COUNT;
            const starPositions = new Float32Array(starCount * 3);
            const starColors = new Float32Array(starCount * 3);
            const starSizes = new Float32Array(starCount);
            const twinklePhases = new Float32Array(starCount);

            const starColorPalette = [
                { r: 1.0, g: 1.0, b: 1.0 },     // Pure white
                { r: 0.8, g: 0.9, b: 1.0 },     // Class O (Blue)
                { r: 0.9, g: 0.95, b: 1.0 },    // Class B (Blue-white)
                { r: 1.0, g: 1.0, b: 0.8 },     // Class F (White-yellow)
                { r: 1.0, g: 0.9, b: 0.6 },     // Class K (Orange)
                { r: 1.0, g: 0.6, b: 0.4 },     // Class M (Red)
            ];

            for (let i = 0; i < starCount; i++) {
                const i3 = i * 3;
                const radius = 200 + Math.random() * 1200;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);

                // Add subtle clustering noise for more natural distribution
                const clusterNoise = (Math.random() - 0.5) * 50;

                starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta) + clusterNoise;
                starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + clusterNoise;
                // Ensure all stars are behind the Earth (Earth front is at approx -92, back is -208)
                starPositions[i3 + 2] = -Math.abs(radius * Math.cos(phi)) - 250;

                // Realistic color distribution - most stars are white/blue
                const colorRand = Math.random();
                let color;
                if (colorRand < 0.50) { // 50% pure white
                    color = starColorPalette[0];
                } else if (colorRand < 0.75) { // 25% blue-white
                    color = starColorPalette[1];
                } else if (colorRand < 0.88) { // 13% bright white-blue
                    color = starColorPalette[2];
                } else if (colorRand < 0.94) { // 6% white-yellow
                    color = starColorPalette[3];
                } else if (colorRand < 0.98) { // 4% orange
                    color = starColorPalette[4];
                } else { // 2% red giants
                    color = starColorPalette[5];
                }

                // Add slight color variation for natural look
                const colorVar = 0.05;
                starColors[i3] = Math.min(1, color.r + (Math.random() - 0.5) * colorVar);
                starColors[i3 + 1] = Math.min(1, color.g + (Math.random() - 0.5) * colorVar);
                starColors[i3 + 2] = Math.min(1, color.b + (Math.random() - 0.5) * colorVar);

                // Power law distribution for sizes - most stars tiny, few large
                const sizeFactor = Math.pow(Math.random(), 2.5); // Power law
                if (Math.random() < 0.02) { // 2% bright major stars
                    starSizes[i] = 4 + Math.random() * 3;
                } else if (Math.random() < 0.10) { // 10% medium stars  
                    starSizes[i] = 1.5 + Math.random() * 1.5;
                } else { // 88% tiny distant stars
                    starSizes[i] = 0.3 + sizeFactor * 1.2;
                }

                twinklePhases[i] = Math.random() * Math.PI * 2;
            }

            starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
            starsGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
            starsGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

            const starsMaterial = new THREE.PointsMaterial({
                size: 1.8, // Reduced from 2.5 for more subtle appearance
                vertexColors: true,
                transparent: true,
                opacity: 0.85, // Reduced from 0.98 for softer look
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending,
            });

            const stars = new THREE.Points(starsGeometry, starsMaterial);

            starsData.geometry = starsGeometry;
            starsData.material = starsMaterial;
            starsData.mesh = stars;
            starsData.originalSizes = starSizes.slice();
            starsData.phases = twinklePhases;

            return stars;
        };

        scene.add(createStars());

        // ============ ATMOSPHERIC DUST (GLITTER) ============
        const createSpaceDust = () => {
            const count = DUST_COUNT;
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(count * 3);
            const phases = new Float32Array(count);

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const r = 60 + Math.random() * 60; // Concentrated around Earth
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;

                pos[i3] = r * Math.sin(phi) * Math.cos(theta);
                pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); // Centered with Earth at Y: 0
                // Space dust should only be behind Earth (Earth center at -150)
                pos[i3 + 2] = -150 - (Math.abs(Math.cos(phi)) * r + 10);

                phases[i] = Math.random() * Math.PI * 2;
            }

            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.PointsMaterial({
                size: 0.8,
                color: 0xffffff,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
            });

            const dust = new THREE.Points(geo, mat);
            dust.userData.phases = phases;
            return dust;
        };

        const spaceDust = createSpaceDust();
        scene.add(spaceDust);

        // ============ ENHANCED LIGHTING FOR VIBRANT EARTH ============
        // Warm ambient light with slight blue tint for base illumination
        const ambientLight = new THREE.AmbientLight(0x5566aa, 2.2);
        scene.add(ambientLight);

        // Main sunlight - warm white for realistic daylight
        const sunLight = new THREE.DirectionalLight(0xffeedd, 4.5);
        sunLight.position.set(500, 150, 250);
        scene.add(sunLight);

        // Fill light from below - stronger blue for ocean enhancement
        const fillLight = new THREE.DirectionalLight(0x4488ff, 2.0);
        fillLight.position.set(0, -300, 100);
        scene.add(fillLight);

        // Rim light (backlight) - enhanced blue
        const rimLight = new THREE.DirectionalLight(0x4477ff, 2.2);
        rimLight.position.set(-400, 50, -400);
        scene.add(rimLight);

        // ============ CINEMATIC REALISTIC PLANETS ============
        const planets = [];
        const textureLoader = new THREE.TextureLoader();

        // High-res Earth textures from Three.js examples (stable URLs)
        const earthTextures = {
            day: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
            night: 'https://threejs.org/examples/textures/planets/earth_lights_2048.png',
            clouds: 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png',
            normal: 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
            specular: 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'
        };

        const createCinematicPlanet = (x, y, z, radius, type) => {
            const group = new THREE.Group();
            group.position.set(x, y, z);

            // ---- PLANET CORE (TEXTURED EARTH) ----
            const planetGeo = new THREE.SphereGeometry(radius, 128, 128);
            let planet;

            if (type === 'earth') {
                const dayMap = textureLoader.load(earthTextures.day);
                const nightMap = textureLoader.load(earthTextures.night);
                const normalMap = textureLoader.load(earthTextures.normal);
                const specularMap = textureLoader.load(earthTextures.specular);

                // Create material for realistic Earth with proper color preservation
                const earthMaterial = new THREE.MeshPhongMaterial({
                    map: dayMap,
                    normalMap: normalMap,
                    normalScale: new THREE.Vector2(0.8, 0.8),
                    specularMap: specularMap,
                    specular: new THREE.Color(0x111111), // Subtle ocean specular
                    shininess: 15,
                    emissive: new THREE.Color(0x000000), // No emissive on daytime
                    emissiveMap: nightMap,
                    emissiveIntensity: 1.5, // City lights on night side only
                });

                planet = new THREE.Mesh(planetGeo, earthMaterial);

                // ---- CLOUD LAYER 1 (Main clouds - reduced opacity) ----
                const cloudMap = textureLoader.load(earthTextures.clouds);
                const cloudGeo1 = new THREE.SphereGeometry(radius * 1.008, 64, 64);
                const cloudMat1 = new THREE.MeshStandardMaterial({
                    map: cloudMap,
                    alphaMap: cloudMap,
                    transparent: true,
                    opacity: 0.35, // Reduced from 0.45 to show more land
                    depthWrite: false,
                });
                const clouds1 = new THREE.Mesh(cloudGeo1, cloudMat1);
                clouds1.userData.isCloud = true;
                clouds1.userData.cloudSpeed = 0.0006;
                planet.add(clouds1);

                // ---- CLOUD LAYER 2 (Higher altitude, faster) ----
                const cloudGeo2 = new THREE.SphereGeometry(radius * 1.022, 64, 64);
                const cloudMat2 = new THREE.MeshStandardMaterial({
                    map: cloudMap,
                    alphaMap: cloudMap,
                    transparent: true,
                    opacity: 0.25,
                    depthWrite: false,
                });
                const clouds2 = new THREE.Mesh(cloudGeo2, cloudMat2);
                clouds2.userData.isCloud = true;
                clouds2.userData.cloudSpeed = 0.0009;
                clouds2.rotation.y = Math.PI * 0.7;
                planet.add(clouds2);

                // Atmosphere layers removed per user request

            } else {
                const planetMat = new THREE.MeshPhongMaterial({ color: 0x2233ff });
                planet = new THREE.Mesh(planetGeo, planetMat);
            }

            group.add(planet);

            group.userData = {
                planet: planet,
                rotationSpeed: 0.0012,
                type: type,
            };

            return group;
        };

        // Add high-fidelity Earth centered on screen
        const earthX = isLoginPage ? 40 : 0;
        const earthSize = 58; // Increased from 48
        const earth = createCinematicPlanet(earthX, 0, -150, earthSize, 'earth');
        earth.rotation.x = 0.41; // Axial tilt
        scene.add(earth);
        planets.push(earth);

        // ============ SHOOTING STARS ============
        const shootingStars = [];

        const createShootingStar = () => {
            const geo = new THREE.BufferGeometry();
            const positions = new Float32Array([0, 0, 0, 20, -10, 0]);
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const mat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
            });

            const line = new THREE.Line(geo, mat);
            line.position.set(
                (Math.random() - 0.5) * 400,
                150 + Math.random() * 100,
                -210 - Math.random() * 200 // Ensure shooting stars are behind Earth
            );

            line.userData = {
                active: false,
                progress: 0,
                speed: 0.015 + Math.random() * 0.01,
            };

            return line;
        };

        for (let i = 0; i < 5; i++) {
            const star = createShootingStar();
            scene.add(star);
            shootingStars.push(star);
        }

        // ============ ANIMATION - DYNAMIC MOTION ============
        let time = 0;

        // Store initial planet positions for orbital motion
        planets.forEach((p, i) => {
            p.userData.orbitAngle = i * (Math.PI / 2);
            p.userData.orbitRadius = Math.sqrt(
                p.position.x * p.position.x + p.position.z * p.position.z
            );
            p.userData.orbitSpeed = 0.00015 + i * 0.00005;
            p.userData.baseY = p.position.y;
        });

        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            time += 0.002; // Faster time progression

            // ---- STAR FIELD MOTION ----
            // Subtle, realistic twinkling (atmospheric scintillation effect)
            if (starsData.geometry && starsData.phases) {
                const sizes = starsData.geometry.attributes.size.array;
                for (let i = 0; i < sizes.length; i++) {
                    // Gentle twinkle - much more subtle than before
                    const twinkle = Math.sin(time * 2 + starsData.phases[i]) * 0.15 + 0.85;
                    sizes[i] = starsData.originalSizes[i] * twinkle;
                }
                starsData.geometry.attributes.size.needsUpdate = true;
            }

            // Rotate star field - visible rotation
            if (starsData.mesh) {
                starsData.mesh.rotation.y = time * 0.08;
                starsData.mesh.rotation.x = Math.sin(time * 0.5) * 0.05;
            }

            // ---- PLANETS MOTION (CENTRAL FIXED EARTH) ----
            planets.forEach((p) => {
                // Self rotation
                if (p.userData.planet) {
                    p.userData.planet.rotation.y += p.userData.rotationSpeed * 2;

                    // Cloud layer rotation (if exists)
                    p.userData.planet.children.forEach(child => {
                        if (child.userData && child.userData.isCloud) {
                            child.rotation.y += child.userData.cloudSpeed || 0.001;
                        }
                    });
                }

                // Removed orbital motion for cinematic centered Earth
                // Removed vertical bob for static positioning
            });

            // ---- SPACE DUST ANIMATION ----
            if (spaceDust) {
                spaceDust.rotation.y += 0.001;
                spaceDust.material.opacity = 0.5 + Math.sin(time * 2) * 0.2;
            }

            // ---- SHOOTING STARS - MORE FREQUENT ----
            shootingStars.forEach((star) => {
                if (!star.userData.active) {
                    if (Math.random() < 0.003) { // More frequent
                        star.userData.active = true;
                        star.userData.progress = 0;
                        star.position.set(
                            (Math.random() - 0.5) * 500,
                            180 + Math.random() * 120,
                            -50 - Math.random() * 150
                        );
                    }
                } else {
                    star.userData.progress += star.userData.speed * 1.5; // Faster

                    // Fade in/out
                    if (star.userData.progress < 0.15) {
                        star.material.opacity = star.userData.progress / 0.15;
                    } else if (star.userData.progress > 0.6) {
                        star.material.opacity = (1 - star.userData.progress) / 0.4;
                    } else {
                        star.material.opacity = 1;
                    }

                    // Move faster
                    star.position.x += 4;
                    star.position.y -= 2;

                    if (star.userData.progress >= 1) {
                        star.userData.active = false;
                        star.material.opacity = 0;
                    }
                }
            });

            // ---- CINEMATIC CAMERA DRIFT ----
            // Keep camera mostly centered on Earth
            camera.position.x = Math.sin(time * 0.2) * 2;
            camera.position.y = Math.cos(time * 0.1) * 2;
            camera.position.z = 1 + Math.sin(time * 0.1) * 0.5;

            // Constantly look towards Earth (centered)
            const lookAtX = isLoginPage ? 40 : 0;
            camera.lookAt(lookAtX, 0, -150);

            // Subtle camera tilt
            camera.rotation.z = Math.sin(time * 0.3) * 0.01;

            renderer.render(scene, camera);
        };

        animate();

        // Resize handler
        const handleResize = () => {
            if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
            const w = window.innerWidth;
            const h = window.innerHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }

            // Safely cleanup renderer
            try {
                if (rendererRef.current) {
                    const domElement = rendererRef.current.domElement;

                    // Only try to remove if both container and element exist and element is a child
                    if (rendererAdded && containerRef.current && domElement && domElement.parentNode === containerRef.current) {
                        containerRef.current.removeChild(domElement);
                    }

                    rendererRef.current.dispose();
                    rendererRef.current = null;
                }
            } catch (error) {
                console.warn('Error during ThreeBackground cleanup:', error);
            }

            // Clear scene reference
            if (sceneRef.current) {
                sceneRef.current = null;
            }
            if (cameraRef.current) {
                cameraRef.current = null;
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -2,
                overflow: 'hidden',
                pointerEvents: 'none',
            }}
        />
    );
};

export default ThreeBackground;
