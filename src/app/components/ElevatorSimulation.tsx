import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Building, ArrowUp, ArrowDown, Info } from 'lucide-react';

// ==================== CONFIGURATION ====================
const CONFIG = {
  FLOORS: 6,
  FLOOR_HEIGHT: 4, // meters
  ELEVATOR_SPEED_MAX: 2, // m/s
  ACCELERATION: 1, // m/s²
  DECELERATION: 1, // m/s²
  DOOR_OPEN_TIME: 2000, // milliseconds
  DOOR_ANIMATION_TIME: 1000, // milliseconds
};

// ==================== STATE MACHINE ====================
enum ElevatorState {
  IDLE = 'IDLE',
  DOORS_OPENING = 'DOORS_OPENING',
  DOORS_OPEN = 'DOORS_OPEN',
  DOORS_CLOSING = 'DOORS_CLOSING',
  MOVING_UP = 'MOVING_UP',
  MOVING_DOWN = 'MOVING_DOWN',
}

export default function ElevatorSimulation() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [targetFloor, setTargetFloor] = useState<number | null>(null);
  const [state, setState] = useState<ElevatorState>(ElevatorState.IDLE);
  const [velocity, setVelocity] = useState(0);
  const [position, setPosition] = useState(0);
  const [doorProgress, setDoorProgress] = useState(0);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'fixed'>('orbit');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const elevatorCarRef = useRef<THREE.Group | null>(null);
  const leftDoorRef = useRef<THREE.Mesh | null>(null);
  const rightDoorRef = useRef<THREE.Mesh | null>(null);

  // ==================== THREE.JS SETUP ====================
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, CONFIG.FLOOR_HEIGHT * 3, 15);
    camera.lookAt(0, CONFIG.FLOOR_HEIGHT * 2, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    // Spotlight for dramatic effect
    const spotlight = new THREE.SpotLight(0x4a90e2, 1);
    spotlight.position.set(0, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS, 5);
    spotlight.target.position.set(0, 0, 0);
    spotlight.angle = Math.PI / 6;
    spotlight.penumbra = 0.3;
    scene.add(spotlight);
    scene.add(spotlight.target);

    // ==================== ELEVATOR SHAFT ====================
    // Shaft walls
    const shaftMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.3,
      roughness: 0.7,
    });

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(6, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS, 0.2),
      shaftMaterial
    );
    backWall.position.set(0, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS / 2, -3);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Side walls
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS, 6),
      shaftMaterial
    );
    leftWall.position.set(-3, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS / 2, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS, 6),
      shaftMaterial
    );
    rightWall.position.set(3, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS / 2, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // ==================== FLOORS ====================
    for (let i = 0; i < CONFIG.FLOORS; i++) {
      // Floor platform
      const floorGeometry = new THREE.BoxGeometry(6, 0.3, 6);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x34495e,
        metalness: 0.2,
        roughness: 0.8,
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.position.y = i * CONFIG.FLOOR_HEIGHT;
      floor.receiveShadow = true;
      scene.add(floor);

      // Floor number indicator (text sprite)
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i.toString(), 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(-3.5, i * CONFIG.FLOOR_HEIGHT + 2, 0);
      sprite.scale.set(1, 1, 1);
      scene.add(sprite);

      // Guide rails
      if (i === 0) {
        const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS, 16);
        const railMaterial = new THREE.MeshStandardMaterial({
          color: 0x7f8c8d,
          metalness: 0.8,
          roughness: 0.2,
        });

        const leftRail = new THREE.Mesh(railGeometry, railMaterial);
        leftRail.position.set(-2.5, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS / 2, -2.5);
        scene.add(leftRail);

        const rightRail = new THREE.Mesh(railGeometry, railMaterial);
        rightRail.position.set(2.5, CONFIG.FLOOR_HEIGHT * CONFIG.FLOORS / 2, -2.5);
        scene.add(rightRail);
      }
    }

    // ==================== ELEVATOR CAR ====================
    const elevatorCar = new THREE.Group();
    elevatorCarRef.current = elevatorCar;

    // Car body
    const carBodyGeometry = new THREE.BoxGeometry(2.8, 3, 2.8);
    const carBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.6,
      roughness: 0.3,
    });
    const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
    carBody.position.y = 1.5;
    carBody.castShadow = true;
    elevatorCar.add(carBody);

    // Car floor
    const carFloorGeometry = new THREE.BoxGeometry(2.8, 0.1, 2.8);
    const carFloorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.4,
      roughness: 0.6,
    });
    const carFloor = new THREE.Mesh(carFloorGeometry, carFloorMaterial);
    carFloor.castShadow = true;
    elevatorCar.add(carFloor);

    // Car ceiling with light
    const carCeilingGeometry = new THREE.BoxGeometry(2.8, 0.1, 2.8);
    const carCeiling = new THREE.Mesh(carCeilingGeometry, carFloorMaterial);
    carCeiling.position.y = 3;
    elevatorCar.add(carCeiling);

    const carLight = new THREE.PointLight(0xffffff, 1, 5);
    carLight.position.y = 2.8;
    elevatorCar.add(carLight);

    // ==================== ELEVATOR DOORS ====================
    const doorGeometry = new THREE.BoxGeometry(1.35, 2.5, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      metalness: 0.7,
      roughness: 0.3,
    });

    const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(-0.675, 1.5, 1.45);
    leftDoor.castShadow = true;
    leftDoorRef.current = leftDoor;
    elevatorCar.add(leftDoor);

    const rightDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    rightDoor.position.set(0.675, 1.5, 1.45);
    rightDoor.castShadow = true;
    rightDoorRef.current = rightDoor;
    elevatorCar.add(rightDoor);

    elevatorCar.position.y = 0;
    scene.add(elevatorCar);

    // ==================== GRID HELPER ====================
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // ==================== ANIMATION LOOP ====================
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      // Orbit camera slowly if in orbit mode
      if (cameraMode === 'orbit' && cameraRef.current) {
        const time = Date.now() * 0.0002;
        cameraRef.current.position.x = Math.cos(time) * 15;
        cameraRef.current.position.z = Math.sin(time) * 15;
        cameraRef.current.lookAt(0, CONFIG.FLOOR_HEIGHT * 2, 0);
      }

      renderer.render(scene, camera);
    };
    animate();

    // ==================== WINDOW RESIZE ====================
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // ==================== CLEANUP ====================
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [cameraMode]);

  // ==================== ELEVATOR PHYSICS & CONTROL LOGIC ====================
  useEffect(() => {
    const interval = setInterval(() => {
      if (!elevatorCarRef.current) return;

      const dt = 0.016; // ~60fps
      const currentY = position;
      const targetY = targetFloor !== null ? targetFloor * CONFIG.FLOOR_HEIGHT : currentY;

      // State machine logic
      switch (state) {
        case ElevatorState.IDLE:
          if (targetFloor !== null && targetFloor !== currentFloor) {
            setState(ElevatorState.DOORS_CLOSING);
          }
          break;

        case ElevatorState.DOORS_CLOSING:
          setDoorProgress((prev) => {
            const next = Math.max(0, prev - dt * (1 / (CONFIG.DOOR_ANIMATION_TIME / 1000)));
            if (next === 0) {
              // Doors fully closed, start moving
              if (targetFloor !== null) {
                setState(targetFloor > currentFloor ? ElevatorState.MOVING_UP : ElevatorState.MOVING_DOWN);
              }
            }
            return next;
          });
          break;

        case ElevatorState.MOVING_UP:
        case ElevatorState.MOVING_DOWN: {
          const distance = Math.abs(targetY - currentY);
          const movingUp = state === ElevatorState.MOVING_UP;
          
          // Calculate deceleration distance (v² = 2as)
          const decelerationDistance = (velocity * velocity) / (2 * CONFIG.DECELERATION);
          
          let newVelocity = velocity;
          let newPosition = currentY;

          if (distance <= decelerationDistance + 0.1) {
            // Deceleration phase
            newVelocity = Math.max(0, velocity - CONFIG.DECELERATION * dt);
          } else {
            // Acceleration/cruising phase
            if (velocity < CONFIG.ELEVATOR_SPEED_MAX) {
              newVelocity = Math.min(CONFIG.ELEVATOR_SPEED_MAX, velocity + CONFIG.ACCELERATION * dt);
            }
          }

          // Update position
          newPosition = currentY + (movingUp ? newVelocity : -newVelocity) * dt;
          
          // Check if reached target
          if ((movingUp && newPosition >= targetY) || (!movingUp && newPosition <= targetY)) {
            newPosition = targetY;
            newVelocity = 0;
            setCurrentFloor(targetFloor!);
            setTargetFloor(null);
            setState(ElevatorState.DOORS_OPENING);
          }

          setVelocity(newVelocity);
          setPosition(newPosition);
          elevatorCarRef.current.position.y = newPosition;
          break;
        }

        case ElevatorState.DOORS_OPENING:
          setDoorProgress((prev) => {
            const next = Math.min(1, prev + dt * (1 / (CONFIG.DOOR_ANIMATION_TIME / 1000)));
            if (next === 1) {
              setState(ElevatorState.DOORS_OPEN);
            }
            return next;
          });
          break;

        case ElevatorState.DOORS_OPEN:
          // Auto-close doors after delay
          setTimeout(() => {
            if (state === ElevatorState.DOORS_OPEN) {
              setState(targetFloor !== null ? ElevatorState.DOORS_CLOSING : ElevatorState.IDLE);
            }
          }, CONFIG.DOOR_OPEN_TIME);
          break;
      }

      // Update door positions
      if (leftDoorRef.current && rightDoorRef.current) {
        const doorOffset = doorProgress * 1.35;
        leftDoorRef.current.position.x = -0.675 - doorOffset;
        rightDoorRef.current.position.x = 0.675 + doorOffset;
      }
    }, 16);

    return () => clearInterval(interval);
  }, [state, position, velocity, targetFloor, currentFloor, doorProgress]);

  // ==================== FLOOR SELECTION ====================
  const handleFloorSelect = (floor: number) => {
    if (
      floor === currentFloor ||
      state === ElevatorState.MOVING_UP ||
      state === ElevatorState.MOVING_DOWN ||
      state === ElevatorState.DOORS_CLOSING
    ) {
      return; // Invalid action
    }
    setTargetFloor(floor);
  };

  // ==================== UI RENDERING ====================
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* 3D Visualization */}
      <div className="flex-1 bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div ref={mountRef} className="w-full h-[600px]" />
      </div>

      {/* Control Panel */}
      <div className="lg:w-80 space-y-6">
        {/* Status Display */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Building className="text-blue-400" />
            <h2 className="text-xl font-bold text-white">Elevator Status</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Current Floor:</span>
              <span className="text-white font-bold text-lg">{currentFloor}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">State:</span>
              <span className={`font-semibold ${
                state === ElevatorState.MOVING_UP || state === ElevatorState.MOVING_DOWN
                  ? 'text-yellow-400'
                  : 'text-green-400'
              }`}>
                {state.replace(/_/g, ' ')}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Velocity:</span>
              <span className="text-white">{velocity.toFixed(2)} m/s</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Position:</span>
              <span className="text-white">{position.toFixed(2)} m</span>
            </div>
            
            {targetFloor !== null && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-blue-900/30 rounded-lg">
                {targetFloor > currentFloor ? (
                  <ArrowUp className="text-blue-400" size={20} />
                ) : (
                  <ArrowDown className="text-blue-400" size={20} />
                )}
                <span className="text-blue-200 text-sm">
                  Going to floor {targetFloor}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Floor Buttons */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4">Select Floor</h3>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: CONFIG.FLOORS }, (_, i) => i).reverse().map((floor) => (
              <button
                key={floor}
                onClick={() => handleFloorSelect(floor)}
                disabled={
                  floor === currentFloor ||
                  state === ElevatorState.MOVING_UP ||
                  state === ElevatorState.MOVING_DOWN ||
                  state === ElevatorState.DOORS_CLOSING
                }
                className={`
                  h-16 rounded-lg font-bold text-lg transition-all duration-200
                  ${floor === currentFloor
                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                    : floor === targetFloor
                    ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {floor}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Controls */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4">Camera Mode</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCameraMode('orbit')}
              className={`
                py-3 rounded-lg font-semibold transition-all duration-200
                ${cameraMode === 'orbit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }
              `}
            >
              Orbit
            </button>
            <button
              onClick={() => setCameraMode('fixed')}
              className={`
                py-3 rounded-lg font-semibold transition-all duration-200
                ${cameraMode === 'fixed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }
              `}
            >
              Fixed
            </button>
          </div>
        </div>

        {/* Engineering Info */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Info className="text-blue-400" size={20} />
            <h3 className="font-bold text-white">System Parameters</h3>
          </div>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Max Speed:</span>
              <span className="text-white">{CONFIG.ELEVATOR_SPEED_MAX} m/s</span>
            </div>
            <div className="flex justify-between">
              <span>Acceleration:</span>
              <span className="text-white">{CONFIG.ACCELERATION} m/s²</span>
            </div>
            <div className="flex justify-between">
              <span>Deceleration:</span>
              <span className="text-white">{CONFIG.DECELERATION} m/s²</span>
            </div>
            <div className="flex justify-between">
              <span>Door Time:</span>
              <span className="text-white">{CONFIG.DOOR_OPEN_TIME}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
