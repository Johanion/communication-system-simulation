/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Maximize2, Compass, Layers } from 'lucide-react';

interface EulerHelix3DProps {
  theta: number; // Current angle in radians [0, 2*PI]
  omega: number; // Angular frequency rad/sec
  isPlaying: boolean;
}

// Coordinate conventions:
// Theta (Time) axis = World X (length L = 3.2, circle radius R = 1.0)
// Imaginary axis = World Y (vertical, up = +1, down = -1)
// Real axis = World Z (horizontal, forward = +1, back = -1)
const R = 1.0;
const L = 3.2; // theta axis length (0 to 2*PI scaled to 3.2 * R)
const Y_FLOOR = -1.5;
const Z_WALL = -1.5;

// Camera keyframe interface for continuous spline interpolation
interface CameraKeyframe {
  t: number;        // Master clock seconds (0 -> 10)
  azimuthDeg: number;  // 0° = straight down theta axis, 90° = side view, >90° = 2pi end nearer
  elevationDeg: number;// angle above horizontal plane (0° = flat, 58° = steep high view)
  targetX: number;  // Focus point along theta axis
  targetY: number;
  targetZ: number;
  fov: number;      // Field of view in degrees (22° at 2D flat, up to 34° in 3D)
  distance: number; // Camera distance from target
}

// 7 Keyframes defining the 2D -> 3D sequence
const SCRIPTED_KEYFRAMES: CameraKeyframe[] = [
  { t: 0.0, azimuthDeg: 0.0,   elevationDeg: 0.0,  targetX: 0.0, targetY: 0.0, targetZ: 0.0, fov: 22.0, distance: 5.8 },
  { t: 2.0, azimuthDeg: 60.0,  elevationDeg: 12.0, targetX: 1.0, targetY: 0.0, targetZ: 0.0, fov: 27.0, distance: 6.2 },
  { t: 4.0, azimuthDeg: 85.0,  elevationDeg: 22.0, targetX: 1.6, targetY: 0.0, targetZ: 0.0, fov: 32.0, distance: 6.8 },
  { t: 6.0, azimuthDeg: 125.0, elevationDeg: 55.0, targetX: 1.6, targetY: 0.0, targetZ: 0.0, fov: 34.0, distance: 7.2 },
  { t: 7.5, azimuthDeg: 130.0, elevationDeg: 58.0, targetX: 1.6, targetY: 0.0, targetZ: 0.0, fov: 34.0, distance: 7.3 },
  { t: 8.5, azimuthDeg: 105.0, elevationDeg: 36.0, targetX: 1.6, targetY: 0.0, targetZ: 0.0, fov: 32.0, distance: 7.0 },
  { t: 10.0,azimuthDeg: 105.0, elevationDeg: 36.0, targetX: 1.6, targetY: 0.0, targetZ: 0.0, fov: 32.0, distance: 7.0 },
];

// Continuous Catmull-Rom spline interpolation through keyframes
function evaluateCameraSpline(tNorm: number): {
  azimuthDeg: number;
  elevationDeg: number;
  target: THREE.Vector3;
  fov: number;
  distance: number;
} {
  const t = Math.max(0, Math.min(10.0, tNorm));
  const kf = SCRIPTED_KEYFRAMES;
  const n = kf.length;

  let i = 0;
  while (i < n - 2 && kf[i + 1].t <= t) {
    i++;
  }

  const p0 = kf[Math.max(0, i - 1)];
  const p1 = kf[i];
  const p2 = kf[Math.min(n - 1, i + 1)];
  const p3 = kf[Math.min(n - 1, i + 2)];

  const dt = Math.max(0.0001, p2.t - p1.t);
  const u = (t - p1.t) / dt;

  const catmull = (v0: number, v1: number, v2: number, v3: number, s: number) => {
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      0.5 *
      (2 * v1 +
        (-v0 + v2) * s +
        (2 * v0 - 5 * v1 + 4 * v2 - v3) * s2 +
        (-v0 + 3 * v1 - 3 * v2 + v3) * s3)
    );
  };

  return {
    azimuthDeg: catmull(p0.azimuthDeg, p1.azimuthDeg, p2.azimuthDeg, p3.azimuthDeg, u),
    elevationDeg: catmull(p0.elevationDeg, p1.elevationDeg, p2.elevationDeg, p3.elevationDeg, u),
    target: new THREE.Vector3(
      catmull(p0.targetX, p1.targetX, p2.targetX, p3.targetX, u),
      catmull(p0.targetY, p1.targetY, p2.targetY, p3.targetY, u),
      catmull(p0.targetZ, p1.targetZ, p2.targetZ, p3.targetZ, u)
    ),
    fov: catmull(p0.fov, p1.fov, p2.fov, p3.fov, u),
    distance: catmull(p0.distance, p1.distance, p2.distance, p3.distance, u),
  };
}

// Compute theta from master time T (0 -> 10s)
function computeThetaAtTime(T: number): number {
  const clampT = Math.max(0, Math.min(10.0, T));
  if (clampT <= 7.5) {
    const u = clampT / 7.5;
    const eased = u < 0.08 ? (u / 0.08) * (u / 0.08) * 0.04 : 0.04 + (u - 0.08) * (0.96 / 0.92);
    return Math.min(2 * Math.PI, Math.max(0, eased * 2 * Math.PI));
  } else if (clampT <= 8.5) {
    const u = (clampT - 7.5) / 1.0;
    const easeRewind = 0.5 * (1 - Math.cos(u * Math.PI));
    return 2 * Math.PI - easeRewind * Math.PI;
  } else {
    return Math.PI;
  }
}

interface SceneLabelItem {
  id: string;
  text: string;
  pos: THREE.Vector3;
  baseSizePct: number;
  color: string;
  priority: number;
  normalDir: { x: number; y: number };
  minT?: number;
}

export const EulerHelix3D: React.FC<EulerHelix3DProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Playback state & Projections visibility
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showProjections, setShowProjections] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<'scripted' | 'real' | 'imag' | 'phasor'>('scripted');
  const [zoomDisplay, setZoomDisplay] = useState<number>(1.0);

  const showProjectionsRef = useRef<boolean>(true);
  showProjectionsRef.current = showProjections;
  const projectionsOpacityRef = useRef<number>(1.0);

  // Throttled UI readout state
  const [readout, setReadout] = useState({
    T: 0.0,
    theta: 0.0,
    cosVal: 1.0,
    sinVal: 0.0,
    isHoldEnd: false,
  });

  // Master Clock & Animation Refs
  const masterTimeRef = useRef<number>(0.0);
  const isPlayingRef = useRef<boolean>(true);
  isPlayingRef.current = isPlaying;

  const animFrameIdRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const isTabHiddenRef = useRef<boolean>(false);

  // User Orbit Offset
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitOffsetRef = useRef<{ azimuth: number; elevation: number }>({ azimuth: 0, elevation: 0 });
  const lastInteractionTimeRef = useRef<number>(0);

  // User Zoom State
  const zoomFactorRef = useRef<number>(1.0);
  const targetZoomRef = useRef<number>(1.0);

  // Preset transition
  const presetTransitionRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
  }>({
    active: false,
    startPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
  });

  // Precomputed geometry & Three.js references
  const threeRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    helixCurvePoints: THREE.Vector3[];
    cosCurvePoints: THREE.Vector3[];
    sinCurvePoints: THREE.Vector3[];
    ghostMat: THREE.LineBasicMaterial;
    frameMat: THREE.LineBasicMaterial;
    guideMatPi: THREE.LineDashedMaterial;
    guideMat2Pi: THREE.LineDashedMaterial;
    // Dynamic objects
    markerHelix: THREE.Mesh;
    timePivot: THREE.Mesh;
    phasorRod: THREE.Mesh;
    floorMarker: THREE.Mesh;
    wallMarker: THREE.Mesh;
    tracedHelixMesh: THREE.Mesh;
    tracedCosMesh: THREE.Mesh;
    tracedSinMesh: THREE.Mesh;
    guideToFloor: THREE.Line;
    guideToWall: THREE.Line;
    guideToEnd: THREE.Line;
  } | null>(null);

  // Listen to tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      isTabHiddenRef.current = document.hidden;
      if (!document.hidden) {
        lastTimestampRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !canvas || !overlayCanvas) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 460;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 1. Scene setup with clean off-white background (#FAF9F6)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#FAF9F6');

    // 2. Camera setup with initial 2D look
    const initialCam = evaluateCameraSpline(0);
    const camera = new THREE.PerspectiveCamera(initialCam.fov, width / height, 0.1, 100);
    camera.position.set(-initialCam.distance, 0, 0);
    camera.lookAt(0, 0, 0);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Overlay 2D canvas sizing
    overlayCanvas.width = width * dpr;
    overlayCanvas.height = height * dpr;
    const overlayCtx = overlayCanvas.getContext('2d');

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 8);
    scene.add(dirLight);

    // 5. Build 3D Axes & Faint Outlines (#B8BEC4)
    const axesGroup = new THREE.Group();
    scene.add(axesGroup);

    const axisMat = new THREE.LineBasicMaterial({ color: 0xb8bec4, transparent: true, opacity: 0.85 });

    // Theta (X) Axis: 0 -> L + 0.5
    const thetaAxisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(L + 0.45, 0, 0),
    ]);
    axesGroup.add(new THREE.Line(thetaAxisGeom, axisMat));

    // Imag (Y) Axis: -R - 0.2 -> R + 0.35
    const imagAxisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -R - 0.2, 0),
      new THREE.Vector3(0, R + 0.35, 0),
    ]);
    axesGroup.add(new THREE.Line(imagAxisGeom, axisMat));

    // Real (Z) Axis: -R - 0.2 -> R + 0.35
    const realAxisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -R - 0.2),
      new THREE.Vector3(0, 0, R + 0.35),
    ]);
    axesGroup.add(new THREE.Line(realAxisGeom, axisMat));

    // Faint floor & back-wall boundary frames (18% opacity)
    const frameMat = new THREE.LineBasicMaterial({ color: 0xb8bec4, transparent: true, opacity: 0.18 });
    const floorFrameGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, Y_FLOOR, -R - 0.2),
      new THREE.Vector3(L + 0.2, Y_FLOOR, -R - 0.2),
      new THREE.Vector3(L + 0.2, Y_FLOOR, R + 0.2),
      new THREE.Vector3(0, Y_FLOOR, R + 0.2),
      new THREE.Vector3(0, Y_FLOOR, -R - 0.2),
    ]);
    axesGroup.add(new THREE.Line(floorFrameGeom, frameMat));

    const wallFrameGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -R - 0.2, Z_WALL),
      new THREE.Vector3(L + 0.2, -R - 0.2, Z_WALL),
      new THREE.Vector3(L + 0.2, R + 0.2, Z_WALL),
      new THREE.Vector3(0, R + 0.2, Z_WALL),
      new THREE.Vector3(0, -R - 0.2, Z_WALL),
    ]);
    axesGroup.add(new THREE.Line(wallFrameGeom, frameMat));

    // =========================================================================
    // NEW: FAINT DASHED GUIDE LINES AT PI AND 2PI ON BOTH PROJECTION PLANES
    // Color: #9AA5B1, 30% opacity, 1px thin, dashed 5px/5px, depthWrite: false
    // =========================================================================
    const guideMatPi = new THREE.LineDashedMaterial({
      color: 0x9aa5b1,
      dashSize: 0.07,
      gapSize: 0.07,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const guideMat2Pi = guideMatPi.clone();

    // 1. Sine Plane (Back Wall, Z = Z_WALL): Vertical lines at theta = pi and 2pi from Im = -1 to +1
    const sineGuidePiGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(L / 2, -R, Z_WALL),
      new THREE.Vector3(L / 2, R, Z_WALL),
    ]);
    const sineGuidePi = new THREE.Line(sineGuidePiGeom, guideMatPi);
    sineGuidePi.computeLineDistances();
    axesGroup.add(sineGuidePi);

    const sineGuide2PiGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(L, -R, Z_WALL),
      new THREE.Vector3(L, R, Z_WALL),
    ]);
    const sineGuide2Pi = new THREE.Line(sineGuide2PiGeom, guideMat2Pi);
    sineGuide2Pi.computeLineDistances();
    axesGroup.add(sineGuide2Pi);

    // 2. Cosine Plane (Floor, Y = Y_FLOOR): Horizontal lines across floor at theta = pi and 2pi from Re = -1 to +1
    const cosGuidePiGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(L / 2, Y_FLOOR, -R),
      new THREE.Vector3(L / 2, Y_FLOOR, R),
    ]);
    const cosGuidePi = new THREE.Line(cosGuidePiGeom, guideMatPi);
    cosGuidePi.computeLineDistances();
    axesGroup.add(cosGuidePi);

    const cosGuide2PiGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(L, Y_FLOOR, -R),
      new THREE.Vector3(L, Y_FLOOR, R),
    ]);
    const cosGuide2Pi = new THREE.Line(cosGuide2PiGeom, guideMat2Pi);
    cosGuide2Pi.computeLineDistances();
    axesGroup.add(cosGuide2Pi);

    // Unit circle in gray-green (#A9B8B0) in Re-Im plane (X = 0)
    const circlePoints: THREE.Vector3[] = [];
    const circleSegments = 120;
    for (let i = 0; i <= circleSegments; i++) {
      const ang = (i / circleSegments) * 2 * Math.PI;
      circlePoints.push(new THREE.Vector3(0, R * Math.sin(ang), R * Math.cos(ang)));
    }
    const circleGeom = new THREE.BufferGeometry().setFromPoints(circlePoints);
    const circleMat = new THREE.LineBasicMaterial({ color: 0xa9b8b0, transparent: true, opacity: 0.85 });
    axesGroup.add(new THREE.Line(circleGeom, circleMat));

    // Precompute 500 samples for curves across [0, 2*PI]
    const sampleCount = 500;
    const helixCurvePoints: THREE.Vector3[] = [];
    const cosCurvePoints: THREE.Vector3[] = [];
    const sinCurvePoints: THREE.Vector3[] = [];

    for (let i = 0; i <= sampleCount; i++) {
      const th = (i / sampleCount) * 2 * Math.PI;
      const x = (th / (2 * Math.PI)) * L;
      const y = R * Math.sin(th);
      const z = R * Math.cos(th);
      helixCurvePoints.push(new THREE.Vector3(x, y, z));
      cosCurvePoints.push(new THREE.Vector3(x, Y_FLOOR, z));
      sinCurvePoints.push(new THREE.Vector3(x, y, Z_WALL));
    }

    // Ghost curves (12% opacity reference background curves)
    const ghostMat = new THREE.LineBasicMaterial({ color: 0xa9b8b0, transparent: true, opacity: 0.12 });
    axesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(helixCurvePoints), ghostMat));
    axesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cosCurvePoints), ghostMat));
    axesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sinCurvePoints), ghostMat));

    // 6. Dynamic Traced Elements (Tube geometries updated each frame up to current theta)
    const helixMat = new THREE.MeshBasicMaterial({ color: 0x3e7c5a });
    const cosMat = new THREE.MeshBasicMaterial({ color: 0x3b5bbf });
    const sinMat = new THREE.MeshBasicMaterial({ color: 0xc0425a });

    const initCurve = new THREE.CatmullRomCurve3([helixCurvePoints[0], helixCurvePoints[1]]);
    const tracedHelixMesh = new THREE.Mesh(new THREE.TubeGeometry(initCurve, 2, 0.024, 6, false), helixMat);
    scene.add(tracedHelixMesh);

    const initCosCurve = new THREE.CatmullRomCurve3([cosCurvePoints[0], cosCurvePoints[1]]);
    const tracedCosMesh = new THREE.Mesh(new THREE.TubeGeometry(initCosCurve, 2, 0.022, 6, false), cosMat);
    scene.add(tracedCosMesh);

    const initSinCurve = new THREE.CatmullRomCurve3([sinCurvePoints[0], sinCurvePoints[1]]);
    const tracedSinMesh = new THREE.Mesh(new THREE.TubeGeometry(initSinCurve, 2, 0.022, 6, false), sinMat);
    scene.add(tracedSinMesh);

    // 7. Dynamic Moving Markers & Drop Lines
    const markerGeom = new THREE.SphereGeometry(0.08, 16, 16);

    const markerHelix = new THREE.Mesh(markerGeom, new THREE.MeshBasicMaterial({ color: 0xfff6b0 }));
    scene.add(markerHelix);

    const timePivot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x3e7c5a })
    );
    scene.add(timePivot);

    const phasorRodGeom = new THREE.CylinderGeometry(0.02, 0.02, R, 12);
    phasorRodGeom.rotateX(Math.PI / 2);
    phasorRodGeom.translate(0, 0, R / 2);
    const phasorRod = new THREE.Mesh(phasorRodGeom, new THREE.MeshBasicMaterial({ color: 0x3e7c5a }));
    scene.add(phasorRod);

    const floorMarker = new THREE.Mesh(markerGeom, new THREE.MeshBasicMaterial({ color: 0x3b5bbf }));
    scene.add(floorMarker);

    const wallMarker = new THREE.Mesh(markerGeom, new THREE.MeshBasicMaterial({ color: 0xc0425a }));
    scene.add(wallMarker);

    const dashedMatFloor = new THREE.LineDashedMaterial({
      color: 0x3b5bbf,
      dashSize: 0.08,
      gapSize: 0.06,
      transparent: true,
      opacity: 0.75,
    });
    const guideToFloor = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]),
      dashedMatFloor
    );
    scene.add(guideToFloor);

    const dashedMatWall = new THREE.LineDashedMaterial({
      color: 0xc0425a,
      dashSize: 0.08,
      gapSize: 0.06,
      transparent: true,
      opacity: 0.75,
    });
    const guideToWall = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]),
      dashedMatWall
    );
    scene.add(guideToWall);

    const dashedMatEnd = new THREE.LineDashedMaterial({
      color: 0x3e7c5a,
      dashSize: 0.08,
      gapSize: 0.06,
      transparent: true,
      opacity: 0.7,
    });
    const guideToEnd = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]),
      dashedMatEnd
    );
    scene.add(guideToEnd);

    threeRefs.current = {
      scene,
      camera,
      renderer,
      helixCurvePoints,
      cosCurvePoints,
      sinCurvePoints,
      ghostMat,
      frameMat,
      guideMatPi,
      guideMat2Pi,
      markerHelix,
      timePivot,
      phasorRod,
      floorMarker,
      wallMarker,
      tracedHelixMesh,
      tracedCosMesh,
      tracedSinMesh,
      guideToFloor,
      guideToWall,
      guideToEnd,
    };

    // 8. Resize Observer
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera || !overlayCanvasRef.current) return;
      const newW = containerRef.current.clientWidth || 600;
      const newH = containerRef.current.clientHeight || 460;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
      overlayCanvasRef.current.width = newW * dpr;
      overlayCanvasRef.current.height = newH * dpr;
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 9. Master Animation Loop (Driven by performance.now() deltas)
    lastTimestampRef.current = performance.now();
    let lastReadoutTime = 0;

    const renderLoop = (currentTimestamp: number) => {
      animFrameIdRef.current = requestAnimationFrame(renderLoop);

      const rawDt = (currentTimestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = currentTimestamp;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      if (isTabHiddenRef.current) return;

      // Update Master Clock T
      if (isPlayingRef.current && activePreset === 'scripted') {
        masterTimeRef.current += dt;
        if (masterTimeRef.current >= 11.5) {
          masterTimeRef.current = 0.0;
        }
      }

      const T = masterTimeRef.current;
      const currentTheta = computeThetaAtTime(T);
      const cosVal = Math.cos(currentTheta);
      const sinVal = Math.sin(currentTheta);

      // Smooth zoom lerp
      zoomFactorRef.current += (targetZoomRef.current - zoomFactorRef.current) * 0.12;
      const currentZoom = Math.min(3.0, Math.max(0.4, zoomFactorRef.current));

      // Ease user orbit offset back to 0 after 2s of inactivity
      const timeSinceInteract = (currentTimestamp - lastInteractionTimeRef.current) / 1000;
      if (!isDraggingRef.current && timeSinceInteract > 2.0) {
        orbitOffsetRef.current.azimuth *= 0.94;
        orbitOffsetRef.current.elevation *= 0.94;
      }

      // Smooth projections opacity ramp for toggle
      const targetProjOp = showProjectionsRef.current ? 1.0 : 0.0;
      projectionsOpacityRef.current += (targetProjOp - projectionsOpacityRef.current) * 0.15;
      const projOp = projectionsOpacityRef.current;

      // Calculate smooth 0.5s fade-in when the traced curve reaches pi and 2pi
      // The curve reaches theta = pi around T = 3.65s, and theta = 2pi around T = 7.15s
      const hasReachedPi = T >= 3.65 && T < 11.45;
      const hasReached2Pi = T >= 7.15 && T < 11.45;

      const fadePi = hasReachedPi ? Math.min(1.0, (T - 3.65) / 0.5) : 0.0;
      const fade2Pi = hasReached2Pi ? Math.min(1.0, (T - 7.15) / 0.5) : 0.0;

      // Update guide line materials opacity in Three.js (30% opacity when fully active)
      guideMatPi.opacity = 0.30 * fadePi * projOp;
      guideMat2Pi.opacity = 0.30 * fade2Pi * projOp;
      ghostMat.opacity = 0.12 * projOp;
      frameMat.opacity = 0.18 * projOp;

      // 10. Update Camera Position
      const splineState = evaluateCameraSpline(Math.min(10.0, T));
      const targetPos = splineState.target;

      if (activePreset === 'scripted') {
        const totalAzimuthRad = THREE.MathUtils.degToRad(splineState.azimuthDeg + orbitOffsetRef.current.azimuth);
        const totalElevationRad = THREE.MathUtils.degToRad(
          Math.max(-85, Math.min(85, splineState.elevationDeg + orbitOffsetRef.current.elevation))
        );

        const effectiveDist = splineState.distance / currentZoom;

        const cx = targetPos.x - effectiveDist * Math.cos(totalElevationRad) * Math.cos(totalAzimuthRad);
        const cz = targetPos.z + effectiveDist * Math.cos(totalElevationRad) * Math.sin(totalAzimuthRad);
        const cy = targetPos.y + effectiveDist * Math.sin(totalElevationRad);

        camera.fov = splineState.fov;
        camera.updateProjectionMatrix();
        camera.position.set(cx, cy, cz);
        camera.lookAt(targetPos);
      } else if (presetTransitionRef.current.active) {
        const tr = presetTransitionRef.current;
        tr.progress += dt * 1.8;
        if (tr.progress >= 1.0) {
          camera.position.copy(tr.endPos);
          camera.lookAt(tr.endTarget);
          tr.active = false;
        } else {
          const smoothU = tr.progress * tr.progress * (3 - 2 * tr.progress);
          camera.position.lerpVectors(tr.startPos, tr.endPos, smoothU);
          const curTarget = new THREE.Vector3().lerpVectors(tr.startTarget, tr.endTarget, smoothU);
          camera.lookAt(curTarget);
        }
      }

      // 11. Update 3D Geometry for Current Theta
      const xTheta = (currentTheta / (2 * Math.PI)) * L;
      const yTheta = R * sinVal;
      const zTheta = R * cosVal;

      markerHelix.position.set(xTheta, yTheta, zTheta);
      timePivot.position.set(xTheta, 0, 0);
      phasorRod.position.set(xTheta, 0, 0);
      phasorRod.rotation.x = currentTheta;

      floorMarker.position.set(xTheta, Y_FLOOR, zTheta);
      wallMarker.position.set(xTheta, yTheta, Z_WALL);
      floorMarker.visible = projOp > 0.01;
      wallMarker.visible = projOp > 0.01;

      // Drop guide lines
      const floorPoints = new Float32Array([xTheta, yTheta, zTheta, xTheta, Y_FLOOR, zTheta]);
      guideToFloor.geometry.setAttribute('position', new THREE.BufferAttribute(floorPoints, 3));
      guideToFloor.computeLineDistances();
      guideToFloor.visible = projOp > 0.01;

      const wallPoints = new Float32Array([xTheta, yTheta, zTheta, xTheta, yTheta, Z_WALL]);
      guideToWall.geometry.setAttribute('position', new THREE.BufferAttribute(wallPoints, 3));
      guideToWall.computeLineDistances();
      guideToWall.visible = projOp > 0.01;

      const endPoints = new Float32Array([0, yTheta, zTheta, xTheta, yTheta, zTheta]);
      guideToEnd.geometry.setAttribute('position', new THREE.BufferAttribute(endPoints, 3));
      guideToEnd.computeLineDistances();
      guideToEnd.visible = projOp > 0.01;

      // Dynamic Traced Tubes
      const maxSampleIdx = Math.max(2, Math.floor((currentTheta / (2 * Math.PI)) * sampleCount));
      const activeHelixPts = helixCurvePoints.slice(0, maxSampleIdx + 1);
      const activeCosPts = cosCurvePoints.slice(0, maxSampleIdx + 1);
      const activeSinPts = sinCurvePoints.slice(0, maxSampleIdx + 1);

      if (activeHelixPts.length >= 2) {
        tracedHelixMesh.geometry.dispose();
        tracedHelixMesh.geometry = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(activeHelixPts),
          maxSampleIdx,
          0.024,
          6,
          false
        );

        tracedCosMesh.geometry.dispose();
        tracedCosMesh.geometry = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(activeCosPts),
          maxSampleIdx,
          0.022,
          6,
          false
        );
        tracedCosMesh.visible = projOp > 0.01;

        tracedSinMesh.geometry.dispose();
        tracedSinMesh.geometry = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(activeSinPts),
          maxSampleIdx,
          0.022,
          6,
          false
        );
        tracedSinMesh.visible = projOp > 0.01;
      }

      // Render 3D scene (WebGl renders behind the 2D overlay)
      renderer.render(scene, camera);

      // 12. Overlay 2D Canvas: Guide Line Intersection Dots + Phasor Right Triangle + Labels
      if (overlayCtx && overlayCanvasRef.current) {
        const cWidth = overlayCanvasRef.current.width / dpr;
        const cHeight = overlayCanvasRef.current.height / dpr;
        overlayCtx.save();
        overlayCtx.scale(dpr, dpr);
        overlayCtx.clearRect(0, 0, cWidth, cHeight);

        const projectToScreen = (v3: THREE.Vector3) => {
          const proj = v3.clone().project(camera);
          return {
            x: (proj.x * 0.5 + 0.5) * cWidth,
            y: (-proj.y * 0.5 + 0.5) * cHeight,
            inFront: proj.z <= 1.0,
          };
        };

        // --- DRAW INTERSECTION DOTS FOR PI AND 2PI GUIDE LINES (Behind phasor & labels) ---
        // Sine meeting dots: red-tinted (#C0425A), Cosine meeting dots: blue-tinted (#3B5BBF)
        if (projOp > 0.01) {
          if (fadePi > 0.01) {
            const alphaPi = 0.85 * fadePi * projOp;
            // Sine plane meeting point at theta = pi (Im = 0)
            const sinDotPi = projectToScreen(new THREE.Vector3(L / 2, 0, Z_WALL));
            if (sinDotPi.inFront) {
              overlayCtx.beginPath();
              overlayCtx.arc(sinDotPi.x, sinDotPi.y, 3.0, 0, 2 * Math.PI);
              overlayCtx.fillStyle = `rgba(192, 66, 90, ${alphaPi.toFixed(2)})`;
              overlayCtx.fill();
            }

            // Cosine plane meeting point at theta = pi (Re = -1)
            const cosDotPi = projectToScreen(new THREE.Vector3(L / 2, Y_FLOOR, -R));
            if (cosDotPi.inFront) {
              overlayCtx.beginPath();
              overlayCtx.arc(cosDotPi.x, cosDotPi.y, 3.0, 0, 2 * Math.PI);
              overlayCtx.fillStyle = `rgba(59, 91, 191, ${alphaPi.toFixed(2)})`;
              overlayCtx.fill();
            }
          }

          if (fade2Pi > 0.01) {
            const alpha2Pi = 0.85 * fade2Pi * projOp;
            // Sine plane meeting point at theta = 2pi (Im = 0)
            const sinDot2Pi = projectToScreen(new THREE.Vector3(L, 0, Z_WALL));
            if (sinDot2Pi.inFront) {
              overlayCtx.beginPath();
              overlayCtx.arc(sinDot2Pi.x, sinDot2Pi.y, 3.0, 0, 2 * Math.PI);
              overlayCtx.fillStyle = `rgba(192, 66, 90, ${alpha2Pi.toFixed(2)})`;
              overlayCtx.fill();
            }

            // Cosine plane meeting point at theta = 2pi (Re = +1)
            const cosDot2Pi = projectToScreen(new THREE.Vector3(L, Y_FLOOR, R));
            if (cosDot2Pi.inFront) {
              overlayCtx.beginPath();
              overlayCtx.arc(cosDot2Pi.x, cosDot2Pi.y, 3.0, 0, 2 * Math.PI);
              overlayCtx.fillStyle = `rgba(59, 91, 191, ${alpha2Pi.toFixed(2)})`;
              overlayCtx.fill();
            }
          }
        }

        // --- DRAW PHASOR RIGHT TRIANGLE (in unit circle plane at X = 0) ---
        const O_3D = new THREE.Vector3(0, 0, 0);
        const F_3D = new THREE.Vector3(0, 0, R * cosVal);
        const P_3D = new THREE.Vector3(0, R * sinVal, R * cosVal);

        const oScr = projectToScreen(O_3D);
        const fScr = projectToScreen(F_3D);
        const pScr = projectToScreen(P_3D);

        if (oScr.inFront && fScr.inFront && pScr.inFront) {
          // 6. Very faint fill (green at 8% opacity)
          overlayCtx.beginPath();
          overlayCtx.moveTo(oScr.x, oScr.y);
          overlayCtx.lineTo(fScr.x, fScr.y);
          overlayCtx.lineTo(pScr.x, pScr.y);
          overlayCtx.closePath();
          overlayCtx.fillStyle = 'rgba(62, 124, 90, 0.08)';
          overlayCtx.fill();

          // 5. Angle Arc at O (radius 20% of circle radius = 0.20 * R)
          if (currentTheta > 0.03) {
            const arcRadius = 0.20 * R;
            const arcSegments = 32;
            overlayCtx.beginPath();
            for (let i = 0; i <= arcSegments; i++) {
              const a = (i / arcSegments) * currentTheta;
              const pt = projectToScreen(new THREE.Vector3(0, arcRadius * Math.sin(a), arcRadius * Math.cos(a)));
              if (i === 0) overlayCtx.moveTo(pt.x, pt.y);
              else overlayCtx.lineTo(pt.x, pt.y);
            }
            overlayCtx.strokeStyle = '#3E7C5A';
            overlayCtx.lineWidth = 1.5;
            overlayCtx.stroke();
          }

          // 4. Right-Angle Square Marker at F (5% of circle radius, thin dark-gray outline)
          const sqSize = 0.06 * R;
          const sgnCos = Math.sign(cosVal) || 1;
          const sgnSin = Math.sign(sinVal) || 1;
          const degFade = Math.min(1, Math.max(0, (Math.min(Math.abs(sinVal), Math.abs(cosVal)) - 0.02) / 0.12));

          if (degFade > 0.02) {
            const k1 = projectToScreen(new THREE.Vector3(0, 0, R * cosVal - sgnCos * sqSize));
            const k2 = projectToScreen(new THREE.Vector3(0, sgnSin * sqSize, R * cosVal - sgnCos * sqSize));
            const k3 = projectToScreen(new THREE.Vector3(0, sgnSin * sqSize, R * cosVal));

            overlayCtx.beginPath();
            overlayCtx.moveTo(k1.x, k1.y);
            overlayCtx.lineTo(k2.x, k2.y);
            overlayCtx.lineTo(k3.x, k3.y);
            overlayCtx.strokeStyle = `rgba(74, 85, 96, ${(degFade * 0.9).toFixed(2)})`;
            overlayCtx.lineWidth = 1.2;
            overlayCtx.stroke();
          }

          // 2. Adjacent leg (cos θ): thick blue line (3 px, #3B5BBF) along Re from O to F
          overlayCtx.beginPath();
          overlayCtx.moveTo(oScr.x, oScr.y);
          overlayCtx.lineTo(fScr.x, fScr.y);
          overlayCtx.strokeStyle = '#3B5BBF';
          overlayCtx.lineWidth = 3.0;
          overlayCtx.lineCap = 'round';
          overlayCtx.stroke();

          // 3. Opposite leg (sin θ): thick red line (3 px, #C0425A) from F to P
          overlayCtx.beginPath();
          overlayCtx.moveTo(fScr.x, fScr.y);
          overlayCtx.lineTo(pScr.x, pScr.y);
          overlayCtx.strokeStyle = '#C0425A';
          overlayCtx.lineWidth = 3.0;
          overlayCtx.lineCap = 'round';
          overlayCtx.stroke();

          // 1. Hypotenuse: thick green line (4 px, #3E7C5A) from O to P
          overlayCtx.beginPath();
          overlayCtx.moveTo(oScr.x, oScr.y);
          overlayCtx.lineTo(pScr.x, pScr.y);
          overlayCtx.strokeStyle = '#3E7C5A';
          overlayCtx.lineWidth = 4.0;
          overlayCtx.lineCap = 'round';
          overlayCtx.stroke();

          // Round dot at P (radius 4.5px)
          overlayCtx.beginPath();
          overlayCtx.arc(pScr.x, pScr.y, 4.5, 0, 2 * Math.PI);
          overlayCtx.fillStyle = '#3E7C5A';
          overlayCtx.fill();
          overlayCtx.strokeStyle = '#FAF9F6';
          overlayCtx.lineWidth = 1.5;
          overlayCtx.stroke();
        }

        // --- DRAW ONLY THE REQUIRED LABELS WITH COLLISION PASS ---
        const rawLabels: SceneLabelItem[] = [
          // Axis names (priority 3)
          { id: 'ax_re', text: 'Re', pos: new THREE.Vector3(0, 0, R + 0.4), baseSizePct: 0.026, color: '#4A5560', priority: 3, normalDir: { x: 12, y: 0 } },
          { id: 'ax_im', text: 'Im', pos: new THREE.Vector3(0, R + 0.42, 0), baseSizePct: 0.026, color: '#4A5560', priority: 3, normalDir: { x: 0, y: -14 } },
          { id: 'ax_th', text: 'θ', pos: new THREE.Vector3(L + 0.52, 0, 0), baseSizePct: 0.026, color: '#4A5560', priority: 3, normalDir: { x: 14, y: 0 }, minT: 1.2 },

          // Ticks on Re and Im (priority 1)
          { id: 're_1', text: '1', pos: new THREE.Vector3(0, 0, R), baseSizePct: 0.022, color: '#4A5560', priority: 1, normalDir: { x: 10, y: 0 } },
          { id: 're_m1', text: '−1', pos: new THREE.Vector3(0, 0, -R), baseSizePct: 0.022, color: '#4A5560', priority: 1, normalDir: { x: 10, y: 0 } },
          { id: 'im_1', text: '1', pos: new THREE.Vector3(0, R, 0), baseSizePct: 0.022, color: '#4A5560', priority: 1, normalDir: { x: 10, y: 0 } },
          { id: 'im_m1', text: '−1', pos: new THREE.Vector3(0, -R, 0), baseSizePct: 0.022, color: '#4A5560', priority: 1, normalDir: { x: 10, y: 0 } },
          { id: 'orig_0', text: '0', pos: new THREE.Vector3(0, 0, 0), baseSizePct: 0.022, color: '#4A5560', priority: 0, normalDir: { x: -12, y: 12 } },

          // Theta ticks (priority 2)
          { id: 'th_pi', text: 'π', pos: new THREE.Vector3(L / 2, 0, 0), baseSizePct: 0.022, color: '#4A5560', priority: 2, normalDir: { x: 0, y: 14 }, minT: 1.8 },
          { id: 'th_2pi', text: '2π', pos: new THREE.Vector3(L, 0, 0), baseSizePct: 0.022, color: '#4A5560', priority: 2, normalDir: { x: 0, y: 14 }, minT: 1.8 },

          // Curve labels (priority 4, highest)
          { id: 'crv_sin', text: 'sin θ', pos: new THREE.Vector3((0.25) * L, R + 0.15, Z_WALL), baseSizePct: 0.03, color: '#C0425A', priority: 4, normalDir: { x: 0, y: -14 }, minT: 2.2 },
          { id: 'crv_cos', text: 'cos θ', pos: new THREE.Vector3((0.5) * L, Y_FLOOR - 0.15, -R), baseSizePct: 0.03, color: '#3B5BBF', priority: 4, normalDir: { x: 0, y: 14 }, minT: 2.2 },
        ];

        interface PositionedLabel {
          id: string;
          text: string;
          x: number;
          y: number;
          fontSize: number;
          color: string;
          priority: number;
          width: number;
          height: number;
          opacity: number;
        }

        const candidateLabels: PositionedLabel[] = [];

        rawLabels.forEach((lbl) => {
          if (lbl.minT !== undefined && T < lbl.minT) return;

          const proj = projectToScreen(lbl.pos);
          if (!proj.inFront) return;

          const rawSize = Math.max(12, lbl.baseSizePct * cWidth) * currentZoom;
          const fontSize = Math.min(48, Math.max(0, rawSize));
          if (fontSize < 7.0) return;

          const offsetX = lbl.normalDir.x * currentZoom;
          const offsetY = lbl.normalDir.y * currentZoom;
          const lx = proj.x + offsetX;
          const ly = proj.y + offsetY;

          overlayCtx.font = `500 ${fontSize.toFixed(1)}px Inter, system-ui, sans-serif`;
          const metrics = overlayCtx.measureText(lbl.text);
          const tw = metrics.width;
          const th = fontSize;

          let fadeOpacity = 1.0;
          if (lbl.minT !== undefined) {
            fadeOpacity = Math.min(1.0, Math.max(0.0, (T - lbl.minT) / 0.8));
          }

          candidateLabels.push({
            id: lbl.id,
            text: lbl.text,
            x: lx,
            y: ly,
            fontSize,
            color: lbl.color,
            priority: lbl.priority,
            width: tw + 8,
            height: th + 8,
            opacity: fadeOpacity,
          });
        });

        // Collision pass
        candidateLabels.sort((a, b) => b.priority - a.priority);
        const resolvedLabels: PositionedLabel[] = [];

        for (const label of candidateLabels) {
          let hasOverlap = false;
          let shiftY = 0;

          for (const placed of resolvedLabels) {
            const overlapX = Math.abs(label.x - placed.x) < (label.width + placed.width) / 2;
            const overlapY = Math.abs((label.y + shiftY) - placed.y) < (label.height + placed.height) / 2;

            if (overlapX && overlapY) {
              shiftY = (label.y < placed.y ? -18 : 18) * currentZoom;
              const recheckY = Math.abs((label.y + shiftY) - placed.y) < (label.height + placed.height) / 2;
              if (recheckY) {
                hasOverlap = true;
                break;
              }
            }
          }

          if (!hasOverlap) {
            resolvedLabels.push({ ...label, y: label.y + shiftY });
          }
        }

        // Draw resolved labels with halo
        resolvedLabels.forEach((lbl) => {
          overlayCtx.save();
          overlayCtx.globalAlpha = lbl.opacity;
          overlayCtx.font = `500 ${lbl.fontSize.toFixed(1)}px Inter, system-ui, sans-serif`;
          overlayCtx.textAlign = 'center';
          overlayCtx.textBaseline = 'middle';

          overlayCtx.strokeStyle = '#FAF9F6';
          overlayCtx.lineWidth = 3.5;
          overlayCtx.lineJoin = 'round';
          overlayCtx.strokeText(lbl.text, lbl.x, lbl.y);

          overlayCtx.fillStyle = lbl.color;
          overlayCtx.fillText(lbl.text, lbl.x, lbl.y);
          overlayCtx.restore();
        });

        overlayCtx.restore();
      }

      // 13. Throttle state updates for live text readout (~10 Hz)
      if (currentTimestamp - lastReadoutTime > 100) {
        lastReadoutTime = currentTimestamp;
        setReadout({
          T,
          theta: currentTheta,
          cosVal,
          sinVal,
          isHoldEnd: T >= 7.5,
        });
        setZoomDisplay(currentZoom);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    // 14. Cleanup on unmount
    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.clear();
      threeRefs.current = null;
    };
  }, [activePreset]);

  // Non-passive wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * -0.0018;
      targetZoomRef.current = Math.max(0.4, Math.min(3.0, targetZoomRef.current + zoomDelta));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Pointer drag event handlers for user orbit offset
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastInteractionTimeRef.current = performance.now();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastInteractionTimeRef.current = performance.now();

    orbitOffsetRef.current.azimuth -= dx * 0.35;
    orbitOffsetRef.current.elevation += dy * 0.3;
    orbitOffsetRef.current.elevation = Math.max(-80, Math.min(80, orbitOffsetRef.current.elevation));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    lastInteractionTimeRef.current = performance.now();
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Zoom control helpers
  const handleZoomIn = useCallback(() => {
    targetZoomRef.current = Math.min(3.0, targetZoomRef.current * 1.25);
  }, []);

  const handleZoomOut = useCallback(() => {
    targetZoomRef.current = Math.max(0.4, targetZoomRef.current / 1.25);
  }, []);

  const handleFit = useCallback(() => {
    targetZoomRef.current = 1.0;
  }, []);

  const handleReplay = useCallback(() => {
    masterTimeRef.current = 0.0;
    orbitOffsetRef.current = { azimuth: 0, elevation: 0 };
    targetZoomRef.current = 1.0;
    setActivePreset('scripted');
    setIsPlaying(true);
  }, []);

  const handlePresetSelect = (preset: 'scripted' | 'real' | 'imag' | 'phasor') => {
    setActivePreset(preset);
    if (!threeRefs.current) return;
    const { camera } = threeRefs.current;

    if (preset === 'scripted') {
      masterTimeRef.current = 0.0;
      orbitOffsetRef.current = { azimuth: 0, elevation: 0 };
      targetZoomRef.current = 1.0;
      setIsPlaying(true);
      return;
    }

    let endPos = new THREE.Vector3();
    let endTarget = new THREE.Vector3(L / 2, 0, 0);

    if (preset === 'real') {
      endPos.set(L / 2, 6.8, 0.001);
    } else if (preset === 'imag') {
      endPos.set(L / 2, 0.001, 6.8);
    } else if (preset === 'phasor') {
      endPos.set(-5.8, 0, 0);
      endTarget.set(0, 0, 0);
    }

    presetTransitionRef.current = {
      active: true,
      startPos: camera.position.clone(),
      startTarget: new THREE.Vector3(L / 2, 0, 0),
      endPos,
      endTarget,
      progress: 0,
    };
  };

  return (
    <div className="bg-[#FAF9F6] rounded-[14px] p-5 shadow-sm border border-[#E5E7EB] transition-colors select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center text-[#3E7C5A]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-[#1F2937]">
              Complex Exponential 3D Explainer &bull; <span className="font-mono text-[#3E7C5A]">e^{`{iθ}`} = cos θ + i·sin θ</span>
            </span>
            <p className="text-xs text-[#6B7280]">
              2D phasor diagram transforms into a full 3D helical space curve and lands on e^{`{iπ}`} + 1 = 0
            </p>
          </div>
        </div>

        {/* Live Coordinate Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-white border border-[#E5E7EB] text-[#4B5563]">
            T = {readout.T.toFixed(1)}s &bull; θ = {(readout.theta * (180 / Math.PI)).toFixed(0)}° ({(readout.theta / Math.PI).toFixed(2)}π)
          </span>
          <span className="px-2.5 py-1 rounded-md bg-white border border-[#E5E7EB] text-[#1F2937] font-semibold">
            cos θ = {readout.cosVal.toFixed(2)} &bull; sin θ = {readout.sinVal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Toolbar: Camera Views, Projections Toggle & Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-[#4B5563] mr-1">Camera View:</span>
          <button
            type="button"
            onClick={() => handlePresetSelect('scripted')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activePreset === 'scripted'
                ? 'bg-[#3E7C5A] text-white shadow-xs'
                : 'bg-white hover:bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]'
            }`}
          >
            3D Isometric
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('real')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activePreset === 'real'
                ? 'bg-[#3B5BBF] text-white shadow-xs'
                : 'bg-white hover:bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]'
            }`}
          >
            Real Proj. (Cos)
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('imag')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activePreset === 'imag'
                ? 'bg-[#C0425A] text-white shadow-xs'
                : 'bg-white hover:bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]'
            }`}
          >
            Imag Proj. (Sin)
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('phasor')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              activePreset === 'phasor'
                ? 'bg-[#1F2937] text-white shadow-xs'
                : 'bg-white hover:bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]'
            }`}
          >
            Phasor Circle
          </button>
        </div>

        {/* Projections Toggle & Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowProjections(!showProjections)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
              showProjections
                ? 'bg-[#E5E7EB] text-[#1F2937]'
                : 'bg-white text-[#9CA3AF] border border-[#E5E7EB]'
            }`}
            title="Toggle projection planes, drop lines and guide lines"
          >
            <Layers className="w-3.5 h-3.5 text-[#3E7C5A]" />
            {showProjections ? 'Projections On' : 'Projections Hidden'}
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-xs bg-white hover:bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB]"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-xs bg-white hover:bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB]"
            title="Replay from T = 0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#3E7C5A]" />
            Replay
          </button>

          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#4B5563] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB]"
            title="Reset to initial scripted view"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* 3D WebGL Viewport with 2D Overlay Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-full h-[470px] min-h-[380px] rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#FAF9F6] cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <canvas ref={canvasRef} className="w-full h-full block outline-none" />
        <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* FIXED UI OVERLAY: Top Center Equation (Colors: e^{iθ} green, cos θ blue, i·sin θ red) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="px-3.5 py-1 rounded-full bg-white/92 border border-[#E5E7EB] shadow-xs backdrop-blur-xs flex items-center gap-1.5 text-xs font-mono font-medium text-[#4B5560]">
            <span className="text-[#3E7C5A] font-bold">e^{`{iθ}`}</span>
            <span>=</span>
            <span className="text-[#3B5BBF] font-bold">cos θ</span>
            <span>+</span>
            <span className="text-[#C0425A] font-bold">i·sin θ</span>
          </div>
        </div>

        {/* FIXED UI OVERLAY: Bottom Center Euler Identity (fades in during final hold T >= 7.5s) */}
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-10 transition-opacity duration-700 ${
            readout.isHoldEnd ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="px-3.5 py-1 rounded-full bg-white/95 border border-[#3E7C5A]/40 shadow-xs backdrop-blur-xs flex items-center gap-2 text-xs font-mono font-bold text-[#1F2937]">
            <span className="text-[#3E7C5A]">e^{`{iπ}`}</span>
            <span>+ 1 = 0</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3E7C5A]/10 text-[#3E7C5A] font-sans font-medium">
              Euler's Identity
            </span>
          </div>
        </div>

        {/* Zoom Controls Pill (Top-Right of Viewport) */}
        <div className="absolute top-2.5 right-3 flex items-center gap-1 bg-white/92 border border-[#E5E7EB] px-1.5 py-1 rounded-lg shadow-xs backdrop-blur-xs z-10">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[#4B5563] transition-colors"
            title="Zoom Out (−)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] font-bold text-[#3E7C5A] min-w-[34px] text-center">
            {zoomDisplay.toFixed(1)}&times;
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[#4B5563] transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFit}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[#4B5563] transition-colors"
            title="Fit to 1.0x"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        {/* Viewport Hints (Top-Left) */}
        <div className="absolute top-2.5 left-3 pointer-events-none flex items-center gap-2 text-[11px] font-mono text-[#6B7280] bg-white/90 px-2.5 py-1 rounded-md border border-[#E5E7EB] shadow-xs">
          <span>Unit Circle r = 1</span>
          <span>&bull;</span>
          <span>0 &le; θ &le; 2π</span>
        </div>
      </div>

      {/* Scrubber Bar Below Viewport */}
      <div className="mt-3 flex items-center gap-3 bg-white border border-[#E5E7EB] px-3.5 py-2 rounded-xl text-xs">
        <span className="font-mono text-[#4B5560] whitespace-nowrap font-medium min-w-[45px]">
          {readout.T.toFixed(1)}s
        </span>
        <input
          type="range"
          min="0"
          max="10"
          step="0.05"
          value={readout.T}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            masterTimeRef.current = val;
            setIsPlaying(false);
          }}
          className="flex-1 accent-[#3E7C5A] cursor-pointer h-1.5 bg-[#E5E7EB] rounded-lg"
        />
        <span className="font-mono text-[#6B7280] whitespace-nowrap">10.0s loop</span>
      </div>

      {/* Legend & Educational Guidance */}
      <div className="flex flex-wrap items-center justify-between text-xs mt-3 pt-3 border-t border-[#E5E7EB] gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: '#3E7C5A' }} />
            <span className="text-[#374151] font-medium">3D Helix: e^{`{iθ}`} (#3E7C5A)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: '#3B5BBF' }} />
            <span className="text-[#374151] font-medium">Floor Projection: cos θ (#3B5BBF)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded" style={{ backgroundColor: '#C0425A' }} />
            <span className="text-[#374151] font-medium">Wall Projection: sin θ (#C0425A)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-[#3E7C5A] bg-[#FFF6B0]" />
            <span className="text-[#374151] font-medium">Moving Phasor Tip P</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-t border-dashed border-[#9AA5B1]" />
            <span className="text-[#6B7280]">π &amp; 2π Guides (#9AA5B1)</span>
          </div>
        </div>

        <span className="font-mono text-xs text-[#3E7C5A] font-semibold">
          Smooth 2D Phasor &rarr; 3D Space Curve &rarr; e^{`{iπ}`} + 1 = 0
        </span>
      </div>
    </div>
  );
};
