import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * EarthGlobe — Photorealistic 3D Earth Globe matching the Figma visual reference
 * Features:
 * - NASA Blue Marble daytime terrain
 * - Deep dark night-side with golden city lights
 * - Natural cloud layer
 * - Delicate atmospheric Rayleigh limb glow
 * - India facing forward
 * - Exactly ONE Google Maps-style location pin in #C96A4A over India
 */
export default function EarthGlobe({ onPinClick }) {
  const mountRef = useRef(null);
  const [pinPosition, setPinPosition] = useState({ x: 0, y: 0, visible: false });
  const [pinReady, setPinReady] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth;
    let height = container.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0, 4.3);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.appendChild(renderer.domElement);

    // 3. Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    globeGroup.scale.set(0.9, 0.9, 0.9);
    const radius = 1.34;

    // 4. Custom Day/Night Earth Shader Material
    const textureLoader = new THREE.TextureLoader();
    const dayMap = textureLoader.load('/textures/earth_day.jpg');
    const nightMap = textureLoader.load('/textures/earth_lights.png');
    const specularMap = textureLoader.load('/textures/earth_specular.jpg');
    const cloudsMap = textureLoader.load('/textures/earth_clouds.png');

    // Sun light direction (shining from the right)
    const sunDirection = new THREE.Vector3(1.2, 0.25, 0.75).normalize();

    const earthShader = {
      uniforms: {
        dayTexture: { value: dayMap },
        nightTexture: { value: nightMap },
        specularTexture: { value: specularMap },
        sunDirection: { value: sunDirection },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vSunDir;
        varying vec3 vViewDir;

        uniform vec3 sunDirection;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vSunDir = normalize((viewMatrix * vec4(sunDirection, 0.0)).xyz);
          vViewDir = normalize(- (modelViewMatrix * vec4(position, 1.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform sampler2D specularTexture;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vSunDir;
        varying vec3 vViewDir;

        void main() {
          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          vec3 nightColor = texture2D(nightTexture, vUv).rgb;
          float specular = texture2D(specularTexture, vUv).r;

          float NdotL = dot(vNormal, vSunDir);
          
          // Smooth day/night terminator transition
          float dayWeight = smoothstep(-0.08, 0.18, NdotL);
          
          // Sunlight direct illumination with subtle ambient
          vec3 litDay = dayColor * (0.05 + 1.05 * max(0.0, NdotL));
          
          // Specular reflection on water
          vec3 halfVec = normalize(vSunDir + vViewDir);
          float specIntensity = pow(max(0.0, dot(vNormal, halfVec)), 28.0) * specular * 0.45;
          litDay += vec3(0.85, 0.95, 1.0) * specIntensity;

          // Night city lights (crisp golden lights against deep dark space)
          vec3 litNight = nightColor * 2.2 * (1.0 - dayWeight);

          // Atmospheric rim Fresnel glow
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 3.2);
          vec3 rimColor = vec3(0.22, 0.52, 0.88) * fresnel * 0.48 * (0.2 + 0.8 * dayWeight);

          vec3 finalColor = mix(litNight, litDay, dayWeight) + rimColor;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    };

    const earthGeometry = new THREE.SphereGeometry(radius, 64, 64);
    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: earthShader.uniforms,
      vertexShader: earthShader.vertexShader,
      fragmentShader: earthShader.fragmentShader,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    globeGroup.add(earthMesh);

    // 5. Cloud Layer
    const cloudsGeometry = new THREE.SphereGeometry(radius * 1.012, 64, 64);
    const cloudsMaterial = new THREE.MeshStandardMaterial({
      map: cloudsMap,
      transparent: true,
      opacity: 0.32,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    globeGroup.add(cloudsMesh);

    // 6. Atmospheric Glow Layer (Fresnel Shell)
    const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.052, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.22, 0.55, 0.92, 1.0) * intensity * 0.65;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // 7. Ambient + Directional lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
    dirLight.position.copy(sunDirection.clone().multiplyScalar(10));
    scene.add(dirLight);

    // 8. India Coordinates (Lat: 19.5° N, Lon: 74.0° E - Western India / Maharashtra)
    const indiaLat = 19.5;
    const indiaLon = 74.0;
    const phi = (90 - indiaLat) * (Math.PI / 180);
    const theta = (indiaLon + 180) * (Math.PI / 180);

    const indiaLocalPos = new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );

    // Target rotation to bring India into the exact position shown in Figma
    const baseRotY = - (indiaLon * Math.PI / 180) - Math.PI / 2 + 0.32;
    const baseRotX = 0.28;

    globeGroup.rotation.y = baseRotY;
    globeGroup.rotation.x = baseRotX;

    setTimeout(() => setPinReady(true), 350);

    // 9. Interactive Drag / Rotate logic
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotVelX = 0;
    let rotVelY = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      globeGroup.rotation.y += deltaX * 0.005;
      globeGroup.rotation.x += deltaY * 0.005;
      globeGroup.rotation.x = Math.max(-0.6, Math.min(0.6, globeGroup.rotation.x));

      rotVelY = deltaX * 0.005;
      rotVelX = deltaY * 0.005;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 10. Animation Loop & Pin Projection
    let animationFrameId;
    let startTime = performance.now();
    const tempVec = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) / 1000;

      // Smooth emergence scale on initial load
      if (globeGroup.scale.x < 1.0) {
        const newScale = THREE.MathUtils.lerp(globeGroup.scale.x, 1.0, 0.05);
        globeGroup.scale.set(newScale, newScale, newScale);
      }

      // Subtle slow cloud drift
      cloudsMesh.rotation.y += 0.00028;

      // Gentle damping on drag velocity
      if (!isDragging) {
        rotVelX *= 0.92;
        rotVelY *= 0.92;
        globeGroup.rotation.y += rotVelY;
        globeGroup.rotation.x += rotVelX;

        // Subtle idle breathing sway
        globeGroup.rotation.y += Math.sin(elapsed * 0.35) * 0.00012;
      }

      // Calculate India screen position for the 2D SVG Pin
      tempVec.copy(indiaLocalPos);
      tempVec.applyMatrix4(globeGroup.matrixWorld);

      // Check if India is facing the camera (Z positive)
      const isFacing = tempVec.z > 0.05;

      tempVec.project(camera);

      // Convert normalized device coordinates (-1 to +1) to screen pixels
      const x = ((tempVec.x + 1) * width) / 2;
      const y = ((-tempVec.y + 1) * height) / 2;

      setPinPosition({
        x,
        y,
        visible: isFacing,
      });

      // Keep atmosphere shell aligned with globe group position
      atmosphereMesh.position.copy(globeGroup.position);

      renderer.render(scene, camera);
    };

    animate();

    // 11. Responsive Resize
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      earthGeometry.dispose();
      cloudsGeometry.dispose();
      atmosphereGeometry.dispose();
      earthMaterial.dispose();
      cloudsMaterial.dispose();
      atmosphereMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full select-none cursor-grab active:cursor-grabbing">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Exactly ONE India Location Pin in #C96A4A */}
      {pinPosition.visible && (
        <div
          onClick={onPinClick}
          style={{
            position: 'absolute',
            left: `${pinPosition.x}px`,
            top: `${pinPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'auto',
            cursor: 'pointer',
            transition: 'opacity 0.4s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            opacity: pinReady ? 1 : 0,
            transformOrigin: 'bottom center',
          }}
          className="group"
          title="India — PJMT National Air Quality Surveillance"
        >
          {/* Beacon Pulse Ring */}
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: 'rgba(201, 106, 74, 0.45)',
              boxShadow: '0 0 10px rgba(201, 106, 74, 0.65)',
            }}
            className="pin-pulse-ring pointer-events-none"
          />

          {/* Google Maps-style Pin SVG in #C96A4A */}
          <div className="relative transition-transform duration-200 group-hover:scale-115">
            <svg
              width="26"
              height="34"
              viewBox="0 0 30 38"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.65))' }}
            >
              {/* Outer Teardrop Shape */}
              <path
                d="M15 0C6.71573 0 0 6.71573 0 15C0 24.5 15 38 15 38C15 38 30 24.5 30 15C30 6.71573 23.2843 0 15 0Z"
                fill="#C96A4A"
              />
              {/* Subtle inner depth border */}
              <path
                d="M15 1C7.26801 1 1 7.26801 1 15C1 23.8 14.5 36.5 15 36.9C15.5 36.5 29 23.8 29 15C29 7.26801 22.732 1 15 1Z"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="1"
              />
              {/* Inner White Dot */}
              <circle cx="15" cy="14" r="5" fill="#FFFFFF" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
