import {
  Megaphone,
  MessageSquare,
  Columns3,
  Zap,
  Radio,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { DISPLAY_FONT, Eyebrow } from "./shared";

// `angle` is precomputed (atan2(uy, ux) in degrees) rather than
// derived at render time — Math.atan2 can differ in its last few
// decimal digits between the server's V8 and the browser's, which
// React flags as a hydration mismatch when the number lands in an
// inline style. Fixed literals sidestep that entirely.
const SPOKES = [
  { key: "marketing", label: "Marketing", icon: Megaphone, ux: 0, uy: -1, angle: -90 },
  { key: "inbox", label: "Inbox", icon: MessageSquare, ux: 0.7818, uy: -0.6235, angle: -38.57 },
  { key: "pipeline", label: "Pipeline", icon: Columns3, ux: 0.9749, uy: 0.2225, angle: 12.86 },
  { key: "automations", label: "Automations", icon: Zap, ux: 0.4339, uy: 0.901, angle: 64.29 },
  { key: "broadcasts", label: "Broadcasts", icon: Radio, ux: -0.4339, uy: 0.901, angle: 115.71 },
  { key: "utility", label: "Utility", icon: Clock, ux: -0.9749, uy: 0.2225, angle: 167.14 },
  { key: "auth", label: "Auth", icon: ShieldCheck, ux: -0.7818, uy: -0.6235, angle: 218.57 },
] as const;

/**
 * The "WAGenie sits at the center of every conversation" glass card —
 * eyebrow + heading + subtext + the animated hub-and-spoke diagram.
 * Deliberately just the card (no outer section/max-width), so it can
 * sit full-width on the homepage or half-width on the sign-in page's
 * showcase panel without two copies drifting apart. Needs a
 * `.wag-landing` ancestor for its scoped tokens (--wsurface, --wink,
 * etc.) and reads the app's real --primary/--primary-2 directly.
 */
export function HubDiagramCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-[28px] border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] p-6 shadow-[0_16px_40px_-14px_var(--wshadow-2),0_2px_10px_var(--wshadow-1)] backdrop-blur-xl sm:p-11 ${className}`}
    >
      <div className="mx-auto mb-8 max-w-xl text-center">
        <Eyebrow>One AI, every message category</Eyebrow>
        <h2 className={`${DISPLAY_FONT} text-3xl font-bold text-[var(--wink)] sm:text-4xl`}>
          WAGenie sits at the center of every conversation
        </h2>
        <p className="mt-3.5 text-[17px] text-[var(--wink-soft)]">
          One AI reasoning over Marketing, Utility, and Authentication messages, feeding every other part of the product in real time.
        </p>
      </div>

      <div className="relative mx-auto h-[300px] w-full max-w-[520px] sm:h-[440px] [--node:64px] [--r:120px] sm:[--node:96px] sm:[--r:190px]">
        {/* pulse ring */}
        <div className="absolute top-1/2 left-1/2 h-[112px] w-[112px] -translate-x-1/2 -translate-y-1/2 animate-[wag-ring-out_3.2s_ease-out_infinite] rounded-full border border-primary sm:h-[170px] sm:w-[170px]" />

        {/* spoke lines */}
        {SPOKES.map((s, i) => (
          <div
            key={s.key}
            className="absolute top-1/2 left-1/2 h-0.5 origin-left bg-[repeating-linear-gradient(90deg,var(--wglass-edge)_0_6px,transparent_6px_11px)]"
            style={{ width: "var(--r)", transform: `rotate(${s.angle}deg)` }}
          >
            <i
              className="absolute -top-0.5 left-[6%] h-1.5 w-1.5 animate-[wag-travel_2.8s_linear_infinite] rounded-full bg-primary-2"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          </div>
        ))}

        {/* spoke nodes */}
        {SPOKES.map((s) => (
          <div
            key={s.key}
            className="absolute grid h-[var(--node)] w-[var(--node)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--wsurface)] p-1.5 text-center shadow-[0_10px_24px_-14px_var(--wshadow-2)] transition-transform duration-300 hover:z-10 hover:scale-110"
            style={{ left: `calc(50% + ${s.ux} * var(--r))`, top: `calc(50% + ${s.uy} * var(--r))` }}
          >
            <s.icon className="h-3.5 w-3.5 text-primary sm:h-[18px] sm:w-[18px]" />
            <b className="mt-1 text-[8px] leading-tight font-bold text-[var(--wink)] sm:text-[10.5px]">{s.label}</b>
          </div>
        ))}

        {/* hub */}
        <div
          className="absolute top-1/2 left-1/2 grid h-[112px] w-[112px] -translate-x-1/2 -translate-y-1/2 place-content-center place-items-center rounded-full p-2.5 text-center text-white shadow-[0_18px_40px_-16px_rgba(31,154,88,0.55)] sm:h-[170px] sm:w-[170px]"
          style={{ background: "radial-gradient(circle at 32% 28%, var(--primary-2), var(--primary) 70%)" }}
        >
          <b className={`${DISPLAY_FONT} text-[12px] leading-tight font-bold sm:text-[17px]`}>
            WAGenie
            <br />
            AI
          </b>
          <span className="mt-1.5 hidden items-center gap-1.5 text-[10.5px] opacity-85 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-[wag-live-pulse_2s_infinite] rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
      </div>
    </div>
  );
}
