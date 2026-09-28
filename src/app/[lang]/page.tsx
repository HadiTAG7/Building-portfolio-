import { notFound } from "next/navigation";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { Workspace } from "@/components/workspace/Workspace";
import { getDictionary, isLocale } from "@/i18n/dictionaries";

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <>
      <Header />
      <main>
        <Hero t={t} locale={lang} />
        <Workspace />
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
