import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto_Condensed } from "next/font/google";
import "@/app/globals.css";
import "@/app/slodi-tokens.css";
import "@/app/slodi-utilities.css";
import { cn } from "@/lib/util";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeKeyboardShortcuts from "@/components/ThemeKeyboardShortcuts";
import ConditionalLayout from "@/components/ConditionalLayout";
import { LikesProvider } from "@/contexts/LikesContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Analytics } from "@vercel/analytics/next";

// Geist fonts for code/UI elements
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Roboto Condensed for Slóði body text (matches design system)
const robotoCondensed = Roboto_Condensed({
  variable: "--font-roboto-condensed",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Slóði - Meira en bara dagskrárvefur",
    template: "%s | Slóði",
  },
  description:
    "Markmið Slóða er að styðja við foringja í skátastarfi með því að gera dagskrárgerð einfaldari, markvissari og skipulagðari. Safnaðu saman dagskrárhugmyndum, settu saman skipulagða dagskrá og greindu fjölbreytni.",
  keywords: [
    "skátar",
    "dagskrá",
    "dagskrárvefur",
    "dagskrárbanki",
    "skátaforingjar",
    "skátafélög",
    "skátarnir",
    "Slóði",
  ],
  authors: [{ name: "Slóða teymið", url: "https://slodi.is" }],
  creator: "Slóði",
  openGraph: {
    type: "website",
    locale: "is_IS",
    url: "https://slodi.is",
    siteName: "Slóði",
    title: "Slóði - Meira en bara dagskrárvefur",
    description: "Dagskrárgerð fyrir skátaforingja. Einfalt, markviss, skipulagt.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Slóði - Dagskrárvefurinn 2.0",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Slóði - Meira en bara dagskrárvefur",
    description: "Dagskrárgerð fyrir skátaforingja. Einfalt, markviss, skipulagt.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon.png", type: "image/png", sizes: "180x180" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="is" suppressHydrationWarning>
      <body
        className={cn(
          // Font variables
          geistSans.variable,
          geistMono.variable,
          robotoCondensed.variable,
          // Slóði utility classes
          "antialiased",
          "sl-bg-background",
          "sl-text-primary",
          // Layout structure
          "flex",
          "flex-col",
          "min-h-screen",
          // Smooth transitions
          "transition-colors",
          "duration-200"
        )}
      >
        {/* Theme Provider for dark mode, patrol themes, etc. */}
        <AuthProvider>
          <ThemeProvider>
            <LikesProvider>
              <FavoritesProvider>
                {/* Keyboard shortcuts for theme switching */}
                <ThemeKeyboardShortcuts />

                {/* Conditional Layout: decides whether to show header/footer or dashboard layout */}
                <ConditionalLayout>{children}</ConditionalLayout>

                {/* Toast Notifications Container - for future expansion */}
                <div
                  id="toast-container"
                  className={cn(
                    "fixed",
                    "top-4",
                    "right-4",
                    "z-[9999]",
                    "pointer-events-none",
                    "flex",
                    "flex-col",
                    "gap-2",
                    "max-w-md",
                    "w-full"
                  )}
                  role="region"
                  aria-live="polite"
                  aria-label="Tilkynningar"
                />
              </FavoritesProvider>
            </LikesProvider>
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
