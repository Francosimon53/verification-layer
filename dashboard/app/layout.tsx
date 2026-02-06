import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "VLayer - HIPAA Compliance Dashboard",
  description: "HIPAA compliance monitoring platform for healthcare developers. Track violations, compliance scores, and audit reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-[#0F172A]`}>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
