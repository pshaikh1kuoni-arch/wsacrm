'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { HubDiagramCard } from '@/components/marketing/hub-diagram';
import { MessageSquare, UsersRound } from 'lucide-react';

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get('invite');
  const t = useTranslations('LoginPage');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Full-page navigation (not router.push) so the browser issues a
    // fresh top-level request that carries the just-written Supabase
    // auth cookies to the middleware gating /dashboard. A soft
    // client-side navigation can reach the protected route before the
    // server observes the new session, so the middleware bounces it
    // back to /login — which looks like the page "just refreshing"
    // instead of signing in (issue #365). Mirrors the deliberate full
    // reload the invite-accept flow already uses in join/[token].
    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : '/dashboard';
    window.location.href = destination;
  };

  return (
    <div className="wag-landing relative flex min-h-screen overflow-hidden">
      {/* One shared background for the whole page — no seam between
          the showcase side and the form side, just one flowing
          canvas both panels sit on top of. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-primary absolute -top-40 -left-36 h-[520px] w-[520px] animate-[wag-drift_26s_ease-in-out_infinite] rounded-full opacity-[.28] blur-[90px]" />
        <div className="bg-primary-2 absolute top-28 -right-40 h-[460px] w-[460px] animate-[wag-drift_26s_ease-in-out_infinite] rounded-full opacity-[.28] blur-[90px] [animation-delay:-8s]" />
        <div className="bg-primary-2 absolute top-[65%] -left-28 h-[440px] w-[440px] animate-[wag-drift_26s_ease-in-out_infinite] rounded-full opacity-20 blur-[100px] [animation-delay:-16s]" />
      </div>

      {/* Left: the same "WAGenie sits at the center of every
          conversation" showcase from the homepage — same content,
          same animation, so signing in re-pitches what you're about
          to use. Hidden below lg: there's no room to do it justice
          on a phone, so mobile just gets the form. */}
      <div className="relative hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:p-10">
        <HubDiagramCard className="relative w-full max-w-[560px]" />
      </div>

      {/* Right: the actual sign-in form — untouched logic, just the
          same logo as every other auth page. */}
      <div className="relative flex w-full flex-col items-center justify-center gap-6 px-4 py-10 lg:w-1/2">
        <Link href="/" aria-label="WAGenie home" className="relative">
          <Image
            src="/brand/wagenie-logo.png"
            alt="WAGenie"
            width={172}
            height={31}
            className="h-8 w-auto"
            priority
          />
        </Link>
        <Card className="relative w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="bg-primary/10 mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
              {inviteToken ? (
                <UsersRound className="text-primary h-6 w-6" />
              ) : (
                <MessageSquare className="text-primary h-6 w-6" />
              )}
            </div>
            <CardTitle className="text-foreground font-[family-name:var(--font-display)] text-xl">
              {inviteToken ? t('titleAccept') : t('titleWelcome')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {inviteToken ? t('descAccept') : t('descWelcome')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-muted-foreground">
                  {t('emailLabel')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-muted-foreground">
                    {t('passwordLabel')}
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-primary hover:text-primary/80 text-sm"
                  >
                    {t('forgotPassword')}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 h-10 w-full disabled:opacity-50"
              >
                {loading ? t('signingIn') : t('signIn')}
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              {t('noAccount')}{' '}
              <Link
                href={
                  inviteToken
                    ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                    : '/signup'
                }
                className="text-primary hover:text-primary/80"
              >
                {t('createAccount')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
