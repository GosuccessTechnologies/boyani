'use client';

/**
 * PWA INSTALL PROMPT — listens for 'beforeinstallprompt', stores the event and
 * shows an "Install App" button while it is available. Hidden once installed
 * (the browser stops firing the event) or after dismissal.
 */

import * as React from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini-infobar out of the way
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const installed = () => setHidden(true);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (!deferred || hidden) return null;

  const install = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setHidden(true);
    } catch { /* user dismissed */ }
    setDeferred(null);
  };

  return (
    <div className="rounded-xl border border-[var(--mc-primary)] bg-[var(--mc-primary-light)] p-2.5 flex items-center gap-2.5">
      <Download className="h-5 w-5 text-[var(--mc-primary-dark)] shrink-0" />
      <p className="text-xs text-[var(--mc-primary-dark)] font-semibold flex-1 min-w-0">
        Install the Attendance app on this phone for one-tap daily check-in.
      </p>
      <button
        type="button"
        onClick={install}
        className="h-11 px-4 rounded-xl mc-gradient-primary text-white text-xs font-bold shrink-0"
      >
        Install App
      </button>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={() => setDeferred(null)}
        className="h-11 w-11 flex items-center justify-center rounded-xl text-[var(--mc-primary-dark)] shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
