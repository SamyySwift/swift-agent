import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Swift Agent",
  description:
    "AI-powered Supabase management agent — create projects, run SQL, manage databases with natural language.",
  keywords: ["AI agent", "Supabase", "LangGraph", "database", "SQL"],
  openGraph: {
    title: "Swift Agent",
    description: "AI-powered Supabase management with human-in-the-loop approvals.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
      style={{ colorScheme: "dark" }}
    >
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
