        // ========== STATE ==========
        let scene, camera, renderer, raycaster, mouse;
        let gates = [], pathPoints = [], pathTube = null, pathMarkers = [];
        let drone = null, selectedGate = null, hoveredGate = null;
        let isDragging = false, isPathMode = false, isLocked = false, isAnimating = false;
        let isDrawingPath = false; // NEW: for continuous path tracing
        let animationProgress = 0, animationSpeed = 5;
        let currentPathHeight = 3; // NEW: current drawing height
        let groundPlane, dragPlane, offset = new THREE.Vector3();
        let undoStack = [];
        const MAX_UNDO = 25;
        let rotationIndicatorTimeout;
        let pathCursor = null; // NEW: visual cursor for path drawing
        let lastPathPoint = null; // NEW: track last point for distance check
        const MIN_POINT_DISTANCE = 0.8; // NEW: minimum distance between path points

        // Touch state for mobile support
        const touchState = {
            touches: [],
            lastTouchDistance: 0,
            lastTouchAngle: 0,
            isTwoFingerGesture: false,
            touchStartTime: 0,
            lastTapTime: 0,
            tapCount: 0
        };
        let isMobile = false;

        const cameraState = {
            isRotating: false, isPanning: false,
            prevMouseX: 0, prevMouseY: 0,
            theta: Math.PI / 4, phi: Math.PI / 3.5,
            radius: 45, target: new THREE.Vector3(0, 0, 0)
        };

        const gateMaterials = {};

        // ========== INIT ==========
        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87ceeb);
            scene.fog = new THREE.FogExp2(0x87ceeb, 0.004);

            camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
            
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.1;
            document.getElementById('canvas-container').appendChild(renderer.domElement);

            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();

            createMaterials();
            createGrassGround();
            createLights();
            createFieldMarkings();
            createPathCursor();

            dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            updateCamera();
            setupEventListeners();
            checkURLParams();

            setTimeout(() => document.getElementById('loadingScreen').classList.add('hidden'), 600);
            animate();
        }

        function createMaterials() {
            gateMaterials.frame = new THREE.MeshStandardMaterial({
                color: 0xff6600, metalness: 0.6, roughness: 0.4,
                emissive: 0xff3300, emissiveIntensity: 0.12
            });
            gateMaterials.mesh = new THREE.MeshStandardMaterial({
                color: 0x00f5ff, transparent: true, opacity: 0.35,
                side: THREE.DoubleSide, emissive: 0x00f5ff, emissiveIntensity: 0.08
            });
            gateMaterials.flag = new THREE.MeshStandardMaterial({
                color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.2
            });
        }

        function createGrassGround() {
            // Create realistic grass texture
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Base grass color
            const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 400);
            gradient.addColorStop(0, '#3d7a3d');
            gradient.addColorStop(1, '#2d5a2d');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);
            
            // Add grass blades and variation
            for (let i = 0; i < 20000; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const r = Math.random();
                
                if (r < 0.25) ctx.fillStyle = '#1e4d1a';
                else if (r < 0.5) ctx.fillStyle = '#2a5524';
                else if (r < 0.75) ctx.fillStyle = '#3a6b34';
                else if (r < 0.9) ctx.fillStyle = '#4a7c44';
                else ctx.fillStyle = '#5a8c54';
                
                const w = 1 + Math.random() * 3;
                const h = 1 + Math.random() * 2;
                ctx.fillRect(x, y, w, h);
            }
            
            // Add some darker patches
            for (let i = 0; i < 50; i++) {
                ctx.fillStyle = `rgba(20, 60, 20, ${0.1 + Math.random() * 0.15})`;
                ctx.beginPath();
                ctx.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 30, 8 + Math.random() * 20, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }

            const grassTexture = new THREE.CanvasTexture(canvas);
            grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
            grassTexture.repeat.set(25, 25);

            const groundGeo = new THREE.PlaneGeometry(200, 200, 50, 50);
            // Add slight height variation
            const pos = groundGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                pos.setZ(i, (Math.random() - 0.5) * 0.1);
            }
            groundGeo.computeVertexNormals();

            const groundMat = new THREE.MeshStandardMaterial({
                map: grassTexture, roughness: 0.95, metalness: 0.0
            });

            groundPlane = new THREE.Mesh(groundGeo, groundMat);
            groundPlane.rotation.x = -Math.PI / 2;
            groundPlane.receiveShadow = true;
            groundPlane.name = 'ground';
            scene.add(groundPlane);
        }

        function createLights() {
            scene.add(new THREE.AmbientLight(0x8fafc8, 0.5));
            scene.add(new THREE.HemisphereLight(0x87ceeb, 0x2d5a2d, 0.6));

            const sun = new THREE.DirectionalLight(0xfff8e8, 1.3);
            sun.position.set(40, 60, 30);
            sun.castShadow = true;
            sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
            sun.shadow.camera.near = 1;
            sun.shadow.camera.far = 200;
            sun.shadow.camera.left = sun.shadow.camera.bottom = -70;
            sun.shadow.camera.right = sun.shadow.camera.top = 70;
            sun.shadow.bias = -0.0005;
            scene.add(sun);
        }

        function createFieldMarkings() {
            // Subtle grid
            const grid = new THREE.GridHelper(100, 20, 0xffffff, 0xffffff);
            grid.material.opacity = 0.06;
            grid.material.transparent = true;
            grid.position.y = 0.02;
            scene.add(grid);

            // Center circle
            const ringGeo = new THREE.RingGeometry(4.8, 5.2, 64);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.02;
            scene.add(ring);

            // Field boundary
            const boundGeo = new THREE.RingGeometry(48, 49, 64);
            const bound = new THREE.Mesh(boundGeo, ringMat);
            bound.rotation.x = -Math.PI / 2;
            bound.position.y = 0.02;
            scene.add(bound);

            // Corner markers
            const markerGeo = new THREE.ConeGeometry(0.3, 1.5, 8);
            const markerMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.3 });
            const corners = [[-48, -48], [-48, 48], [48, -48], [48, 48]];
            corners.forEach(([x, z]) => {
                const marker = new THREE.Mesh(markerGeo, markerMat);
                marker.position.set(x, 0.75, z);
                marker.castShadow = true;
                scene.add(marker);
            });
        }

        function createPathCursor() {
            // Main cursor sphere
            const cursorGeo = new THREE.SphereGeometry(0.25, 16, 16);
            const cursorMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 });
            pathCursor = new THREE.Group();
            
            const sphere = new THREE.Mesh(cursorGeo, cursorMat);
            pathCursor.add(sphere);
            
            // Vertical line to ground
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, -10, 0)
            ]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4 });
            const line = new THREE.Line(lineGeo, lineMat);
            line.name = 'heightLine';
            pathCursor.add(line);
            
            // Ground ring
            const ringGeo = new THREE.RingGeometry(0.3, 0.4, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.name = 'groundRing';
            pathCursor.add(ring);
            
            pathCursor.visible = false;
            scene.add(pathCursor);
        }

        function updateCamera() {
            const { theta, phi, radius, target } = cameraState;
            camera.position.x = target.x + radius * Math.sin(phi) * Math.cos(theta);
            camera.position.y = target.y + radius * Math.cos(phi);
            camera.position.z = target.z + radius * Math.sin(phi) * Math.sin(theta);
            camera.lookAt(target);
        }

        // ========== GATES ==========
        function createGate(type, position = new THREE.Vector3(0, 0, 0), rotation = 0) {
            let gate;
            switch(type) {
                case 'square': gate = createSquareGate(); break;
                case 'arch': gate = createArchGate(); break;
                case 'ladder': gate = createLadderGate(); break;
                case 'hurdle': gate = createHurdleGate(); break;
                case 'dive': gate = createDiveGate(); break;
                case 'flag': gate = createFlagMarker(); break;
                default: gate = createSquareGate();
            }
            gate.position.copy(position);
            gate.rotation.y = rotation;
            gate.userData.type = type;
            gate.userData.isGate = true;
            gate.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            scene.add(gate);
            gates.push(gate);
            updateStats();
            return gate;
        }

        function createSquareGate() {
            const g = new THREE.Group();
            const r = 0.1, w = 3, h = 3;
            const m = gateMaterials.frame.clone();
            const pipe = l => new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12), m);
            
            const b = pipe(w); b.rotation.z = Math.PI/2; b.position.set(0, 0.1, 0); g.add(b);
            const t = pipe(w); t.rotation.z = Math.PI/2; t.position.set(0, h, 0); g.add(t);
            const l = pipe(h); l.position.set(-w/2, h/2, 0); g.add(l);
            const rt = pipe(h); rt.position.set(w/2, h/2, 0); g.add(rt);
            
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w-0.3, h-0.3), gateMaterials.mesh.clone());
            mesh.position.set(0, h/2, 0); g.add(mesh);
            return g;
        }

        function createArchGate() {
            const g = new THREE.Group();
            const r = 0.1, w = 3, h = 3.5;
            const m = gateMaterials.frame.clone();
            
            const ll = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h-1, 12), m);
            ll.position.set(-w/2, (h-1)/2, 0); g.add(ll);
            const rl = ll.clone(); rl.position.set(w/2, (h-1)/2, 0); g.add(rl);
            
            const curve = new THREE.EllipseCurve(0, h-1, w/2, 1.2, 0, Math.PI, false);
            const pts = curve.getPoints(40).map(p => new THREE.Vector3(p.x, p.y, 0));
            const path = new THREE.CatmullRomCurve3(pts);
            g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 40, r, 8, false), m));
            
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w-0.4, h-0.6), gateMaterials.mesh.clone());
            mesh.position.set(0, h/2-0.2, 0); g.add(mesh);
            return g;
        }

        function createLadderGate() {
            const g = new THREE.Group();
            const r = 0.08, w = 2.5, sh = 2.5, lvl = 3;
            const m = gateMaterials.frame.clone();
            const colors = [0x00f5ff, 0xff00ff, 0x00ff88];
            const th = sh * lvl;
            
            const lp = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 12), m);
            lp.position.set(-w/2, th/2, 0); g.add(lp);
            const rp = lp.clone(); rp.position.set(w/2, th/2, 0); g.add(rp);
            
            for (let i = 0; i <= lvl; i++) {
                const y = i * sh;
                const rung = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), m);
                rung.rotation.z = Math.PI/2; rung.position.set(0, y, 0); g.add(rung);
                if (i < lvl) {
                    const mm = new THREE.MeshStandardMaterial({ color: colors[i], transparent: true, opacity: 0.3, side: THREE.DoubleSide, emissive: colors[i], emissiveIntensity: 0.1 });
                    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w-0.25, sh-0.25), mm);
                    mesh.position.set(0, y + sh/2, 0); g.add(mesh);
                }
            }
            return g;
        }

        function createHurdleGate() {
            const g = new THREE.Group();
            const r = 0.1, w = 5, h = 1.5;
            const m = gateMaterials.frame.clone();
            
            const tb = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), m);
            tb.rotation.z = Math.PI/2; tb.position.set(0, h, 0); g.add(tb);
            const ll = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), m);
            ll.position.set(-w/2, h/2, 0); g.add(ll);
            const rl = ll.clone(); rl.position.set(w/2, h/2, 0); g.add(rl);
            
            const mm = new THREE.MeshStandardMaterial({ color: 0xffff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide, emissive: 0xffaa00, emissiveIntensity: 0.2 });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w-0.4, h-0.25), mm);
            mesh.position.set(0, h/2, 0); g.add(mesh);
            return g;
        }

        function createDiveGate() {
            const g = new THREE.Group();
            const r = 0.1, w = 3.5, h = 3.5;
            const m = gateMaterials.frame.clone();
            const pts = [new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(w/2, h/2, 0), new THREE.Vector3(0, h, 0), new THREE.Vector3(-w/2, h/2, 0)];
            
            for (let i = 0; i < 4; i++) {
                const s = pts[i], e = pts[(i+1)%4];
                const len = s.distanceTo(e);
                const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
                const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m);
                bar.position.copy(mid); bar.lookAt(e); bar.rotateX(Math.PI/2);
                g.add(bar);
            }
            
            const shape = new THREE.Shape();
            shape.moveTo(0, 0.3); shape.lineTo(w/2-0.25, h/2); shape.lineTo(0, h-0.25); shape.lineTo(-w/2+0.25, h/2); shape.closePath();
            const mm = new THREE.MeshStandardMaterial({ color: 0xff00ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, emissive: 0xff00ff, emissiveIntensity: 0.1 });
            g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), mm));
            g.rotation.x = -0.25;
            return g;
        }

        function createFlagMarker() {
            const g = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 4, 12), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 }));
            pole.position.y = 2; g.add(pole);
            
            const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(1.3, 0.35); fs.lineTo(0, 0.7); fs.closePath();
            const flag = new THREE.Mesh(new THREE.ShapeGeometry(fs), gateMaterials.flag.clone());
            flag.position.set(0.04, 3.5, 0); flag.rotation.y = Math.PI/2; g.add(flag);
            
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.4, roughness: 0.6 }));
            base.position.y = 0.075; g.add(base);
            return g;
        }

        // ========== DRONE ==========
        function createDrone() {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 }));
            g.add(body);
            
            const am = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
            const pm = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.7 });
            [{x:0.22,z:0.18},{x:0.22,z:-0.18},{x:-0.22,z:0.18},{x:-0.22,z:-0.18}].forEach(p => {
                const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), am);
                motor.position.set(p.x, 0.03, p.z); g.add(motor);
                const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 16), pm);
                prop.position.set(p.x, 0.08, p.z); prop.userData.isProp = true; g.add(prop);
            });
            
            const cam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0x00f5ff }));
            cam.position.set(0.2, -0.01, 0); g.add(cam);
            
            const ledFront = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.015), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
            ledFront.position.set(0, -0.06, 0.12); g.add(ledFront);
            
            const ledBack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.015), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
            ledBack.position.set(0, -0.06, -0.12); g.add(ledBack);
            
            return g;
        }

        // ========== PATH ==========
        function updatePathVisualization() {
            if (pathTube) { scene.remove(pathTube); pathTube = null; }
            pathMarkers.forEach(m => scene.remove(m)); pathMarkers = [];
            
            if (pathPoints.length < 2) { updateStats(); return; }
            
            const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.5);
            pathTube = new THREE.Mesh(new THREE.TubeGeometry(curve, pathPoints.length * 15, 0.08, 8, false), new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 }));
            scene.add(pathTube);
            
            pathPoints.forEach((pt, i) => {
                let col = 0x00f5ff, sz = 0.15;
                if (i === 0) { col = 0x00ff00; sz = 0.2; }
                else if (i === pathPoints.length - 1) { col = 0xff0000; sz = 0.2; }
                const marker = new THREE.Mesh(new THREE.SphereGeometry(sz, 16, 16), new THREE.MeshBasicMaterial({ color: col }));
                marker.position.copy(pt); scene.add(marker); pathMarkers.push(marker);
                
                if (i === 0 || i === pathPoints.length - 1) {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 200; canvas.height = 50;
                    ctx.fillStyle = `#${col.toString(16).padStart(6, '0')}`;
                    ctx.font = 'Bold 32px Bebas Neue, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(i === 0 ? 'START' : 'FINISH', 100, 36);
                    const tex = new THREE.CanvasTexture(canvas);
                    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
                    sprite.scale.set(1.4, 0.35, 1);
                    sprite.position.copy(pt); sprite.position.y += 0.5;
                    scene.add(sprite); pathMarkers.push(sprite);
                }
            });
            updateStats();
            document.getElementById('clearPathBtn').disabled = pathPoints.length === 0;
        }

        function animateDrone() {
            if (!isAnimating || pathPoints.length < 2) return;
            if (!drone) { drone = createDrone(); scene.add(drone); }
            
            const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.5);
            const speed = animationSpeed * 0.0008;
            
            (function update() {
                if (!isAnimating) { if (drone) { scene.remove(drone); drone = null; } return; }
                animationProgress = (animationProgress + speed) % 1;
                
                const pos = curve.getPointAt(animationProgress);
                const tan = curve.getTangentAt(animationProgress);
                drone.position.copy(pos);
                drone.lookAt(pos.clone().add(tan));
                
                const nTan = curve.getTangentAt(Math.min(animationProgress + 0.01, 0.999));
                drone.rotation.z = tan.clone().cross(nTan).y * 2.5;
                drone.children.forEach(c => { if (c.userData.isProp) c.rotation.y += 0.6; });
                
                requestAnimationFrame(update);
            })();
        }

        // ========== UNDO ==========
        function saveState() {
            const state = { gates: gates.map(g => ({ type: g.userData.type, pos: {x:g.position.x, y:g.position.y, z:g.position.z}, rot: g.rotation.y })), path: pathPoints.map(p => ({x:p.x, y:p.y, z:p.z})) };
            undoStack.push(JSON.stringify(state));
            if (undoStack.length > MAX_UNDO) undoStack.shift();
            document.getElementById('undoBtn').disabled = undoStack.length <= 1;
        }

        function undo() {
            if (undoStack.length <= 1) return;
            undoStack.pop();
            const prev = JSON.parse(undoStack[undoStack.length - 1]);
            gates.forEach(g => scene.remove(g)); gates = [];
            prev.gates.forEach(g => createGate(g.type, new THREE.Vector3(g.pos.x, g.pos.y, g.pos.z), g.rot));
            pathPoints = prev.path.map(p => new THREE.Vector3(p.x, p.y, p.z));
            updatePathVisualization();
            document.getElementById('undoBtn').disabled = undoStack.length <= 1;
            document.getElementById('animateBtn').disabled = pathPoints.length < 2;
            showNotification('Undone');
        }

        // ========== EVENTS ==========
        function setupEventListeners() {
            const canvas = renderer.domElement;
            
            // Detect mobile device
            isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 768;
            
            document.querySelectorAll('.gate-item').forEach(item => {
                item.addEventListener('click', () => {
                    if (isLocked) { showNotification('Unlock to add gates', true); return; }
                    saveState();
                    const gate = createGate(item.dataset.gate, new THREE.Vector3((Math.random()-0.5)*25, 0, (Math.random()-0.5)*25));
                    selectGate(gate);
                    showNotification(`Added ${item.dataset.gate} gate`);
                    if (isMobile) closeMobilePanels(); // Close panel after adding on mobile
                });
            });

            // Mouse events
            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseup', onMouseUp);
            canvas.addEventListener('wheel', onWheel, { passive: false });
            canvas.addEventListener('contextmenu', e => e.preventDefault());
            canvas.addEventListener('dblclick', onDoubleClick);
            
            // Touch events for mobile
            canvas.addEventListener('touchstart', onTouchStart, { passive: false });
            canvas.addEventListener('touchmove', onTouchMove, { passive: false });
            canvas.addEventListener('touchend', onTouchEnd, { passive: false });
            canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
            
            document.addEventListener('keydown', onKeyDown);
            
            document.getElementById('lockTrackBtn').addEventListener('click', toggleLock);
            document.getElementById('drawPathBtn').addEventListener('click', togglePathMode);
            document.getElementById('animateBtn').addEventListener('click', toggleAnimation);
            document.getElementById('undoBtn').addEventListener('click', undo);
            document.getElementById('clearPathBtn').addEventListener('click', clearPath);
            document.getElementById('saveBtn').addEventListener('click', () => openModal('saveModal'));
            document.getElementById('loadBtn').addEventListener('click', () => openModal('loadModal'));
            document.getElementById('shareBtn').addEventListener('click', showShareModal);
            document.getElementById('clearBtn').addEventListener('click', () => { if (confirm('Clear all?')) clearAll(); });

            document.getElementById('speedSlider').addEventListener('input', e => {
                animationSpeed = +e.target.value;
                document.getElementById('speedValue').textContent = animationSpeed + 'x';
            });
            document.getElementById('heightSlider').addEventListener('input', e => {
                currentPathHeight = +e.target.value;
                document.getElementById('heightValue').textContent = currentPathHeight.toFixed(1) + 'm';
            });

            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
                isMobile = window.innerWidth <= 768;
            });

            // Close modals on escape or click outside
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
            });

            // Setup mobile UI
            setupMobileUI();

            saveState();
        }

        // ========== MOBILE UI ==========
        function setupMobileUI() {
            // Mobile menu toggle buttons
            const gatesMenuBtn = document.getElementById('gatesMenuBtn');
            const controlsMenuBtn = document.getElementById('controlsMenuBtn');
            const gatesPanel = document.getElementById('gatesPanel');
            const controlsPanel = document.getElementById('controlsPanel');
            const panelOverlay = document.getElementById('panelOverlay');
            const closeGatesBtn = document.getElementById('closeGatesPanel');
            const closeControlsBtn = document.getElementById('closeControlsPanel');
            
            // Menu toggle handlers
            gatesMenuBtn?.addEventListener('click', () => toggleMobilePanel('gates'));
            controlsMenuBtn?.addEventListener('click', () => toggleMobilePanel('controls'));
            closeGatesBtn?.addEventListener('click', () => closeMobilePanels());
            closeControlsBtn?.addEventListener('click', () => closeMobilePanels());
            panelOverlay?.addEventListener('click', () => closeMobilePanels());
            
            // Mobile quick bar buttons
            const quickGatesBtn = document.getElementById('quickGatesBtn');
            const quickLockBtn = document.getElementById('quickLockBtn');
            const quickPathBtn = document.getElementById('quickPathBtn');
            const quickPlayBtn = document.getElementById('quickPlayBtn');
            const quickControlsBtn = document.getElementById('quickControlsBtn');
            
            quickGatesBtn?.addEventListener('click', () => toggleMobilePanel('gates'));
            quickLockBtn?.addEventListener('click', toggleLock);
            quickPathBtn?.addEventListener('click', togglePathMode);
            quickPlayBtn?.addEventListener('click', toggleAnimation);
            quickControlsBtn?.addEventListener('click', () => toggleMobilePanel('controls'));
            
            // Mobile gate rotation buttons
            const rotateLeftBtn = document.getElementById('rotateLeftBtn');
            const rotateRightBtn = document.getElementById('rotateRightBtn');
            const deleteGateBtn = document.getElementById('deleteGateBtn');
            
            rotateLeftBtn?.addEventListener('click', () => {
                if (selectedGate) {
                    selectedGate.rotation.y -= Math.PI / 12; // -15 degrees
                    updateGateAngleDisplay();
                    showNotification('Rotated -15°');
                }
            });
            
            rotateRightBtn?.addEventListener('click', () => {
                if (selectedGate) {
                    selectedGate.rotation.y += Math.PI / 12; // +15 degrees
                    updateGateAngleDisplay();
                    showNotification('Rotated +15°');
                }
            });
            
            deleteGateBtn?.addEventListener('click', () => {
                if (selectedGate && !isLocked) {
                    saveState();
                    deleteSelectedGate();
                }
            });
            
            // Show touch hint on mobile
            if (isMobile) {
                showTouchHint();
            }
        }
        
        function toggleMobilePanel(panel) {
            const gatesPanel = document.getElementById('gatesPanel');
            const controlsPanel = document.getElementById('controlsPanel');
            const panelOverlay = document.getElementById('panelOverlay');
            
            if (panel === 'gates') {
                const isOpen = gatesPanel.classList.contains('open');
                closeMobilePanels();
                if (!isOpen) {
                    gatesPanel.classList.add('open');
                    panelOverlay.classList.add('show');
                }
            } else if (panel === 'controls') {
                const isOpen = controlsPanel.classList.contains('open');
                closeMobilePanels();
                if (!isOpen) {
                    controlsPanel.classList.add('open');
                    panelOverlay.classList.add('show');
                }
            }
        }
        
        function closeMobilePanels() {
            document.getElementById('gatesPanel')?.classList.remove('open');
            document.getElementById('controlsPanel')?.classList.remove('open');
            document.getElementById('panelOverlay')?.classList.remove('show');
        }
        
        function updateMobileQuickBar() {
            const quickLockBtn = document.getElementById('quickLockBtn');
            const quickPathBtn = document.getElementById('quickPathBtn');
            const quickPlayBtn = document.getElementById('quickPlayBtn');
            
            if (quickLockBtn) {
                quickLockBtn.innerHTML = isLocked ? '<span>🔓</span><small>Unlock</small>' : '<span>🔒</span><small>Lock</small>';
                quickLockBtn.classList.toggle('active', isLocked);
            }
            if (quickPathBtn) {
                quickPathBtn.disabled = !isLocked;
                quickPathBtn.classList.toggle('active', isPathMode);
                quickPathBtn.innerHTML = isPathMode ? '<span>✓</span><small>Done</small>' : '<span>✏️</span><small>Path</small>';
            }
            if (quickPlayBtn) {
                quickPlayBtn.disabled = pathPoints.length < 2;
                quickPlayBtn.classList.toggle('active', isAnimating);
                quickPlayBtn.innerHTML = isAnimating ? '<span>⏹</span><small>Stop</small>' : '<span>▶</span><small>Play</small>';
            }
        }
        
        function showTouchHint() {
            const hint = document.getElementById('touchHint');
            if (hint && !localStorage.getItem('fpvTouchHintShown')) {
                hint.classList.add('show');
                setTimeout(() => {
                    hint.classList.remove('show');
                    localStorage.setItem('fpvTouchHintShown', 'true');
                }, 4000);
            }
        }

        // ========== TOUCH EVENTS ==========
        function onTouchStart(e) {
            e.preventDefault();
            const touches = e.touches;
            touchState.touches = Array.from(touches);
            touchState.touchStartTime = Date.now();
            
            if (touches.length === 1) {
                // Single touch - similar to mouse left click
                const touch = touches[0];
                touchState.isTwoFingerGesture = false;
                
                mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, camera);
                
                // Path drawing mode
                if (isPathMode) {
                    const hit = raycaster.intersectObject(groundPlane);
                    if (hit.length) {
                        isDrawingPath = true;
                        saveState();
                        const pt = hit[0].point.clone();
                        pt.y = currentPathHeight;
                        pathPoints.push(pt);
                        lastPathPoint = pt.clone();
                        updatePathVisualization();
                        document.getElementById('animateBtn').disabled = pathPoints.length < 2;
                        updateMobileQuickBar();
                    }
                    return;
                }
                
                if (isLocked) return;
                
                // Check for gate selection
                const gateObjs = [];
                gates.forEach(g => g.traverse(c => { if (c.isMesh) gateObjs.push(c); }));
                const hits = raycaster.intersectObjects(gateObjs);
                
                if (hits.length) {
                    let obj = hits[0].object;
                    while (obj.parent && !obj.userData.isGate) obj = obj.parent;
                    if (obj.userData.isGate) {
                        selectGate(obj);
                        isDragging = true;
                        saveState();
                        const planeHit = new THREE.Vector3();
                        raycaster.ray.intersectPlane(dragPlane, planeHit);
                        offset.copy(planeHit).sub(obj.position);
                    }
                } else {
                    deselectGate();
                }
                
                cameraState.prevMouseX = touch.clientX;
                cameraState.prevMouseY = touch.clientY;
                
            } else if (touches.length === 2) {
                // Two finger gesture - stop dragging, prepare for pinch/rotate
                isDragging = false;
                isDrawingPath = false;
                touchState.isTwoFingerGesture = true;
                
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                touchState.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
                touchState.lastTouchAngle = Math.atan2(dy, dx);
                
                // Center point for camera rotation
                cameraState.prevMouseX = (touches[0].clientX + touches[1].clientX) / 2;
                cameraState.prevMouseY = (touches[0].clientY + touches[1].clientY) / 2;
            }
        }
        
        function onTouchMove(e) {
            e.preventDefault();
            const touches = e.touches;
            
            if (touches.length === 1 && !touchState.isTwoFingerGesture) {
                const touch = touches[0];
                
                mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
                
                // Path drawing
                if (isPathMode && isDrawingPath) {
                    raycaster.setFromCamera(mouse, camera);
                    const hit = raycaster.intersectObject(groundPlane);
                    if (hit.length && lastPathPoint) {
                        const newPoint = new THREE.Vector3(hit[0].point.x, currentPathHeight, hit[0].point.z);
                        const dist = newPoint.distanceTo(lastPathPoint);
                        
                        if (dist >= MIN_POINT_DISTANCE) {
                            pathPoints.push(newPoint);
                            lastPathPoint = newPoint.clone();
                            updatePathVisualization();
                            document.getElementById('animateBtn').disabled = pathPoints.length < 2;
                            updateMobileQuickBar();
                        }
                    }
                    return;
                }
                
                // Dragging gate
                if (isDragging && selectedGate && !isLocked) {
                    raycaster.setFromCamera(mouse, camera);
                    const planeHit = new THREE.Vector3();
                    raycaster.ray.intersectPlane(dragPlane, planeHit);
                    selectedGate.position.x = Math.round((planeHit.x - offset.x) * 2) / 2;
                    selectedGate.position.z = Math.round((planeHit.z - offset.z) * 2) / 2;
                    return;
                }
                
                // Single finger camera pan (when not dragging)
                if (!isDragging && !isPathMode) {
                    const spd = cameraState.radius * 0.002;
                    cameraState.target.x -= (touch.clientX - cameraState.prevMouseX) * spd;
                    cameraState.target.z += (touch.clientY - cameraState.prevMouseY) * spd;
                    cameraState.prevMouseX = touch.clientX;
                    cameraState.prevMouseY = touch.clientY;
                    updateCamera();
                }
                
            } else if (touches.length === 2) {
                touchState.isTwoFingerGesture = true;
                
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // Pinch to zoom
                if (touchState.lastTouchDistance > 0) {
                    const scale = touchState.lastTouchDistance / distance;
                    cameraState.radius = Math.max(15, Math.min(100, cameraState.radius * scale));
                }
                
                // Two finger rotation (camera orbit)
                const centerX = (touches[0].clientX + touches[1].clientX) / 2;
                const centerY = (touches[0].clientY + touches[1].clientY) / 2;
                
                cameraState.theta -= (centerX - cameraState.prevMouseX) * 0.008;
                cameraState.phi = Math.max(0.15, Math.min(Math.PI/2.1, cameraState.phi + (centerY - cameraState.prevMouseY) * 0.008));
                
                touchState.lastTouchDistance = distance;
                touchState.lastTouchAngle = angle;
                cameraState.prevMouseX = centerX;
                cameraState.prevMouseY = centerY;
                
                updateCamera();
            }
        }
        
        function onTouchEnd(e) {
            e.preventDefault();
            
            // Stop path drawing
            if (isDrawingPath) {
                isDrawingPath = false;
                lastPathPoint = null;
                if (pathPoints.length > 1) {
                    showNotification(`Path traced: ${pathPoints.length} points`);
                }
            }
            
            // Check for tap (short touch without much movement)
            const touchDuration = Date.now() - touchState.touchStartTime;
            if (touchDuration < 200 && !touchState.isTwoFingerGesture && e.changedTouches.length === 1) {
                // This was a tap - could implement double-tap here
                const now = Date.now();
                if (now - touchState.lastTapTime < 300) {
                    touchState.tapCount++;
                    if (touchState.tapCount >= 2) {
                        // Double tap - maybe zoom in or reset view
                        touchState.tapCount = 0;
                    }
                } else {
                    touchState.tapCount = 1;
                }
                touchState.lastTapTime = now;
            }
            
            isDragging = false;
            touchState.isTwoFingerGesture = false;
            touchState.lastTouchDistance = 0;
            touchState.touches = [];
        }

        function onMouseDown(e) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            
            if (e.button === 2) { cameraState.isRotating = true; cameraState.prevMouseX = e.clientX; cameraState.prevMouseY = e.clientY; return; }
            if (e.button === 1) { cameraState.isPanning = true; cameraState.prevMouseX = e.clientX; cameraState.prevMouseY = e.clientY; return; }
            
            // Path drawing mode - start tracing
            if (isPathMode && e.button === 0) {
                const hit = raycaster.intersectObject(groundPlane);
                if (hit.length) {
                    isDrawingPath = true;
                    saveState();
                    const pt = hit[0].point.clone();
                    pt.y = currentPathHeight;
                    pathPoints.push(pt);
                    lastPathPoint = pt.clone();
                    updatePathVisualization();
                    document.getElementById('animateBtn').disabled = pathPoints.length < 2;
                }
                return;
            }
            
            if (isLocked) return;
            
            const gateObjs = [];
            gates.forEach(g => g.traverse(c => { if (c.isMesh) gateObjs.push(c); }));
            const hits = raycaster.intersectObjects(gateObjs);
            
            if (hits.length) {
                let obj = hits[0].object;
                while (obj.parent && !obj.userData.isGate) obj = obj.parent;
                if (obj.userData.isGate) {
                    selectGate(obj);
                    isDragging = true;
                    saveState();
                    const planeHit = new THREE.Vector3();
                    raycaster.ray.intersectPlane(dragPlane, planeHit);
                    offset.copy(planeHit).sub(obj.position);
                }
            } else {
                deselectGate();
            }
        }

        function onMouseMove(e) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            if (cameraState.isRotating) {
                cameraState.theta -= (e.clientX - cameraState.prevMouseX) * 0.008;
                cameraState.phi = Math.max(0.15, Math.min(Math.PI/2.1, cameraState.phi + (e.clientY - cameraState.prevMouseY) * 0.008));
                cameraState.prevMouseX = e.clientX; cameraState.prevMouseY = e.clientY;
                updateCamera(); return;
            }
            
            if (cameraState.isPanning) {
                const spd = cameraState.radius * 0.0008;
                cameraState.target.x -= (e.clientX - cameraState.prevMouseX) * spd;
                cameraState.target.z += (e.clientY - cameraState.prevMouseY) * spd;
                cameraState.prevMouseX = e.clientX; cameraState.prevMouseY = e.clientY;
                updateCamera(); return;
            }
            
            // Path mode - update cursor and trace if drawing
            if (isPathMode) {
                raycaster.setFromCamera(mouse, camera);
                const hit = raycaster.intersectObject(groundPlane);
                if (hit.length) {
                    const groundPos = hit[0].point;
                    
                    // Update cursor position
                    if (pathCursor) {
                        pathCursor.position.set(groundPos.x, currentPathHeight, groundPos.z);
                        
                        // Update the height line
                        const line = pathCursor.getObjectByName('heightLine');
                        if (line) {
                            const positions = line.geometry.attributes.position;
                            positions.setY(1, -currentPathHeight);
                            positions.needsUpdate = true;
                        }
                        
                        // Update ground ring position
                        const ring = pathCursor.getObjectByName('groundRing');
                        if (ring) ring.position.y = -currentPathHeight + 0.02;
                    }
                    
                    // If drawing, add points along the path
                    if (isDrawingPath && lastPathPoint) {
                        const newPoint = new THREE.Vector3(groundPos.x, currentPathHeight, groundPos.z);
                        const dist = newPoint.distanceTo(lastPathPoint);
                        
                        if (dist >= MIN_POINT_DISTANCE) {
                            pathPoints.push(newPoint);
                            lastPathPoint = newPoint.clone();
                            updatePathVisualization();
                            document.getElementById('animateBtn').disabled = pathPoints.length < 2;
                        }
                    }
                }
                return;
            }
            
            if (isDragging && selectedGate && !isLocked) {
                raycaster.setFromCamera(mouse, camera);
                const planeHit = new THREE.Vector3();
                raycaster.ray.intersectPlane(dragPlane, planeHit);
                selectedGate.position.x = Math.round((planeHit.x - offset.x) * 2) / 2;
                selectedGate.position.z = Math.round((planeHit.z - offset.z) * 2) / 2;
                return;
            }
            
            // Hover detection
            if (!isDragging && !isLocked && !isPathMode) {
                raycaster.setFromCamera(mouse, camera);
                const gateObjs = [];
                gates.forEach(g => g.traverse(c => { if (c.isMesh) gateObjs.push(c); }));
                const hits = raycaster.intersectObjects(gateObjs);
                
                if (hits.length) {
                    let obj = hits[0].object;
                    while (obj.parent && !obj.userData.isGate) obj = obj.parent;
                    if (obj.userData.isGate) {
                        hoveredGate = obj;
                        renderer.domElement.style.cursor = 'pointer';
                        return;
                    }
                }
                hoveredGate = null;
                renderer.domElement.style.cursor = 'default';
            }
        }

        function onMouseUp(e) {
            // Stop path drawing
            if (isDrawingPath) {
                isDrawingPath = false;
                lastPathPoint = null;
                if (pathPoints.length > 1) {
                    showNotification(`Path traced: ${pathPoints.length} points`);
                }
            }
            
            isDragging = false;
            cameraState.isRotating = false;
            cameraState.isPanning = false;
        }

        function onWheel(e) {
            e.preventDefault();
            
            // In path mode, wheel controls height
            if (isPathMode) {
                currentPathHeight = Math.max(0.5, Math.min(15, currentPathHeight - e.deltaY * 0.01));
                updateHeightDisplay();
                
                // Update cursor position immediately
                if (pathCursor && pathCursor.visible) {
                    pathCursor.position.y = currentPathHeight;
                    const line = pathCursor.getObjectByName('heightLine');
                    if (line) {
                        const positions = line.geometry.attributes.position;
                        positions.setY(1, -currentPathHeight);
                        positions.needsUpdate = true;
                    }
                    const ring = pathCursor.getObjectByName('groundRing');
                    if (ring) ring.position.y = -currentPathHeight + 0.02;
                }
                
                showHeightIndicator(e.clientX, e.clientY, currentPathHeight);
                return;
            }
            
            // Rotate gate if selected or hovering over a gate
            const targetGate = selectedGate || hoveredGate;
            if (targetGate && !isLocked) {
                if (!selectedGate) selectGate(targetGate); // Auto-select on scroll
                targetGate.rotation.y += e.deltaY * 0.003;
                updateGateAngleDisplay();
                showRotationIndicator(e.clientX, e.clientY, targetGate.rotation.y);
                return;
            }
            
            // Zoom camera
            cameraState.radius = Math.max(15, Math.min(100, cameraState.radius + e.deltaY * 0.035));
            updateCamera();
        }

        function onDoubleClick(e) {
            if (isLocked || isPathMode) return;
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            
            const gateObjs = [];
            gates.forEach(g => g.traverse(c => { if (c.isMesh) gateObjs.push(c); }));
            const hits = raycaster.intersectObjects(gateObjs);
            
            if (hits.length) {
                let obj = hits[0].object;
                while (obj.parent && !obj.userData.isGate) obj = obj.parent;
                if (obj.userData.isGate) {
                    selectGate(obj);
                    isDragging = true;
                    saveState();
                    const planeHit = new THREE.Vector3();
                    raycaster.ray.intersectPlane(dragPlane, planeHit);
                    offset.copy(planeHit).sub(obj.position);
                }
            }
        }

        function onKeyDown(e) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedGate && !isLocked) { saveState(); deleteSelectedGate(); }
            }
            if (e.key === 'Escape') {
                if (isPathMode) togglePathMode();
                deselectGate();
                closeAllModals();
            }
            if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault(); undo();
            }
        }

        function showRotationIndicator(x, y, angle) {
            const ind = document.getElementById('rotationIndicator');
            ind.textContent = Math.round((angle * 180 / Math.PI) % 360) + '°';
            ind.style.left = (x + 15) + 'px';
            ind.style.top = (y - 10) + 'px';
            ind.classList.add('show');
            clearTimeout(rotationIndicatorTimeout);
            rotationIndicatorTimeout = setTimeout(() => ind.classList.remove('show'), 600);
        }

        function showHeightIndicator(x, y, height) {
            const ind = document.getElementById('rotationIndicator');
            ind.textContent = height.toFixed(1) + 'm';
            ind.style.left = (x + 15) + 'px';
            ind.style.top = (y - 10) + 'px';
            ind.classList.add('show');
            clearTimeout(rotationIndicatorTimeout);
            rotationIndicatorTimeout = setTimeout(() => ind.classList.remove('show'), 600);
        }

        function updateHeightDisplay() {
            document.getElementById('heightValue').textContent = currentPathHeight.toFixed(1) + 'm';
            const slider = document.getElementById('heightSlider');
            slider.value = currentPathHeight;
        }

        function updateGateAngleDisplay() {
            if (selectedGate) {
                document.getElementById('gateAngle').textContent = Math.round((selectedGate.rotation.y * 180 / Math.PI) % 360) + '°';
            }
        }

        function selectGate(gate) {
            deselectGate();
            selectedGate = gate;
            gate.traverse(c => {
                if (c.isMesh && c.material) {
                    c.userData.origEmissive = c.material.emissive?.getHex() || 0;
                    c.userData.origEmissiveInt = c.material.emissiveIntensity || 0;
                    if (c.material.emissive) {
                        c.material = c.material.clone();
                        c.material.emissive.setHex(0xff00ff);
                        c.material.emissiveIntensity = 0.4;
                    }
                }
            });
            document.getElementById('selectedGateInfo').classList.add('active');
            document.getElementById('selectedGateName').textContent = gate.userData.type.toUpperCase();
            updateGateAngleDisplay();
        }

        function deselectGate() {
            if (selectedGate) {
                selectedGate.traverse(c => {
                    if (c.isMesh && c.material && c.userData.origEmissive !== undefined) {
                        c.material.emissive.setHex(c.userData.origEmissive);
                        c.material.emissiveIntensity = c.userData.origEmissiveInt;
                    }
                });
            }
            selectedGate = null;
            document.getElementById('selectedGateInfo').classList.remove('active');
        }

        function deleteSelectedGate() {
            if (!selectedGate) return;
            const idx = gates.indexOf(selectedGate);
            if (idx > -1) gates.splice(idx, 1);
            scene.remove(selectedGate);
            selectedGate = null;
            document.getElementById('selectedGateInfo').classList.remove('active');
            updateStats();
            showNotification('Gate deleted');
        }

        // ========== MODES ==========
        function toggleLock() {
            isLocked = !isLocked;
            const btn = document.getElementById('lockTrackBtn');
            const badge = document.getElementById('modeBadge');
            const drawBtn = document.getElementById('drawPathBtn');
            
            if (isLocked) {
                btn.innerHTML = '<span>🔓</span> Unlock Layout';
                btn.classList.replace('btn-primary', 'btn-secondary');
                badge.textContent = 'Locked'; badge.className = 'mode-badge locked-mode';
                drawBtn.disabled = false;
                deselectGate();
                showNotification('Layout locked — draw your path');
            } else {
                btn.innerHTML = '<span>🔒</span> Lock Layout';
                btn.classList.replace('btn-secondary', 'btn-primary');
                badge.textContent = 'Edit Mode'; badge.className = 'mode-badge edit-mode';
                drawBtn.disabled = true;
                if (isPathMode) togglePathMode();
                showNotification('Layout unlocked');
            }
            updateMobileQuickBar();
        }

        function togglePathMode() {
            isPathMode = !isPathMode;
            const btn = document.getElementById('drawPathBtn');
            const badge = document.getElementById('modeBadge');
            
            if (isPathMode) {
                btn.innerHTML = '<span>✓</span> Finish Path';
                btn.classList.replace('btn-success', 'btn-secondary');
                badge.textContent = 'Drawing Path'; badge.className = 'mode-badge path-mode';
                renderer.domElement.style.cursor = 'crosshair';
                if (pathCursor) pathCursor.visible = true;
                showNotification(isMobile ? 'Drag to trace path' : 'Hold LMB + drag to trace path • Scroll for height');
            } else {
                btn.innerHTML = '<span>✏️</span> Draw Flight Path';
                btn.classList.replace('btn-secondary', 'btn-success');
                badge.textContent = 'Locked'; badge.className = 'mode-badge locked-mode';
                renderer.domElement.style.cursor = 'default';
                if (pathCursor) pathCursor.visible = false;
                isDrawingPath = false;
                lastPathPoint = null;
                if (pathPoints.length) showNotification(`Path: ${pathPoints.length} waypoints`);
            }
            updateMobileQuickBar();
        }

        function toggleAnimation() {
            isAnimating = !isAnimating;
            const btn = document.getElementById('animateBtn');
            if (isAnimating) { btn.innerHTML = '<span>⏹</span> Stop'; animateDrone(); }
            else { btn.innerHTML = '<span>▶</span> Animate Drone'; if (drone) { scene.remove(drone); drone = null; } }
            updateMobileQuickBar();
        }

        function clearPath() {
            saveState();
            pathPoints = [];
            updatePathVisualization();
            if (isAnimating) toggleAnimation();
            document.getElementById('animateBtn').disabled = true;
            document.getElementById('clearPathBtn').disabled = true;
            showNotification('Path cleared');
            updateMobileQuickBar();
        }

        // ========== MODALS ==========
        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }
        function closeAllModals() { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); }

        function saveTrack() {
            const name = document.getElementById('trackName').value || 'Untitled Track';
            const desc = document.getElementById('trackDescription').value;
            const author = document.getElementById('authorName').value || 'Anonymous';
            const data = { name, description: desc, author, createdAt: new Date().toISOString(),
                gates: gates.map(g => ({ type: g.userData.type, position: {x:g.position.x, y:g.position.y, z:g.position.z}, rotation: g.rotation.y })),
                pathPoints: pathPoints.map(p => ({x:p.x, y:p.y, z:p.z}))
            };
            try {
                const saved = JSON.parse(localStorage.getItem('fpvTracks') || '[]');
                saved.push(data);
                localStorage.setItem('fpvTracks', JSON.stringify(saved));
                closeModal('saveModal');
                showNotification('Track saved!');
            } catch (e) { console.warn('Save failed:', e); showNotification('Save failed', true); }
        }

        function loadTrack() {
            try {
                const track = JSON.parse(document.getElementById('loadData').value);
                clearAll(true);
                track.gates.forEach(g => createGate(g.type, new THREE.Vector3(g.position.x, g.position.y, g.position.z), g.rotation || 0));
                if (track.pathPoints?.length) {
                    pathPoints = track.pathPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
                    updatePathVisualization();
                    document.getElementById('animateBtn').disabled = pathPoints.length < 2;
                }
                saveState();
                closeModal('loadModal');
                showNotification(`Loaded: ${track.name}`);
            } catch (e) { console.warn('Load failed:', e); showNotification('Invalid data', true); }
        }

        function showShareModal() {
            const data = { name: document.getElementById('trackName').value || 'Shared Track',
                gates: gates.map(g => ({ type: g.userData.type, position: {x:+g.position.x.toFixed(2), y:+g.position.y.toFixed(2), z:+g.position.z.toFixed(2)}, rotation: +g.rotation.y.toFixed(3) })),
                pathPoints: pathPoints.map(p => ({x:+p.x.toFixed(2), y:+p.y.toFixed(2), z:+p.z.toFixed(2)}))
            };
            document.getElementById('shareData').value = JSON.stringify(data, null, 2);
            openModal('shareModal');
        }

        function copyShareData() {
            navigator.clipboard.writeText(document.getElementById('shareData').value)
                .then(() => showNotification('Copied!'))
                .catch(() => { document.getElementById('shareData').select(); document.execCommand('copy'); showNotification('Copied!'); });
        }

        function downloadTrack() {
            const blob = new Blob([document.getElementById('shareData').value], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'fpv-track.json';
            a.click();
            showNotification('Downloaded!');
        }

        function checkURLParams() {
            const track = new URLSearchParams(window.location.search).get('track');
            if (track) {
                try {
                    setTimeout(() => { document.getElementById('loadData').value = decodeURIComponent(track); loadTrack(); }, 800);
                } catch (e) { console.warn('Failed to parse track from URL:', e); }
            }
        }

        // ========== UTILS ==========
        function clearAll(silent = false) {
            gates.forEach(g => scene.remove(g)); gates = [];
            pathPoints = [];
            updatePathVisualization();
            if (isAnimating) toggleAnimation();
            if (isLocked) toggleLock();
            if (isPathMode) togglePathMode();
            document.getElementById('animateBtn').disabled = true;
            document.getElementById('clearPathBtn').disabled = true;
            deselectGate();
            updateStats();
            if (!silent) { undoStack = []; saveState(); showNotification('Track cleared'); }
        }

        function updateStats() {
            document.getElementById('gateCount').textContent = gates.length;
            document.getElementById('pathPoints').textContent = pathPoints.length;
            document.getElementById('trackLength').textContent = pathPoints.length >= 2 
                ? Math.round(new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.5).getLength()) + ' m' 
                : '0 m';
        }

        function showNotification(msg, isError = false) {
            const n = document.getElementById('notification');
            n.textContent = msg;
            n.className = 'notification show' + (isError ? ' error' : '');
            setTimeout(() => n.classList.remove('show'), 2000);
        }

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }

        window.addEventListener('load', init);
