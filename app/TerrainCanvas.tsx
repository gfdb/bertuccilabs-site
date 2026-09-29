"use client";

import { useEffect, useRef } from "react";

const ROWS = 56;
const STEPS = 170;
const STRIDE = STEPS + 1;
const GRID_POINTS = (ROWS + 1) * STRIDE;
const FPS = 30;
const MAX_DPR = 1.5;
const RADIANS_PER_SECOND = 0.36;
const MARKERS = [
  { u: 0.66, v: 0.06, label: "Research" },
  { u: 0.82, v: 0.34, label: "AI systems" },
  { u: 0.98, v: 0.12, label: "Software" },
] as const;

function createTerrainRenderer(context: CanvasRenderingContext2D) {
  const count = GRID_POINTS + MARKERS.length;
  const baseHeight = new Float64Array(count);
  const waveSin = new Float64Array(count);
  const waveCos = new Float64Array(count);
  const normalizedX = new Float64Array(count);
  const normalizedY = new Float64Array(count);
  const screenX = new Float64Array(count);
  const flatY = new Float64Array(count);
  const screenY = new Float64Array(count);

  const gaussian = (
    u: number,
    v: number,
    cx: number,
    cy: number,
    sx: number,
    sy: number,
    amplitude: number,
  ) =>
    amplitude *
    Math.exp(
      -((u - cx) * (u - cx)) / (2 * sx * sx) -
        ((v - cy) * (v - cy)) / (2 * sy * sy),
    );

  const cachePoint = (index: number, u: number, v: number) => {
    baseHeight[index] =
      gaussian(u, v, 0.66, 0.76, 0.14, 0.17, 1.08) +
      gaussian(u, v, 0.5, 0.56, 0.22, 0.13, 0.39) +
      gaussian(u, v, 0.56, 0.2, 0.2, 0.1, 0.54) +
      gaussian(u, v, 0.22, 0.42, 0.19, 0.15, 0.36) +
      gaussian(u, v, 0.85, 0.48, 0.18, 0.17, 0.26) -
      (gaussian(u, v, 0.74, 0.25, 0.15, 0.13, 0.82) +
        gaussian(u, v, 0.88, 0.28, 0.12, 0.16, 0.32)) +
      0.04 * Math.cos(u * 17 - v * 20);
    const phase = u * 28 + v * 8;
    waveSin[index] = 0.055 * Math.sin(phase);
    waveCos[index] = 0.055 * Math.cos(phase);
    normalizedX[index] = 0.02 + u * 0.92 + (v - 0.48) * 0.16;
    normalizedY[index] = 0.91 - v * 0.5 + Math.sin(u * Math.PI) * v * 0.08;
  };

  for (let row = 0; row <= ROWS; row += 1) {
    for (let step = 0; step <= STEPS; step += 1) {
      cachePoint(row * STRIDE + step, step / STEPS, row / ROWS);
    }
  }
  MARKERS.forEach(({ u, v }, index) => cachePoint(GRID_POINTS + index, u, v));

  const rowStyles = Array.from({ length: ROWS + 1 }, (_, row) => {
    const v = row / ROWS;
    return {
      color: `rgba(255, 33, 30, ${0.16 + v * 0.72})`,
      coreAlpha: 0.09 + v * 0.3,
      lineWidth: 0.75 + v * 1.25,
    };
  });
  const labelWidths = new Float64Array(MARKERS.length);
  const labelX = new Float64Array(MARKERS.length);
  let width = 0;
  let height = 0;
  let canyonMask: CanvasGradient;
  let canyonPath: Path2D;
  let ambientGlow: CanvasGradient;
  let hotCore: CanvasGradient;
  let glowStroke: CanvasGradient;
  let glowBlur = 8;

  const resize = (nextWidth: number, nextHeight: number, pixelRatio: number) => {
    width = nextWidth;
    height = nextHeight;
    const canvas = context.canvas;
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    context.font = "500 13px Arial, Helvetica, sans-serif";
    glowBlur = 8 * pixelRatio;

    for (let i = 0; i < count; i += 1) {
      screenX[i] = normalizedX[i] * width;
      flatY[i] = normalizedY[i] * height;
    }
    MARKERS.forEach(({ label }, index) => {
      labelWidths[index] = context.measureText(label).width;
      labelX[index] = Math.min(
        Math.max(screenX[GRID_POINTS + index] - labelWidths[index] / 2, 8),
        width - labelWidths[index] - 8,
      );
    });

    canyonMask = context.createRadialGradient(
      width * 0.76,
      height * 0.62,
      width * 0.04,
      width * 0.76,
      height * 0.62,
      width * 0.28,
    );
    canyonMask.addColorStop(0, "rgba(3, 4, 4, 0.78)");
    canyonMask.addColorStop(0.5, "rgba(3, 4, 4, 0.32)");
    canyonMask.addColorStop(1, "rgba(3, 4, 4, 0)");
    canyonPath = new Path2D();
    canyonPath.ellipse(
      width * 0.76,
      height * 0.62,
      width * 0.28,
      height * 0.22,
      -0.2,
      0,
      Math.PI * 2,
    );
    ambientGlow = context.createRadialGradient(
      width * 0.68,
      height * 0.81,
      0,
      width * 0.68,
      height * 0.81,
      width * 0.37,
    );
    ambientGlow.addColorStop(0, "rgba(255, 28, 12, 0.12)");
    ambientGlow.addColorStop(0.4, "rgba(185, 15, 7, 0.045)");
    ambientGlow.addColorStop(1, "rgba(185, 15, 7, 0)");
    hotCore = context.createLinearGradient(0, 0, 0, height);
    hotCore.addColorStop(0, "rgba(255, 210, 200, 1)");
    hotCore.addColorStop(0.3, "rgba(255, 100, 95, 0.8)");
    hotCore.addColorStop(0.65, "rgba(255, 55, 50, 0.25)");
    hotCore.addColorStop(1, "rgba(255, 70, 30, 0)");
    glowStroke = context.createLinearGradient(0, 0, 0, height);
    glowStroke.addColorStop(0, "rgba(255, 34, 12, 0.4)");
    glowStroke.addColorStop(0.55, "rgba(255, 24, 6, 0.18)");
    glowStroke.addColorStop(1, "rgba(255, 24, 6, 0.025)");
  };

  const draw = (time: number) => {
    const sinTime = Math.sin(time);
    const cosTime = Math.cos(time);
    const elevationScale = height * 0.5;
    for (let i = 0; i < count; i += 1) {
      const elevation = Math.max(
        -0.22,
        baseHeight[i] + waveSin[i] * cosTime + waveCos[i] * sinTime,
      );
      screenY[i] = flatY[i] - elevation * elevationScale;
    }

    context.clearRect(0, 0, width, height);
    context.fillStyle = ambientGlow;
    context.fillRect(0, 0, width, height);
    context.beginPath();
    for (let row = ROWS; row >= 0; row -= 1) {
      const start = row * STRIDE;
      context.moveTo(screenX[start], screenY[start]);
      for (let step = 1; step <= STEPS; step += 1) {
        const i = start + step;
        context.lineTo(screenX[i], screenY[i]);
      }
    }
    context.strokeStyle = glowStroke;
    context.lineWidth = 1.5;
    context.shadowColor = "rgba(255, 26, 8, 0.9)";
    context.shadowBlur = glowBlur;
    context.stroke();
    context.shadowBlur = 0;

    for (let row = ROWS; row >= 0; row -= 1) {
      const start = row * STRIDE;
      context.beginPath();
      context.moveTo(screenX[start], screenY[start]);
      for (let step = 1; step <= STEPS; step += 1) {
        const i = start + step;
        context.lineTo(screenX[i], screenY[i]);
      }
      const style = rowStyles[row];
      context.strokeStyle = style.color;
      context.lineWidth = style.lineWidth;
      context.stroke();
      context.strokeStyle = hotCore;
      context.globalAlpha = style.coreAlpha;
      context.lineWidth = 0.45;
      context.stroke();
      context.globalAlpha = 1;
    }

    context.strokeStyle = "rgba(255, 35, 19, 0.24)";
    context.lineWidth = 0.8;
    for (let col = 9; col <= 158; col += 10) {
      context.beginPath();
      context.moveTo(screenX[col], screenY[col]);
      for (let row = 1; row <= ROWS; row += 1) {
        const i = row * STRIDE + col;
        context.lineTo(screenX[i], screenY[i]);
      }
      context.stroke();
    }

    context.fillStyle = canyonMask;
    context.fill(canyonPath);
    context.strokeStyle = "rgba(245, 245, 240, 0.28)";
    context.lineWidth = 0.75;
    MARKERS.forEach(({ label }, index) => {
      const i = GRID_POINTS + index;
      const x = screenX[i];
      const y = screenY[i];
      const labelY = y - height * 0.12;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, labelY + 12);
      context.stroke();
      context.fillStyle = "#f5f5f0";
      context.fillText(label, labelX[index], labelY);
      context.fillStyle = "#ffffff";
      context.fillRect(x - 4, y - 4, 8, 8);
    });
  };

  return { resize, draw };
}

export default function TerrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const renderer = createTerrainRenderer(context);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const interval = 1000 / FPS;
    let animation = 0;
    let disposed = false;
    let inView = false;
    let reducedMotion = motionQuery.matches;
    let width = 0;
    let height = 0;
    let dpr = 0;
    let elapsed = 0;
    let previousTimestamp: number | null = null;
    let sinceDraw = 0;
    let needsRedraw = true;

    const phase = () => reducedMotion ? 0.8 : elapsed * RADIANS_PER_SECOND / 1000;
    const visible = () => !disposed && inView && !document.hidden && width > 0 && height > 0;
    const canAnimate = () => visible() && !reducedMotion;

    const stop = () => {
      cancelAnimationFrame(animation);
      animation = 0;
      previousTimestamp = null;
      sinceDraw = 0;
    };

    const tick = (timestamp: number) => {
      animation = 0;
      if (!canAnimate()) return;
      if (previousTimestamp !== null) {
        const delta = Math.max(0, timestamp - previousTimestamp);
        elapsed += delta;
        sinceDraw += delta;
      }
      previousTimestamp = timestamp;
      if (sinceDraw >= interval - 0.1) {
        sinceDraw = sinceDraw < interval ? 0 : sinceDraw % interval;
        renderer.draw(phase());
      }
      animation = requestAnimationFrame(tick);
    };

    const sync = () => {
      if (visible() && needsRedraw) {
        renderer.draw(phase());
        needsRedraw = false;
      }
      if (canAnimate()) {
        if (!animation) animation = requestAnimationFrame(tick);
      } else {
        stop();
      }
    };

    const resize = () => {
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;
      const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      if (width > 0 && height > 0) renderer.resize(width, height, dpr);
      needsRedraw = true;
      sync();
    };

    const onMotionChange = () => {
      reducedMotion = motionQuery.matches;
      elapsed = 0.8 * 1000 / RADIANS_PER_SECOND;
      needsRedraw = true;
      stop();
      sync();
    };

    if (reducedMotion) elapsed = 0.8 * 1000 / RADIANS_PER_SECOND;
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    const resizeObserver = new ResizeObserver(resize);
    resize();
    intersectionObserver.observe(canvas);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      disposed = true;
      stop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="terrain-canvas" aria-hidden="true" />;
}
