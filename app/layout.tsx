import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND_NAME, HOME_DESCRIPTION, HOME_TITLE, LOGO_PATH, SITE_URL, TITLE_TEMPLATE } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Metadata base del sitio. No se declara `alternates.canonical` aquí: lo
 * heredarían todas las páginas que no definen el suyo y Google las tomaría
 * como copias de la portada. Cada página indexable declara el suyo con
 * `pageMetadata` (lib/seo.ts).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: HOME_DESCRIPTION,
  applicationName: BRAND_NAME,
  category: "shopping",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
  },
  // Token de la verificación por etiqueta HTML de Search Console. La
  // verificación por DNS (propiedad de dominio) no lo necesita.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  icons: {
    icon: LOGO_PATH,
    apple: LOGO_PATH,
  },
};

import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { PresenceTracker } from "@/components/presence/PresenceTracker";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          {children}
          <ChatWidget />
          <PresenceTracker />
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
