import type { ReactNode } from 'react';

/** Layout centré des pages d'authentification, sans navigation applicative. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-accent/30 to-secondary/25 p-4">
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
        <div className="obr-curtain-left absolute inset-y-0 left-0 flex w-1/2 items-center justify-end border-r border-white/20 bg-primary px-8 text-primary-foreground sm:px-14">
          <span className="text-4xl font-black tracking-[0.2em] sm:text-6xl">OBR</span>
        </div>
        <div className="obr-curtain-right absolute inset-y-0 right-0 flex w-1/2 items-center justify-start border-l border-white/20 bg-secondary px-8 text-secondary-foreground sm:px-14">
          <span className="text-3xl font-bold tracking-[0.18em] sm:text-5xl">AMS</span>
        </div>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </main>
  );
}