"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";

const contactHref =
  "mailto:hello@bertuccilabs.com?subject=Project%20inquiry%20for%20Bertucci%20Labs";

const expertise = [
  {
    index: "01",
    title: "Applied AI",
    body: "Agents, retrieval, evaluation loops, and intelligent workflows shaped around real operations.",
  },
  {
    index: "02",
    title: "Custom software",
    body: "Applications and platforms designed for the specific mechanics of your business.",
  },
  {
    index: "03",
    title: "Engineering partnership",
    body: "Architecture, delivery, and ongoing development with production discipline from day one.",
  },
] as const;

const approach = [
  "Map the decision surface",
  "Design the smallest useful system",
  "Ship with observability",
  "Iterate from real usage",
] as const;

const proof = [
  ["Research", "Turn ambiguous technical bets into scoped, testable paths."],
  ["Software", "Build quiet, durable tools that teams can trust every day."],
  ["Intelligence", "Bring models into the workflow where they create measurable leverage."],
  ["Real-world impact", "Optimize for adoption, reliability, and business outcomes."],
] as const;

function LogoMark() {
  return (
    <div className="logo-lockup" aria-label="Bertucci Labs">
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-top" />
        <span className="logo-spine" />
        <span className="logo-middle" />
        <span className="logo-bottom" />
        <span className="logo-red logo-red-top" />
        <span className="logo-red logo-red-mid" />
        <span className="logo-red logo-red-bottom" />
      </span>
      <span className="logo-wordmark">
        <strong>Bertucci</strong>
        <span>Labs</span>
      </span>
    </div>
  );
}

function TerrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let animation = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ridge = (x: number, row: number, time: number) => {
      const center = width * (0.48 + 0.05 * Math.sin(row * 0.25));
      const distance = Math.abs(x - center) / Math.max(width, 1);
      const peak =
        Math.exp(-distance * 6.2) *
        (height * 0.3 + height * 0.13 * Math.sin(row * 0.32 + time));
      const wave =
        Math.sin(x * 0.014 + row * 0.45 + time) * 15 +
        Math.cos(x * 0.008 - row * 0.2) * 18;
      return peak + wave;
    };

    const draw = () => {
      const time = reduceMotion ? 0.8 : frame * 0.018;
      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(
        width * 0.58,
        height * 0.58,
        0,
        width * 0.58,
        height * 0.58,
        width * 0.58,
      );
      glow.addColorStop(0, "rgba(255, 13, 50, 0.28)");
      glow.addColorStop(0.45, "rgba(255, 13, 50, 0.08)");
      glow.addColorStop(1, "rgba(255, 13, 50, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const rows = 38;
      const rowGap = height / (rows + 12);
      const left = width * 0.02;
      const right = width * 0.98;

      for (let row = rows; row >= 0; row -= 1) {
        const progress = row / rows;
        const baseY = height * 0.8 - row * rowGap * 0.9;
        const offsetX = (progress - 0.5) * width * 0.18;
        context.beginPath();

        for (let step = 0; step <= 140; step += 1) {
          const stepProgress = step / 140;
          const x = left + (right - left) * stepProgress + offsetX;
          const perspective = 0.46 + progress * 0.62;
          const y =
            baseY -
            ridge(x, row, time) * perspective +
            Math.sin(stepProgress * Math.PI) * progress * height * 0.18;

          if (step === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.strokeStyle = `rgba(255, ${32 + row * 3}, ${56 + row * 2}, ${
          0.18 + progress * 0.62
        })`;
        context.lineWidth = 0.9 + progress * 0.9;
        context.shadowColor = "rgba(255, 18, 48, 0.64)";
        context.shadowBlur = 8;
        context.stroke();
      }

      context.shadowBlur = 0;
      context.strokeStyle = "rgba(255, 255, 255, 0.15)";
      context.lineWidth = 1;
      [
        [0.32, 0.38, "MODELS"],
        [0.72, 0.2, "SYSTEMS"],
        [0.9, 0.52, "REAL-WORLD USE"],
      ].forEach(([xRatio, yRatio, label]) => {
        const x = width * Number(xRatio);
        const y = height * Number(yRatio);
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, y + height * 0.18);
        context.stroke();
        context.fillStyle = "#f5f5f0";
        context.font = "10px var(--font-geist-mono), monospace";
        context.fillText(String(label), x + 10, y + 8);
        context.fillStyle = "#ffffff";
        context.fillRect(x - 4, y + height * 0.18 - 4, 8, 8);
      });

      frame += 1;
      if (!reduceMotion) animation = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animation);
    };
  }, []);

  return <canvas ref={canvasRef} className="terrain-canvas" aria-hidden="true" />;
}

export default function Home() {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.75 };

  return (
    <main className="min-h-screen overflow-hidden bg-[#080909] text-[#f6f6f2]">
      <div className="site-shell">
        <header className="site-header">
          <Link href="/" aria-label="Bertucci Labs home">
            <LogoMark />
          </Link>
          <nav className="main-nav" aria-label="Primary navigation">
            <a href="#expertise">Expertise</a>
            <a href="#approach">Approach</a>
            <a href={contactHref}>Contact</a>
          </nav>
        </header>

        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <motion.p
              className="kicker text-red"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition}
            >
              AI &amp; Software Engineering
            </motion.p>
            <motion.h1
              id="hero-title"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.08 }}
            >
              Intelligence, engineered<span>.</span>
            </motion.h1>
            <motion.p
              className="hero-lede"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.16 }}
            >
              Custom AI systems and software. Built for the problems that
              matter to your business.
            </motion.p>
            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition, delay: 0.24 }}
            >
              <a className="button-primary" href={contactHref}>
                Discuss a project
                <span aria-hidden="true">-&gt;</span>
              </a>
              <a className="button-secondary" href="#expertise">
                Explore our capabilities
              </a>
            </motion.div>
            <p className="microline">From first principles to production</p>
          </div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...transition, delay: 0.18 }}
          >
            <TerrainCanvas />
          </motion.div>
        </section>

        <section className="expertise-grid" id="expertise" aria-label="Expertise">
          {expertise.map((item) => (
            <motion.article
              className="expertise-card"
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={transition}
            >
              <span>{item.index}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </motion.article>
          ))}
        </section>

        <section className="statement-section">
          <p className="section-mark" aria-hidden="true" />
          <div>
            <h2>
              Complexity, made useful<span>.</span>
            </h2>
            <p>
              Bertucci Labs partners with operators who need more than a demo:
              reliable software, grounded AI, and engineering judgment that can
              move from prototype to production.
            </p>
          </div>
          <ul aria-label="Focus areas">
            {proof.map(([label, body]) => (
              <li key={label}>
                <strong>{label}</strong>
                <span>{body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="approach-section" id="approach">
          <div className="section-heading">
            <p className="kicker text-red">Approach</p>
            <h2>Systems that earn their place in the workflow.</h2>
          </div>
          <div className="approach-list">
            {approach.map((item, index) => (
              <motion.div
                className="approach-row"
                key={item}
                initial={{ opacity: 0, x: -18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.45 }}
                transition={{ ...transition, delay: index * 0.05 }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="contact-section" aria-labelledby="contact-title">
          <div>
            <p className="kicker text-red">Contact</p>
            <h2 id="contact-title">Bring us the hard part.</h2>
          </div>
          <p>
            Tell us where the system bends, where the workflow slows down, and
            what better would mean. We will help shape the path from there.
          </p>
          <a className="button-primary" href={contactHref}>
            hello@bertuccilabs.com
            <span aria-hidden="true">-&gt;</span>
          </a>
        </section>
      </div>
    </main>
  );
}
