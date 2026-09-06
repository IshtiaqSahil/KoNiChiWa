import { useEffect, useRef } from "react";

// Ambient floating sparkles behind the page content - a soft glow core plus
// a 4-point cross glint, twinkling in brightness, styled after a
// "sparkle brush" reference rather than plain flat dots. Canvas rather than
// DOM/SVG nodes per sparkle - dozens of continuously-animated shapes are
// exactly the case the artifact-design guidance points at Canvas for, and
// it sidesteps the DOM-node overhead a hexagon-grid experiment earlier hit
// (1500+ SVG polygons was genuinely heavy).
//
// Rendered first in DOM order (see main.tsx) with no z-index set at all -
// a position:fixed element with a *negative* z-index paints behind the
// page's own background layer in the root stacking context and becomes
// fully invisible, not just "behind content" (caught live earlier this
// session debugging a different background attempt). DOM order alone
// already puts this behind whatever renders after it.

const SPARKLE_COLOR = "150, 190, 255"; // brighter/whiter-leaning blue than --accent, for visibility against the dark ground
const SPARKLE_COUNT = 140;

interface Sparkle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

function makeSparkle(width: number, height: number): Sparkle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: 1.1 + Math.random() * 2.6,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -0.04 - Math.random() * 0.14,
    baseAlpha: 0.45 + Math.random() * 0.45,
    twinkleSpeed: 0.0015 + Math.random() * 0.003,
    phase: Math.random() * Math.PI * 2,
  };
}

function drawSparkle(ctx: CanvasRenderingContext2D, s: Sparkle, alpha: number) {
  const { x, y, size } = s;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  // Soft glow core.
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.4);
  glow.addColorStop(0, `rgba(${SPARKLE_COLOR}, 0.9)`);
  glow.addColorStop(1, `rgba(${SPARKLE_COLOR}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // 4-point cross glint.
  ctx.strokeStyle = `rgba(${SPARKLE_COLOR}, 1)`;
  ctx.lineWidth = Math.max(0.5, size * 0.22);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-size * 1.9, 0);
  ctx.lineTo(size * 1.9, 0);
  ctx.moveTo(0, -size * 1.9);
  ctx.lineTo(0, size * 1.9);
  ctx.stroke();

  ctx.restore();
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = window.innerWidth;
    let height = window.innerHeight;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const sparkles: Sparkle[] = Array.from({ length: SPARKLE_COUNT }, () => makeSparkle(width, height));

    if (reducedMotion) {
      ctx.clearRect(0, 0, width, height);
      for (const s of sparkles) drawSparkle(ctx, s, s.baseAlpha);
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    function frame(t: number) {
      ctx!.clearRect(0, 0, width, height);
      for (const s of sparkles) {
        s.x += s.vx;
        s.y += s.vy;
        // Wrap around each edge instead of resetting to one corner, so
        // motion reads as continuous drift, not a repeating "reset" pop.
        if (s.y < -6) s.y = height + 6;
        if (s.x < -6) s.x = width + 6;
        if (s.x > width + 6) s.x = -6;

        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * s.twinkleSpeed + s.phase));
        drawSparkle(ctx!, s, s.baseAlpha * twinkle);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
    />
  );
}
