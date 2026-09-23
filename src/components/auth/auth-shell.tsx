import Image from "next/image";
import Link from "next/link";

/**
 * Shared chrome for the public auth pages (login, signup,
 * forgot-password) — purely visual, so these screens read as the same
 * product as the marketing homepage. Reuses the app's real
 * `--primary`/`--primary-2` tokens (mode-aware, whatever accent is
 * active), unlike the homepage's own light-only canvas, since these
 * pages still respect the app's light/dark mode setting.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-28 h-[420px] w-[420px] rounded-full bg-primary opacity-20 blur-[100px]" />
        <div className="absolute top-1/3 -right-28 h-[380px] w-[380px] rounded-full bg-primary-2 opacity-20 blur-[100px]" />
      </div>
      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <Link href="/" aria-label="WAGenie home">
          <Image
            src="/brand/wagenie-logo.png"
            alt="WAGenie"
            width={172}
            height={31}
            className="h-8 w-auto"
            priority
          />
        </Link>
        {children}
      </div>
    </div>
  );
}
