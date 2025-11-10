import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIVA",
  description: "Chat with AIVA, your AI assistant",
  manifest: "/manifest.json",
  themeColor: "#faf9f5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AIVA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=overlays-content" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent all zoom attempts
              document.addEventListener('gesturestart', function(e) {
                e.preventDefault();
              });
              document.addEventListener('gesturechange', function(e) {
                e.preventDefault();
              });
              document.addEventListener('gestureend', function(e) {
                e.preventDefault();
              });

              // Prevent double-tap zoom
              let lastTouchEnd = 0;
              document.addEventListener('touchend', function(event) {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                  event.preventDefault();
                }
                lastTouchEnd = now;
              }, false);

              // Lock viewport scale
              const lockViewport = () => {
                const viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                  viewport.setAttribute('content',
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=overlays-content'
                  );
                }
              };

              // Lock on load and periodically check
              lockViewport();
              setInterval(lockViewport, 1000);
            `,
          }}
        />
        <link rel="icon" href="/aiva-icon.png" />
        <link rel="apple-touch-icon" href="/aiva-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}

              // Register service worker for PWA
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('ServiceWorker registered:', registration.scope);
                  }).catch(function(err) {
                    console.log('ServiceWorker registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
