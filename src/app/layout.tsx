import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/themes/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Boyani Health Dispensary — Quality Care, Compassionate Service",
    template: "%s | Boyani Health Dispensary",
  },
  description:
    "Boyani Health Dispensary, Vihiga — comprehensive healthcare services including nursing care, clinical services, laboratory, maternity, pharmacy and emergency care.",
  keywords: ["nursing home", "clinic", "healthcare", "Vihiga", "Kenya", "booking", "Boyani Health Dispensary"],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Boyani Health Dispensary",
    description: "Quality Care, Compassionate Service — book appointments, explore services, meet our doctors.",
    siteName: "Boyani Health Dispensary",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
