import type { Metadata } from "next";
import { Lora, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rajdip Parmar | Software Engineer | Full-Stack, Mobile & GIS Specialist",
  description:
    "Portfolio of Rajdip Parmar, Software Engineer with 3+ years experience in Angular, React, Ionic, TypeScript, and enterprise GIS architectures serving 5,000+ daily active users.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${geistSans.variable} ${geistMono.variable} bg-[#1A1A1A] text-[#D6D6D6] antialiased`}
    >
      <body className="min-h-full bg-[#1A1A1A] text-[#D6D6D6] font-sans">
        {children}
      </body>
    </html>
  );
}
