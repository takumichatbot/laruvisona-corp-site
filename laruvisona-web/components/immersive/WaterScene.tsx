"use client";

import { useEffect, useRef } from "react";
import { MARK } from "@/components/company/mark";

// Geometry, light and camera are rendered in WebGL. No video or remote texture.
const vertexShader = `
  uniform float uTime;
  uniform float uFlow;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormal;
  vec3 deform(vec3 p,vec3 n){
    float wave=sin(p.y*3.1+uTime*.47)*cos(p.z*2.6-uTime*.31);
    wave+=.48*sin(p.x*4.0-p.y*2.0+uTime*.38);
    p+=n*wave*.085*uFlow;
    p.x+=.055*sin(p.y*2.4+uTime*.32)*uFlow;
    return p;
  }
  void main(){
    vec3 p=deform(position,normal);
    vec3 tangent=normalize(cross(normal,abs(normal.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.)));
    vec3 bitangent=cross(normal,tangent);
    vec3 pt=deform(position+tangent*.005,normal);
    vec3 pb=deform(position+bitangent*.005,normal);
    vNormal=normalize(mat3(modelMatrix)*cross(pt-p,pb-p));
    vLocal=p;
    vec4 world=modelMatrix*vec4(p,1.);
    vWorld=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;
const fragmentShader = `
  precision highp float;
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormal;
  vec3 environment(vec3 r){
    vec3 c=mix(vec3(.001,.004,.008),vec3(.025,.065,.10),smoothstep(-.65,.95,r.y));
    float a=exp(-pow((r.x*.72+r.y*.56-.28)*18.,2.))*smoothstep(-.55,.5,r.z);
    float b=exp(-pow((r.x*.62-r.y*.74+.40)*32.,2.));
    float d=pow(max(0.,dot(r,normalize(vec3(-.7,.5,.8)))),26.);
    c+=vec3(.74,1.10,1.24)*a*1.7;
    c+=vec3(.23,.51,.85)*b*.85;
    c+=vec3(.96,1.0,1.0)*d*2.6;
    c+=vec3(.14,.30,.38)*exp(-pow((r.x*.7+r.y*.55+.02)*42.,2.));
    return c;
  }
  void main(){
    vec3 n=normalize(vNormal);
    if(!gl_FrontFacing)n=-n;
    vec3 v=normalize(cameraPosition-vWorld);
    float facing=max(0.,dot(n,v));
    float fresnel=.025+.975*pow(1.-facing,4.);
    vec3 refl=environment(reflect(-v,n));
    vec3 refr=environment(refract(-v,n,.75));
    // Water absorbs long wavelengths; a second interface adds the inner light edge.
    vec3 inner=environment(reflect(refract(-v,n,.75),-n));
    vec3 col=mix(refr*vec3(.30,.76,.88)+inner*.22,refl,fresnel*.86+.20);
    float rim=pow(1.-facing,10.);
    col+=vec3(.37,.80,1.)*rim*.85;
    float caustic=pow(.5+.5*sin(vLocal.y*8.+vLocal.x*3.+uTime*.26),18.);
    col+=vec3(.13,.32,.41)*caustic*.18*(1.-facing);
    col=pow(col,vec3(.8));
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function WaterScene({
  paused,
  reduced,
}: {
  paused: boolean;
  reduced: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const control = useRef({ paused, reduced });
  useEffect(() => {
    control.current = { paused, reduced };
    window.dispatchEvent(new Event("lv:water-control"));
  }, [paused, reduced]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const el: HTMLDivElement = container;
    let disposed = false;
    let cleanup = () => {};
    import("three")
      .then((T) => {
        if (disposed) return;
        let renderer: InstanceType<typeof T.WebGLRenderer>;
        try {
          renderer = new T.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
          });
        } catch {
          el.dataset.render = "fallback";
          return;
        }
        const mobile = () => window.innerWidth < 760;
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio, mobile() ? 1.4 : 1.7),
        );
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.setClearColor(0x030b12, 0);
        el.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(35, 1, 0.1, 50);
        camera.position.z = 10;
        const uniforms = { uTime: { value: 0 }, uFlow: { value: 1 } };
        const material = new T.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms,
          side: T.DoubleSide,
        });
        const sphere = new T.SphereGeometry(
          1,
          mobile() ? 64 : 96,
          mobile() ? 48 : 64,
        );
        const ringGeometry = new T.TorusGeometry(1.26, 0.43, 56, 128);
        const hero = new T.Group();
        const ring = new T.Mesh(ringGeometry, material);
        ring.rotation.set(0.4, -0.3, -0.4);
        hero.add(ring);
        const satellites = Array.from({ length: 4 }, () => {
          const mesh = new T.Mesh(sphere, material);
          hero.add(mesh);
          return mesh;
        });
        scene.add(hero);
        const closing = new T.Group();
        const drops = MARK.map(([x, y, r], i) => {
          const mesh = new T.Mesh(sphere, material);
          mesh.scale.setScalar(r / 310);
          closing.add(mesh);
          return {
            mesh,
            target: new T.Vector3((x - 440) / 235, (450 - y) / 235, 0),
            start: new T.Vector3(
              Math.sin(i * 2.4) * 3.8,
              Math.cos(i * 1.8) * 2.5,
              Math.sin(i * 3.1) * 2,
            ),
          };
        });
        scene.add(closing);
        let raf = 0,
          previous = 0,
          time = 1.7,
          visible = true,
          contextAvailable = true;
        let pointerX = 0,
          pointerY = 0,
          px = 0,
          py = 0;
        let heroVisible = true,
          closingVisible = false,
          closingProgress = 0,
          heroProgress = 0;
        const opening = document.getElementById("lv-opening");
        const ending = document.getElementById("lv-contact");
        function measure() {
          const h = window.innerHeight;
          const a = opening?.getBoundingClientRect();
          const b = ending?.getBoundingClientRect();
          heroVisible = !!a && a.bottom > 0 && a.top < h;
          closingVisible = !!b && b.bottom > 0 && b.top < h;
          if (!control.current.paused) {
            heroProgress = a ? Math.max(0, Math.min(1, -a.top / h)) : 0;
            // Entry progression also works for sections shorter than the viewport.
            closingProgress = b
              ? Math.max(0, Math.min(1, (h * 0.95 - b.top) / (h * 0.85)))
              : 0;
          }
        }
        function draw(now: number) {
          raf = 0;
          if (disposed || !visible || !contextAvailable) return;
          const moving = !control.current.paused;
          const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 0;
          previous = now;
          if (moving) {
            time += dt;
            px += (pointerX - px) * 0.035;
            py += (pointerY - py) * 0.035;
          }
          uniforms.uTime.value = time;
          uniforms.uFlow.value = control.current.reduced ? 0.4 : 1;
          const small = mobile();
          hero.visible = heroVisible && !closingVisible;
          closing.visible = closingVisible;
          hero.position.set(
            small ? 0.65 : 2.0,
            (small ? 0.35 : 0.12) + heroProgress * 0.8,
            -heroProgress * 0.65,
          );
          hero.scale.setScalar(small ? 1.13 : 1.4);
          ring.rotation.set(
            0.46 + Math.sin(time * 0.25) * 0.18 + py * 0.12,
            -0.28 +
              Math.sin(time * 0.22) * 0.3 +
              px * 0.2 +
              heroProgress * 0.85,
            -0.43 + heroProgress * 0.35,
          );
          ring.scale.setScalar(1 - heroProgress * 0.38);
          satellites.forEach((mesh, i) => {
            const phase = i * Math.PI * 0.5 - 0.5;
            const orbit = 1.75 - heroProgress * 0.48;
            mesh.position.set(
              Math.cos(phase) * orbit,
              Math.sin(phase) * orbit + Math.sin(time * 0.38 + i) * 0.05,
              Math.sin(phase) * 0.35,
            );
            mesh.scale.setScalar((i === 0 ? 0.1 : 0.018) + heroProgress * 0.24);
          });
          const p = control.current.reduced ? 1 : closingProgress;
          const eased = p * p * (3 - 2 * p);
          closing.position.set(small ? 0.7 : 2.9, small ? 0.52 : 0.25, 0);
          closing.scale.setScalar(small ? 0.7 : 1.05);
          drops.forEach(({ mesh, target, start }, i) => {
            mesh.position.lerpVectors(start, target, eased);
            mesh.position.z += Math.sin(time * 0.4 + i) * 0.07 * (1 - eased);
          });
          renderer.render(scene, camera);
          el.dataset.render = "webgl";
          el.dataset.time = time.toFixed(3);
          el.dataset.logoProgress = p.toFixed(3);
          if (moving && (heroVisible || closingVisible))
            raf = requestAnimationFrame(draw);
        }
        function wake() {
          if (!raf && visible && contextAvailable)
            raf = requestAnimationFrame(draw);
        }
        function scroll() {
          measure();
          wake();
        }
        function resize() {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
          measure();
          wake();
        }
        function pointer(e: PointerEvent) {
          pointerX = (e.clientX / window.innerWidth) * 2 - 1;
          pointerY = (e.clientY / window.innerHeight) * 2 - 1;
        }
        function visibility() {
          visible = !document.hidden;
          previous = 0;
          if (!visible) {
            cancelAnimationFrame(raf);
            raf = 0;
          } else {
            measure();
            wake();
          }
        }
        function onControl() {
          previous = 0;
          measure();
          wake();
        }
        function lost(e: Event) {
          e.preventDefault();
          contextAvailable = false;
          cancelAnimationFrame(raf);
          raf = 0;
          el.dataset.render = "fallback";
        }
        function restored() {
          contextAvailable = true;
          previous = 0;
          resize();
        }
        window.addEventListener("scroll", scroll, { passive: true });
        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", pointer, { passive: true });
        window.addEventListener("lv:water-control", onControl);
        document.addEventListener("visibilitychange", visibility);
        renderer.domElement.addEventListener("webglcontextlost", lost);
        renderer.domElement.addEventListener("webglcontextrestored", restored);
        resize();
        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("scroll", scroll);
          window.removeEventListener("resize", resize);
          window.removeEventListener("pointermove", pointer);
          window.removeEventListener("lv:water-control", onControl);
          document.removeEventListener("visibilitychange", visibility);
          renderer.domElement.removeEventListener("webglcontextlost", lost);
          renderer.domElement.removeEventListener(
            "webglcontextrestored",
            restored,
          );
          sphere.dispose();
          ringGeometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        el.dataset.render = "fallback";
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  return (
    <div
      ref={host}
      className="lv-water-canvas"
      aria-hidden="true"
      data-render="loading"
    >
      <div className="lv-water-poster" />
    </div>
  );
}
