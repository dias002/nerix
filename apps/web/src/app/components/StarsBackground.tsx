import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  depth: number;
  phase: number;
};

type Meteor = {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  angle: number;
};

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(0);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let stars: Star[] = [];
    const meteors: Meteor[] = [];

    const createStars = () => {
      const count = Math.round(Math.min(520, Math.max(260, width * height / 4200)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * (height + 260) - 130,
        radius: Math.random() * 1.35 + 0.15,
        opacity: Math.random() * 0.75 + 0.2,
        depth: Math.random() * 0.85 + 0.15,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const setCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      createStars();
    };

    const updateScroll = () => {
      scrollRef.current = window.scrollY;
    };

    const updatePointer = (event: PointerEvent) => {
      pointerRef.current = {
        x: event.clientX / width,
        y: event.clientY / height,
      };
    };

    const spawnMeteor = () => {
      if (meteors.length < 3 && Math.random() > 0.992) {
        meteors.push({
          x: width * (0.45 + Math.random() * 0.7),
          y: -80 + Math.random() * height * 0.18,
          length: Math.random() * 110 + 48,
          speed: Math.random() * 6 + 8,
          opacity: 1,
          angle: Math.PI / 4 + (Math.random() * 0.16 - 0.08),
        });
      }
    };

    const drawPlanet = (time: number) => {
      const scroll = scrollRef.current;
      const pointerX = (pointerRef.current.x - 0.5) * 18;
      const pointerY = (pointerRef.current.y - 0.5) * 12;
      const planetRadius = Math.min(width, height) < 700 ? 90 : 150;
      const planetX = width * 0.78 - scroll * 0.12 + Math.sin(time * 0.003) * 3 + pointerX;
      const planetY = height * 0.38 + scroll * 0.035 + pointerY;

      if (planetX + planetRadius * 2.5 < 0 || planetX - planetRadius * 2.5 > width) {
        return;
      }

      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
      const ringLag = clamp(scroll * 0.018 + Math.sin(time * 0.006) * 4, -planetRadius * 0.12, planetRadius * 0.16);
      const ringLift = clamp(scroll * 0.004, -planetRadius * 0.035, planetRadius * 0.055);
      const ringX = planetX + ringLag;
      const ringY = planetY + planetRadius * 0.03 + ringLift;
      const ringRotation = Math.PI / 6;
      const drawRingSegment = (
        radiusX: number,
        radiusY: number,
        lineWidth: number,
        strokeStyle: string,
        startAngle: number,
        endAngle: number
      ) => {
        ctx.save();
        ctx.translate(ringX, ringY);
        ctx.rotate(ringRotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, radiusX, radiusY, 0, startAngle, endAngle);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();
        ctx.restore();
      };

      drawRingSegment(planetRadius * 2.25, planetRadius * 0.42, 1.4, "rgba(255, 255, 255, 0.2)", Math.PI, Math.PI * 2);
      drawRingSegment(planetRadius * 1.82, planetRadius * 0.32, 8, "rgba(255, 255, 255, 0.06)", Math.PI, Math.PI * 2);

      const planetGradient = ctx.createRadialGradient(
        planetX - planetRadius * 0.34,
        planetY - planetRadius * 0.36,
        planetRadius * 0.08,
        planetX,
        planetY,
        planetRadius
      );
      planetGradient.addColorStop(0, "rgba(130, 130, 130, 0.92)");
      planetGradient.addColorStop(0.45, "rgba(42, 42, 42, 0.96)");
      planetGradient.addColorStop(1, "rgba(3, 3, 3, 1)");

      ctx.beginPath();
      ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
      ctx.fillStyle = planetGradient;
      ctx.fill();

      const shadow = ctx.createRadialGradient(
        planetX + planetRadius * 0.24,
        planetY + planetRadius * 0.18,
        planetRadius * 0.1,
        planetX + planetRadius * 0.24,
        planetY + planetRadius * 0.18,
        planetRadius * 1.05
      );
      shadow.addColorStop(0, "rgba(0, 0, 0, 0)");
      shadow.addColorStop(1, "rgba(0, 0, 0, 0.72)");
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
      ctx.fillStyle = shadow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.stroke();

      drawRingSegment(planetRadius * 2.25, planetRadius * 0.42, 1.6, "rgba(255, 255, 255, 0.34)", 0.08 * Math.PI, 0.92 * Math.PI);
      drawRingSegment(planetRadius * 1.82, planetRadius * 0.32, 7, "rgba(255, 255, 255, 0.14)", 0.12 * Math.PI, 0.88 * Math.PI);
    };

    setCanvasSize();
    updateScroll();
    window.addEventListener("resize", setCanvasSize);
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });

    let animationFrame: number;
    let time = 0;

    const animate = () => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const scroll = scrollRef.current;
      const pointerX = (pointerRef.current.x - 0.5) * 12;
      const pointerY = (pointerRef.current.y - 0.5) * 8;

      stars.forEach((star) => {
        const parallaxX = scroll * star.depth * 0.012;
        const parallaxY = scroll * star.depth * 0.045;
        const breathingX = Math.sin(time * 0.002 + star.phase) * star.depth * 0.7;
        const breathingY = Math.cos(time * 0.0024 + star.phase) * star.depth * 0.5;
        const x = star.x - parallaxX + pointerX * star.depth + breathingX;
        const y = star.y - parallaxY + pointerY * star.depth + breathingY;

        if (x < -6 || x > width + 6 || y < -8 || y > height + 8) {
          return;
        }

        const twinkle = Math.sin(time * 0.025 + star.phase) * 0.28 + 0.72;
        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
        ctx.fill();
      });

      drawPlanet(time);

      spawnMeteor();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        const tailX = m.x + Math.cos(m.angle) * m.length;
        const tailY = m.y - Math.sin(m.angle) * m.length;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${m.opacity})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.stroke();

        m.x -= Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.opacity -= 0.018;

        if (m.opacity <= 0 || m.y > height || m.x < 0) {
          meteors.splice(i, 1);
        }
      }

      const gradient = ctx.createRadialGradient(
        width * 0.5, height * 0.5, 0,
        width * 0.5, height * 0.5, width * 0.6
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.03)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      time += 1;
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("pointermove", updatePointer);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-black/20"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.6) 100%)",
        }}
      />
    </>
  );
}
