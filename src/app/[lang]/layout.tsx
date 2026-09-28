import type { Metadata, Viewport } from "next";
import { Almarai } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getDictionary, isLocale, LOCALES } from "@/i18n/dictionaries";
import "../globals.css";

const almarai = Almarai({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "700", "800"],
  variable: "--font-almarai",
  display: "swap",
});

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    title: { default: t.meta.title, template: `%s · ${t.meta.title}` },
    description: t.meta.description,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#041c54",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <html lang={lang} dir={t.dir} className={`${almarai.variable} antialiased`}>
      <body className="min-h-screen">
        <I18nProvider locale={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
