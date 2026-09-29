"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { type MouseEvent, useRef, useState } from "react";
import ContactModal from "./ContactModal";
import TerrainCanvas from "./TerrainCanvas";

const expertise = [
  {
    index: "01",
    title: "Applied research",
    body: "Develop and evaluate models, test new approaches, and build prototypes to answer technical questions.",
  },
  {
    index: "02",
    title: "AI systems",
    body: "Build AI systems that work with your data, automate tasks, and integrate with your existing software.",
  },
  {
    index: "03",
    title: "Custom software",
    body: "Design and develop applications, platforms, and internal tools around how your business works.",
  },
] as const;

const approach = [
  "Understand the problem",
  "Design the smallest useful system",
  "Build, test, and deploy",
  "Improve from real usage",
] as const;

const proof = [
  ["Engineering judgment", "Choose approaches that fit the problem, budget, and constraints."],
  ["Evaluation", "Test models and software against clearly defined requirements."],
  ["Integration", "Design for your existing data, tools, and workflows."],
  ["Maintainability", "Build systems that are straightforward to operate, maintain, and extend."],
] as const;

export default function Home() {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.75 };
  const [contactOpen, setContactOpen] = useState(false);
  const contactOpenerRef = useRef<HTMLElement | null>(null);

  const openContactModal = (event: MouseEvent<HTMLElement>) => {
    contactOpenerRef.current = event.currentTarget;
    setContactOpen(true);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#080909] text-[#f6f6f2]">
      <div className="site-shell">
        <header className="site-header">
          <Link
            className="header-brand"
            href="/"
            aria-label="Bertucci Labs home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brand-monogram"
              src="/brand/bl-monogram.svg"
              alt=""
              width="33"
              height="43"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brand-lettering"
              src="/brand/bertucci-labs-lettering.svg"
              alt=""
              width="149"
              height="13"
            />
          </Link>
          <nav className="main-nav" aria-label="Primary navigation">
            <a href="#expertise">Expertise</a>
            <a href="#approach">Approach</a>
            <button type="button" onClick={openContactModal}>
              Contact
            </button>
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
              Research, AI Systems &amp; Software
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
              <button
                className="button-primary"
                type="button"
                onClick={openContactModal}
              >
                Discuss a project
              </button>
              <a className="button-secondary" href="#expertise">
                Explore our capabilities
              </a>
            </motion.div>
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
              From research to production<span>.</span>
            </h2>
            <p>
              Bertucci Labs combines applied research with software engineering.
              Work with us to investigate a technical question, develop a new
              product, or improve an existing system. Engagements range from
              focused research projects to full builds and ongoing development.
            </p>
          </div>
          <ul aria-label="Working standards">
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
            <h2>How we work.</h2>
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
            <h2 id="contact-title">Have a project in mind?</h2>
          </div>
          <p>
            Tell us what you&apos;re trying to build, improve, or find out. We&apos;ll
            help you assess the technical options and work out the next steps.
          </p>
          <button
            className="button-primary"
            type="button"
            onClick={openContactModal}
          >
            Start a conversation
          </button>
        </section>
      </div>
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        openerRef={contactOpenerRef}
      />
    </main>
  );
}
