import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="pwa-install-banner">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl">
          <Download size={20} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Asenna KuntotarkastusAI</p>
          <p className="text-xs text-blue-100">Toimii kuin natiivi sovellus puhelimessasi</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-white text-blue-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors"
        >
          Asenna
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-200 hover:text-white p-1"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
