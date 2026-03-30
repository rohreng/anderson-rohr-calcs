"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Bump this key whenever terms change — forces all existing users to re-accept.
const STORAGE_KEY = "are_terms_accepted_v2";

export default function TermsModal() {
  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    if (!agreed || !name.trim()) return;
    setSubmitted(true);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name: name.trim(), date: new Date().toISOString() })
      );
    } catch {
      // localStorage unavailable — proceed anyway
    }
    setTimeout(() => setVisible(false), 300);
  }

  if (!visible) return null;

  const canAccept = agreed && name.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(15, 26, 58, 0.82)", backdropFilter: "blur(4px)" }}
      aria-modal="true"
      role="dialog"
      aria-label="Terms of Use Agreement"
    >
      <div
        className="relative flex flex-col mx-4 rounded-xl shadow-2xl overflow-hidden"
        style={{
          background: "var(--are-surface)",
          border: "1px solid var(--are-border)",
          width: "100%",
          maxWidth: 640,
          maxHeight: "90dvh",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-4 px-6 py-4 shrink-0 border-b"
          style={{ background: "var(--are-navy-deep)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Image
            src="/2.png"
            alt="Anderson Rohr Engineers"
            width={140}
            height={28}
            style={{ objectFit: "contain", objectPosition: "left" }}
            priority
          />
          <p
            className="ml-auto uppercase tracking-widest font-bold"
            style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-archivo)" }}
          >
            Terms of Use
          </p>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ minHeight: 0 }}>
          <h2
            className="text-lg font-bold mb-1"
            style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
          >
            Calculator Access Agreement
          </h2>
          <p
            className="text-xs mb-5"
            style={{ color: "var(--are-muted)", fontFamily: "var(--font-dm-sans)" }}
          >
            Please read and accept the following terms before accessing any Anderson Rohr Engineers
            structural calculators.
          </p>

          {/* Terms box */}
          <div
            className="rounded-lg p-4 text-xs leading-relaxed space-y-3"
            style={{
              background: "#f6f8fc",
              border: "1px solid var(--are-border)",
              color: "#374151",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {/* 1 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                1. Acceptance of Terms
              </h3>
              <p>
                By accessing or using any calculator or tool provided on this platform
                (&ldquo;Calculators&rdquo;), you agree to be bound by these Terms of Use. If you do
                not agree, do not access or use the Calculators.
              </p>
            </section>

            {/* 2 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                2. Intellectual Property — Proprietary Calculations
              </h3>
              <p>
                <strong>
                  Anderson Rohr Engineers (&ldquo;ARE&rdquo;) retains all rights, title, and
                  interest in and to all Calculators
                </strong>
                , including but not limited to their design, layout, visual presentation, logic,
                methodology, formulas, algorithms, source code, and output format. All such
                materials are protected by applicable copyright, trade secret, and intellectual
                property laws.
              </p>
              <p className="mt-2">
                By using the Calculators, you expressly agree that you will{" "}
                <strong>not reproduce, recreate, reverse-engineer, copy, or imitate</strong> any
                Calculator — in whole or in part — in style, form, function, or methodology,
                whether for personal use, internal use, distribution, commercial sale, or any other
                purpose, without prior written consent from ARE.
              </p>
              <p className="mt-2">
                This prohibition applies to recreations in any medium or technology, including but
                not limited to spreadsheets, web applications, scripts, printed forms, and manual
                calculation templates.
              </p>
            </section>

            {/* 3 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                3. License to Use
              </h3>
              <p>
                Subject to your compliance with these Terms, ARE grants you a limited,
                non-exclusive, non-transferable, revocable license to use the Calculators solely
                for your own internal structural engineering design and review purposes. This license
                does not permit sublicensing, redistribution, or use in a service offered to third
                parties.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                4. Design Aide Only — Required PE Verification
              </h3>
              <p>
                <strong>The Calculators are design aides only.</strong> They are provided to assist
                qualified users in preliminary analysis and design and are not a substitute for
                independent engineering judgment or a final stamped design. All results must be
                independently reviewed, checked, and confirmed by a Professional Engineer
                (&ldquo;PE&rdquo;) licensed in the state or jurisdiction in which the work is being
                performed before any result is incorporated into construction documents, relied upon
                for permitting, or used to direct any construction activity.
              </p>
              <p className="mt-2">
                ARE makes no representation or warranty, express or implied, as to the accuracy,
                completeness, reliability, or fitness for any particular purpose of any Calculator
                or its output. Output may contain errors and must never be used without independent
                verification by a licensed PE.
              </p>
            </section>

            {/* 5 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                5. Assumption of All Liability by User
              </h3>
              <p>
                <strong>
                  By using the Calculators, you expressly assume all liability arising from or
                  related to your use of, or reliance on, any Calculator output.
                </strong>{" "}
                ARE, its principals, employees, and agents shall have no liability whatsoever —
                whether in contract, tort, negligence, strict liability, or otherwise — for any
                losses, damages, injuries, claims, costs, or expenses (including professional
                liability claims) resulting from your use of the Calculators or your failure to
                obtain independent verification by a licensed PE. You agree to indemnify and hold
                harmless ARE from any and all claims arising from your use of the Calculators.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                6. Confidentiality
              </h3>
              <p>
                The Calculators, their underlying logic, and any non-public information about their
                methodology are confidential and proprietary to ARE. You agree to maintain the
                confidentiality of such information and not to disclose it to any third party
                without ARE&rsquo;s prior written consent.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                7. Limitation of Liability
              </h3>
              <p>
                To the fullest extent permitted by law, ARE shall not be liable for any direct,
                indirect, incidental, special, consequential, or punitive damages arising from your
                use of the Calculators, including reliance on any output for design or construction
                decisions.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                8. Termination
              </h3>
              <p>
                ARE reserves the right to revoke access at any time, for any reason, without
                notice. Violation of any of these Terms — particularly the prohibition on
                reproduction — will result in immediate termination of access and may subject you to
                legal action.
              </p>
            </section>

            {/* 9 */}
            <section>
              <h3
                className="font-bold text-[11px] uppercase tracking-wider mb-1"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                9. Governing Law
              </h3>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the
                State of California, without regard to its conflict of law provisions.
              </p>
            </section>
          </div>
        </div>

        {/* ── Footer / Agreement ── */}
        <div
          className="shrink-0 px-6 py-5 border-t flex flex-col gap-4"
          style={{ borderColor: "var(--are-border)", background: "#f9fafc" }}
        >
          {/* Checkbox */}
          <label
            className="flex items-start gap-3 cursor-pointer select-none"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              style={{ width: 16, height: 16, accentColor: "var(--are-navy)", cursor: "pointer" }}
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="text-xs leading-relaxed" style={{ color: "#374151" }}>
              I have read, understood, and agree to all Terms of Use above. I acknowledge that{" "}
              <strong style={{ color: "var(--are-navy)" }}>
                Anderson Rohr Engineers retains all rights to all Calculators
              </strong>
              , I agree not to reproduce or recreate any Calculator in style, form, or function, I
              understand that{" "}
              <strong style={{ color: "var(--are-navy)" }}>
                the Calculators are design aides only
              </strong>{" "}
              that must be verified by a PE licensed in the state of the project, and I{" "}
              <strong style={{ color: "var(--are-navy)" }}>
                assume all liability
              </strong>{" "}
              for my use of these tools.
            </span>
          </label>

          {/* Signature */}
          <div>
            <label
              htmlFor="terms-signature"
              className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
            >
              Your Full Name (Signature)
            </label>
            <input
              id="terms-signature"
              type="text"
              placeholder="Type your full name to sign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canAccept) handleAccept(); }}
              className="w-full rounded-md px-3 py-2 text-sm outline-none transition-all"
              style={{
                border: "1.5px solid var(--are-border)",
                fontFamily: "var(--font-dm-sans)",
                color: "var(--are-navy)",
                background: "#fff",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--are-navy-mid)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--are-border)")}
              autoComplete="name"
            />
          </div>

          {/* Accept button */}
          <button
            type="button"
            onClick={handleAccept}
            disabled={!canAccept || submitted}
            className="w-full py-2.5 rounded-md text-sm font-bold uppercase tracking-wider transition-all"
            style={{
              fontFamily: "var(--font-archivo)",
              background: canAccept && !submitted ? "var(--are-navy)" : "var(--are-border)",
              color: canAccept && !submitted ? "#fff" : "var(--are-muted)",
              cursor: canAccept && !submitted ? "pointer" : "not-allowed",
              letterSpacing: "0.08em",
            }}
          >
            {submitted ? "✓  Agreement Recorded" : "I Agree — Access Calculators"}
          </button>

          <p
            className="text-center text-[9px]"
            style={{ color: "var(--are-muted)", fontFamily: "var(--font-dm-sans)" }}
          >
            This agreement is stored locally on your device. You will not be asked again on this
            browser.
          </p>
        </div>
      </div>
    </div>
  );
}
