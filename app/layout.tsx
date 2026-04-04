import type { Metadata } from "next";
import { Inter, Space_Grotesk, Roboto_Mono } from "next/font/google";
import Header from "@/components/Header";
import AppProvider from "@/components/AppProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  title: "Sky Balloons Web",
  description: "The Ethereal Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${robotoMono.variable} antialiased font-sans text-on_surface bg-surface isolate`}
      >
        <AppProvider>
          <Header />
          <div className="pt-2">
            {children}
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
