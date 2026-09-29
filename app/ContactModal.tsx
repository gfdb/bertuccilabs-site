"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  type ChangeEvent,
  type FormEvent,
  type MutableRefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

const turnstileScriptSrc =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const successMessage = "Your message was sent, we'll get back to you soon!";

type PublicEnv = {
  VITE_CONTACT_ENDPOINT?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  NEXT_PUBLIC_CONTACT_ENDPOINT?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
};

type TurnstileWidgetId = string;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark" | "light" | "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": () => void;
    },
  ) => TurnstileWidgetId;
  reset: (widgetId: TurnstileWidgetId) => void;
  remove: (widgetId: TurnstileWidgetId) => void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

type SubmitStatus =
  | "idle"
  | "submitting"
  | "validation-error"
  | "verification-error"
  | "service-error"
  | "success";

type ContactForm = {
  name: string;
  email: string;
  company: string;
  message: string;
  website: string;
};

type ContactModalProps = {
  open: boolean;
  onClose: () => void;
  openerRef: MutableRefObject<HTMLElement | null>;
};

const emptyForm: ContactForm = {
  name: "",
  email: "",
  company: "",
  message: "",
  website: "",
};

let turnstileReady: Promise<TurnstileApi> | null = null;

function getPublicEnv(): PublicEnv {
  return ((import.meta as unknown as { env?: PublicEnv }).env ?? {}) as PublicEnv;
}

function getConfig() {
  const env = getPublicEnv();
  return {
    endpoint:
      env.VITE_CONTACT_ENDPOINT ?? env.NEXT_PUBLIC_CONTACT_ENDPOINT ?? "",
    siteKey:
      env.VITE_TURNSTILE_SITE_KEY ?? env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  };
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (
      Number(char) ^
      (Math.floor(Math.random() * 16) >> (Number(char) / 4))
    ).toString(16),
  );
}

function loadTurnstile() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile is unavailable."));
  }

  const existing = (window as TurnstileWindow).turnstile;
  if (existing) return Promise.resolve(existing);
  if (turnstileReady) return turnstileReady;

  turnstileReady = new Promise<TurnstileApi>((resolve, reject) => {
    const loaded = document.querySelector<HTMLScriptElement>(
      `script[src="${turnstileScriptSrc}"]`,
    );
    if (loaded) {
      loaded.addEventListener(
        "load",
        () => {
          const api = (window as TurnstileWindow).turnstile;
          if (api) {
            resolve(api);
          } else {
            reject(new Error("Turnstile did not initialize."));
          }
        },
        { once: true },
      );
      loaded.addEventListener(
        "error",
        () => reject(new Error("Turnstile could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = turnstileScriptSrc;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = (window as TurnstileWindow).turnstile;
      if (api) {
        resolve(api);
      } else {
        reject(new Error("Turnstile did not initialize."));
      }
    };
    script.onerror = () => reject(new Error("Turnstile could not be loaded."));
    document.head.append(script);
  });

  return turnstileReady;
}

function validateForm(form: ContactForm, token: string) {
  const errors: Partial<Record<keyof ContactForm | "turnstile", string>> = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const company = form.company.trim();
  const message = form.message.trim();

  if (!name || name.length > 120) {
    errors.name = "Enter your name, up to 120 characters.";
  }
  if (
    !email ||
    email.length > 254 ||
    /[\r\n]/.test(email) ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
  ) {
    errors.email = "Enter a valid email address.";
  }
  if (company.length > 120) {
    errors.company = "Company must be 120 characters or fewer.";
  }
  if (message.length < 10 || message.length > 5000) {
    errors.message = "Message must be between 10 and 5,000 characters.";
  }
  if (!token || token.length > 2048) {
    errors.turnstile = "Complete the verification before sending.";
  }

  return errors;
}

export default function ContactModal({
  open,
  onClose,
  openerRef,
}: ContactModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const inFlightRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [requestId, setRequestId] = useState(createRequestId);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ContactForm | "turnstile", string>>
  >({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const reduceMotion = useReducedMotion();
  const config = useMemo(() => getConfig(), []);
  const formUnavailable = !config.endpoint || !config.siteKey;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
      window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    }

    if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (open && status === "success") {
      window.setTimeout(() => successTitleRef.current?.focus(), 0);
    }
  }, [open, status]);

  useEffect(() => {
    if (!open) {
      openerRef.current?.focus();
      return;
    }

    if (formUnavailable) return;

    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !widgetContainerRef.current || widgetIdRef.current) {
          return;
        }
        widgetIdRef.current = turnstile.render(widgetContainerRef.current, {
          sitekey: config.siteKey,
          action: "contact",
          theme: "dark",
          callback: (token) => {
            setTurnstileToken(token);
            setStatus("idle");
            setStatusMessage("");
            setFieldErrors((current) => ({
              ...current,
              turnstile: undefined,
            }));
          },
          "expired-callback": () => {
            setTurnstileToken("");
            setStatus("verification-error");
            setStatusMessage("Verification expired. Please try again.");
          },
          "timeout-callback": () => {
            setTurnstileToken("");
            setStatus("verification-error");
            setStatusMessage("Verification timed out. Please try again.");
          },
          "error-callback": () => {
            setTurnstileToken("");
            setStatus("verification-error");
            setStatusMessage(
              "Verification could not be completed. Please try again.",
            );
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setTurnstileToken("");
          setStatus("verification-error");
          setStatusMessage(
            "Verification could not be loaded. Please try again later.",
          );
        }
      });

    return () => {
      cancelled = true;
      setTurnstileToken("");
      const widgetId = widgetIdRef.current;
      const turnstile = (window as TurnstileWindow).turnstile;
      if (widgetId && turnstile) {
        turnstile.remove(widgetId);
      }
      widgetIdRef.current = null;
    };
  }, [config.endpoint, config.siteKey, formUnavailable, open, openerRef]);

  const resetTurnstile = () => {
    setTurnstileToken("");
    const widgetId = widgetIdRef.current;
    const turnstile = (window as TurnstileWindow).turnstile;
    if (widgetId && turnstile) turnstile.reset(widgetId);
  };

  const handleChange =
    (field: keyof ContactForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
      if (field !== "website") {
        setRequestId(createRequestId());
        if (
          status === "validation-error" ||
          status === "verification-error" ||
          status === "service-error"
        ) {
          setStatus("idle");
          setStatusMessage("");
        }
      }
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlightRef.current) return;

    if (formUnavailable) {
      setStatus("service-error");
      setStatusMessage(
        "The contact form is temporarily unavailable. Please try again later.",
      );
      return;
    }

    const errors = validateForm(form, turnstileToken);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setStatus("validation-error");
      setStatusMessage("Please fix the highlighted fields before sending.");
      return;
    }

    inFlightRef.current = true;
    setStatus("submitting");
    setStatusMessage("Sending your message...");

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          message: form.message.trim(),
          website: form.website,
          turnstileToken,
          requestId,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (response.ok) {
        setStatus("success");
        setStatusMessage(successMessage);
        setForm(emptyForm);
        setRequestId(createRequestId());
        setFieldErrors({});
        resetTurnstile();
        return;
      }

      resetTurnstile();
      if (body.error === "verification_failed") {
        setStatus("verification-error");
        setStatusMessage("Verification failed. Please try again.");
      } else if (body.error === "validation_failed") {
        setStatus("validation-error");
        setStatusMessage("Please check your message and try again.");
      } else {
        setStatus("service-error");
        setStatusMessage(
          "The message could not be sent right now. Please try again later.",
        );
      }
    } catch {
      resetTurnstile();
      setStatus("service-error");
      setStatusMessage(
        "The message could not be sent right now. Please try again later.",
      );
    } finally {
      inFlightRef.current = false;
    }
  };

  const close = () => {
    if (status === "success") {
      setStatus("idle");
      setStatusMessage("");
    }
    onClose();
  };
  const displayedStatus = formUnavailable ? "service-error" : status;
  const displayedStatusMessage = formUnavailable
    ? "The contact form is temporarily unavailable. Please try again later."
    : statusMessage;
  const displayedStatusIsError =
    displayedStatus === "validation-error" ||
    displayedStatus === "verification-error" ||
    displayedStatus === "service-error";

  return (
    <dialog
      ref={dialogRef}
      className="contact-modal"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={close}
      onClose={() => {
        document.body.style.overflow = "";
      }}
    >
      <div className="contact-modal-panel">
        <button
          className="modal-close"
          type="button"
          aria-label="Close contact form"
          onClick={close}
        >
          x
        </button>
        <AnimatePresence mode="wait" initial={false}>
          {status === "success" ? (
            <motion.section
              key="success"
              className="contact-success"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
              role="status"
              aria-live="polite"
            >
              <div className="mail-sent-animation" aria-hidden="true">
                <motion.span
                  className="mail-flight"
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, x: -42, y: 18, rotate: -8 }
                  }
                  animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.7,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <svg viewBox="0 0 68 52" focusable="false">
                    <rect x="3" y="6" width="62" height="40" rx="2" />
                    <path d="m5 9 29 22L63 9" />
                    <path d="m4 44 21-20M64 44 43 24" />
                  </svg>
                </motion.span>
                <motion.span
                  className="mail-success-check"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.55 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: reduceMotion ? 0 : 0.52,
                    duration: reduceMotion ? 0 : 0.3,
                    ease: "backOut",
                  }}
                >
                  <svg viewBox="0 0 24 24" focusable="false">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m7.5 12 3 3 6-7" />
                  </svg>
                </motion.span>
              </div>
              <p className="kicker text-red">Message sent</p>
              <h2 ref={successTitleRef} id={titleId} tabIndex={-1}>
                Thank you.
              </h2>
              <p id={descriptionId} className="success-copy">
                {statusMessage}
              </p>
              <button className="button-primary" type="button" onClick={close}>
                Done
              </button>
            </motion.section>
          ) : (
            <motion.div
              key="form"
              className="modal-form-view"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              <p className="kicker text-red">Contact</p>
              <h2 id={titleId}>Tell us about the project.</h2>
              <p id={descriptionId} className="modal-intro">
                Share what you&apos;re trying to build, improve, or find out.
                We&apos;ll help assess the technical options and next steps.
              </p>

              <form className="contact-form" onSubmit={handleSubmit} noValidate>
                <div className="form-field">
                  <label htmlFor="contact-name">Name</label>
                  <input
                    ref={firstFieldRef}
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    value={form.name}
                    onChange={handleChange("name")}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={
                      fieldErrors.name ? "contact-name-error" : undefined
                    }
                    required
                  />
                  {fieldErrors.name ? (
                    <span id="contact-name-error">{fieldErrors.name}</span>
                  ) : null}
                </div>

                <div className="form-field">
                  <label htmlFor="contact-email">Email</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={form.email}
                    onChange={handleChange("email")}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={
                      fieldErrors.email ? "contact-email-error" : undefined
                    }
                    required
                  />
                  {fieldErrors.email ? (
                    <span id="contact-email-error">{fieldErrors.email}</span>
                  ) : null}
                </div>

                <div className="form-field">
                  <label htmlFor="contact-company">
                    Company <em>optional</em>
                  </label>
                  <input
                    id="contact-company"
                    name="company"
                    type="text"
                    autoComplete="organization"
                    maxLength={120}
                    value={form.company}
                    onChange={handleChange("company")}
                    aria-invalid={Boolean(fieldErrors.company)}
                    aria-describedby={
                      fieldErrors.company ? "contact-company-error" : undefined
                    }
                  />
                  {fieldErrors.company ? (
                    <span id="contact-company-error">{fieldErrors.company}</span>
                  ) : null}
                </div>

                <div className="form-field form-field-full">
                  <label htmlFor="contact-message">Message</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    minLength={10}
                    maxLength={5000}
                    value={form.message}
                    onChange={handleChange("message")}
                    aria-invalid={Boolean(fieldErrors.message)}
                    aria-describedby={
                      fieldErrors.message ? "contact-message-error" : undefined
                    }
                    required
                  />
                  {fieldErrors.message ? (
                    <span id="contact-message-error">{fieldErrors.message}</span>
                  ) : null}
                </div>

                <div className="hp-field" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={handleChange("website")}
                  />
                </div>

                <div className="turnstile-area">
                  <div ref={widgetContainerRef} className="turnstile-slot" />
                  {fieldErrors.turnstile ? (
                    <span>{fieldErrors.turnstile}</span>
                  ) : null}
                </div>

                <div className="form-footer">
                  <button
                    className="button-primary"
                    type="submit"
                    disabled={status === "submitting" || formUnavailable}
                  >
                    {status === "submitting" ? "Sending..." : "Send message"}
                  </button>
                </div>

                {displayedStatusMessage ? (
                  <div
                    className={`form-notice form-notice-${displayedStatus}`}
                    role="status"
                    aria-live="polite"
                  >
                    {displayedStatus === "submitting" ? (
                      <span
                        className="form-notice-spinner"
                        aria-hidden="true"
                      />
                    ) : null}
                    {displayedStatusIsError ? (
                      <svg
                        className="form-notice-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9.5" />
                        <path d="M12 7.5v5.5M12 16.5h.01" />
                      </svg>
                    ) : null}
                    <p>{displayedStatusMessage}</p>
                  </div>
                ) : null}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </dialog>
  );
}
