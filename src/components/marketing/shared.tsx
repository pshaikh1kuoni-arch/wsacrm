// Small building blocks shared between the marketing homepage and any
// other surface that reuses a piece of it verbatim (e.g. the sign-in
// page's showcase panel) — kept here so both stay pixel-identical
// instead of drifting apart as two copies.

export const DISPLAY_FONT = "font-[family-name:var(--font-display)]";

export function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`bg-gradient-to-r from-primary to-primary-2 bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold tracking-wider text-primary uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </span>
  );
}
