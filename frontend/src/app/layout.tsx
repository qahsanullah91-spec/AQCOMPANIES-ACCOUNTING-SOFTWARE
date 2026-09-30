import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayoutShell } from "@/components/AppLayoutShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F19" },
  ],
};

export const metadata: Metadata = {
  title: "AQ COMPANIES — Trading • Logistics • Accounting",
  description: "AQ COMPANIES Dry Fruit Trading, Container Management & Accounting System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AQ COMPANIES",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('aq_theme');
                  var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased font-sans flex min-h-screen min-h-screen-dvh bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 selection:bg-sky-500/20">
        <ThemeProvider>
          <NetworkProvider>
            <AuthProvider>
              <AppLayoutShell>{children}</AppLayoutShell>
            </AuthProvider>
          </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
