import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/app/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { getLocale } from "@/lib/i18n";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Alacore — B2B tahsilat asistanı", template: "%s · Alacore" },
  description: "Vadesi gelen ve geciken B2B faturalarınızı takip eden, müşterilerinizle iletişim kuran yapay zekâ destekli tahsilat platformu.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${jakarta.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
