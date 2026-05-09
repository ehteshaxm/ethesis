"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function BgParticles() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let W = Math.max(2, mount.clientWidth);
    let H = Math.max(2, mount.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, W / H, 1, 10000);
    camera.position.z = 480;

    const COUNT = 40000;
    const RADIUS = 900;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const offsets = new Float32Array(COUNT);

    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      v.set(
        Math.cos(angle) * s * RADIUS,
        Math.sin(angle) * s * RADIUS,
        u * RADIUS,
      );
      positions[i * 3 + 0] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      const hue = 0.32 + (i / COUNT) * 0.18;
      c.setHSL(hue, 0.72, 0.62);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      offsets[i] = i / COUNT;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 1));

    const vert = `
      attribute float aOffset;
      uniform float uTime;
      uniform float uSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float localTime = aOffset + uTime * 0.10;
        float modT = mod(localTime, 1.0);
        float accT = modT * modT;

        float angle = accT * 40.0;
        vec2 pulse = vec2(sin(angle), cos(angle)) * 20.0;

        vec3 p = position;
        p.x = p.x * accT + pulse.x;
        p.y = p.y * accT + pulse.y;
        p.z = p.z * accT * 1.75;

        float rot = uTime * 0.001;
        float cR = cos(rot), sR = sin(rot);
        vec3 r = vec3(p.x * cR - p.y * sR, p.x * sR + p.y * cR, p.z);

        vec4 mv = modelViewMatrix * vec4(r, 1.0);
        gl_Position = projectionMatrix * mv;

        vAlpha = clamp((1.0 - modT) * 2.0, 0.0, 1.0);
        vColor = color;

        gl_PointSize = uSize * (300.0 / -mv.z);
      }
    `;
    const frag = `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r2 = dot(d, d);
        if (r2 > 0.25) discard;
        float falloff = smoothstep(0.25, 0.0, r2);
        gl_FragColor = vec4(vColor, vAlpha * falloff);
      }
    `;

    const uniforms = {
      uTime: { value: 0 },
      uSize: { value: 3.4 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const rtParams = {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    } as const;
    const sized = () => ({
      w: Math.max(2, Math.floor(W * renderer.getPixelRatio())),
      h: Math.max(2, Math.floor(H * renderer.getPixelRatio())),
    });
    let { w: rtW, h: rtH } = sized();
    const rtA = new THREE.WebGLRenderTarget(rtW, rtH, rtParams);
    const rtB = new THREE.WebGLRenderTarget(rtW, rtH, rtParams);
    const rtTmp = new THREE.WebGLRenderTarget(rtW, rtH, rtParams);

    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const blendMat = new THREE.ShaderMaterial({
      uniforms: {
        tPrev: { value: null as THREE.Texture | null },
        tCurr: { value: null as THREE.Texture | null },
        uDamp: { value: 0.86 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tPrev;
        uniform sampler2D tCurr;
        uniform float uDamp;
        varying vec2 vUv;
        void main() {
          vec4 prev = texture2D(tPrev, vUv) * uDamp;
          vec4 curr = texture2D(tCurr, vUv);
          gl_FragColor = max(prev, curr);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const blendMesh = new THREE.Mesh(quadGeo, blendMat);
    quadScene.add(blendMesh);

    const copyMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null as THREE.Texture | null } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tSrc;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(tSrc, vUv); }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const onResize = () => {
      W = Math.max(2, mount.clientWidth);
      H = Math.max(2, mount.clientHeight);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
      const s = sized();
      rtA.setSize(s.w, s.h);
      rtB.setSize(s.w, s.h);
      rtTmp.setSize(s.w, s.h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;

      renderer.setRenderTarget(rtA);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      blendMat.uniforms.tPrev.value = rtB.texture;
      blendMat.uniforms.tCurr.value = rtA.texture;
      blendMesh.material = blendMat;
      renderer.setRenderTarget(rtTmp);
      renderer.clear(true, true, true);
      renderer.render(quadScene, quadCam);

      copyMat.uniforms.tSrc.value = rtTmp.texture;
      blendMesh.material = copyMat;
      renderer.setRenderTarget(rtB);
      renderer.clear(true, true, true);
      renderer.render(quadScene, quadCam);

      copyMat.uniforms.tSrc.value = rtB.texture;
      blendMesh.material = copyMat;
      renderer.setRenderTarget(null);
      renderer.clear(true, true, true);
      renderer.render(quadScene, quadCam);

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      blendMat.dispose();
      copyMat.dispose();
      quadGeo.dispose();
      rtA.dispose();
      rtB.dispose();
      rtTmp.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.85,
      }}
    />
  );
}
