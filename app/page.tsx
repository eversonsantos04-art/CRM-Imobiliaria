import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicListings } from "@/lib/public-listings";
import { PropertyCatalog } from "./property-catalog";
import { ThemeToggle } from "./theme-toggle";
import { FinanceSimulator } from "./finance-simulator";
import { TestimonialsCarousel } from "./testimonials-carousel";

// Keep public listings responsive while refreshing CRM changes within a minute.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "De Imóveis | Gestores Imobiliários",
  description: "Encontre imóveis para comprar ou alugar e descubra seu próximo lugar para chamar de lar.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "De Imóveis",
    title: "De Imóveis | Gestores Imobiliários",
    description: "Encontre imóveis para comprar ou alugar e descubra seu próximo lugar para chamar de lar.",
    images: ["/site/hero.jpg"],
  },
  twitter: { card: "summary_large_image", images: ["/site/hero.jpg"] },
};

async function LiveCatalog() {
  const { properties, connected } = await getPublicListings();
  return <PropertyCatalog properties={properties} connected={connected} />;
}

function CatalogLoading() {
  return (
    <section className="estate-listings" id="imoveis" aria-label="Catálogo de imóveis">
      <div className="estate-container">
        <div className="estate-section-heading"><div><span className="estate-eyebrow">Uma boa escolha começa aqui</span><h2>Imóveis em destaque</h2><p>Carregando os imóveis disponíveis…</p></div></div>
        <div className="estate-grid estate-grid--loading" aria-hidden="true"><div /><div /><div /></div>
      </div>
    </section>
  );
}

export default async function PublicHomePage() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const contactMessage = encodeURIComponent("Olá! Gostaria de conversar sobre os imóveis disponíveis.");

  return (
    <main className="estate-site">
      <header className="estate-header" id="inicio">
        <div className="estate-container estate-header__inner">
          <Link className="estate-brand" href="/" aria-label="De Imóveis, início">
            <Image src="/site/logo.png" alt="De Imóveis — Gestores Imobiliários" width={963} height={259} priority style={{ width: "100%", height: "auto" }} />
          </Link>
          <nav className="estate-nav" aria-label="Navegação principal">
            <a href="#inicio">Início</a><a href="#imoveis">Imóveis</a><a href="#sobre">Sobre</a><a href="#servicos">Serviços</a><a href="#depoimentos">Depoimentos</a><a href="#contato">Contato</a>
          </nav>
          <ThemeToggle />
          <Link className="estate-header__action" href="/login">Área do corretor <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <Suspense fallback={<CatalogLoading />}><LiveCatalog /></Suspense>

      <section className="estate-about" id="sobre">
        <div className="estate-container estate-about__grid">
          <div className="estate-about__visual"><Image src="/site/hero.jpg" alt="Ambiente residencial iluminado" width={1200} height={900} loading="lazy" /><span>De Imóveis · Gestores Imobiliários</span></div>
          <div className="estate-about__copy"><span className="estate-eyebrow">Sobre a imobiliária</span><h2>Informação clara para escolher com mais tranquilidade.</h2><p>A vitrine apresenta os imóveis disponíveis cadastrados pela equipe, com fotos, características e valores informados em cada anúncio. Consulte os detalhes e encontre opções alinhadas ao que procura.</p><a className="estate-text-link" href="#imoveis">Conhecer imóveis <span aria-hidden="true">↗</span></a></div>
        </div>
      </section>

      <section className="estate-services" id="servicos">
        <div className="estate-container">
          <div className="estate-section-heading"><div><span className="estate-eyebrow">Serviços</span><h2>Encontre opções para cada plano.</h2><p>Explore os anúncios e consulte as informações de cada imóvel.</p></div></div>
          <div className="estate-service-grid">
            <article className="estate-service-card"><span aria-hidden="true">⌂</span><h3>Compra</h3><p>Veja imóveis disponíveis para venda e compare valores, localização e características.</p><a href="#imoveis">Ver opções <span aria-hidden="true">↗</span></a></article>
            <article className="estate-service-card"><span aria-hidden="true">⌑</span><h3>Locação</h3><p>Explore anúncios para alugar e consulte as informações publicadas em cada imóvel.</p><a href="#imoveis">Ver opções <span aria-hidden="true">↗</span></a></article>
            <article className="estate-service-card"><span aria-hidden="true">✳</span><h3>Detalhes do imóvel</h3><p>Abra um anúncio para ver fotos, localização e características disponíveis.</p><a href="#imoveis">Explorar a vitrine <span aria-hidden="true">↗</span></a></article>
          </div>
        </div>
      </section>

      <section className="estate-simulator" id="simulador">
        <div className="estate-container"><FinanceSimulator /></div>
      </section>

      <section className="estate-testimonials" id="depoimentos">
        <div className="estate-container">
          <div className="estate-section-heading"><div><span className="estate-eyebrow">Depoimentos</span><h2>Quem conquistou com a gente</h2></div></div>
          <TestimonialsCarousel />
        </div>
      </section>

      <section className="estate-cta">
        <div className="estate-container estate-cta__inner">
          <div><span className="estate-eyebrow">Seu próximo passo</span><h2>Vamos encontrar um lugar que faça sentido para você?</h2></div>
          <a className="estate-button estate-button--dark" href="#contato">Fale com a equipe <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className="estate-contact" id="contato">
        <div className="estate-container estate-contact__inner"><div><span className="estate-eyebrow">Contato</span><h2>Quer saber mais sobre um imóvel?</h2><p>Consulte os anúncios e fale com a equipe para tirar dúvidas ou combinar uma visita.</p></div>{whatsapp ? <a className="estate-button" href={`https://wa.me/${whatsapp}?text=${contactMessage}`} target="_blank" rel="noreferrer">Falar pelo WhatsApp <span aria-hidden="true">↗</span></a> : <a className="estate-button" href="#imoveis">Ver imóveis disponíveis <span aria-hidden="true">↗</span></a>}</div>
      </section>

      <footer className="estate-footer">
        <div className="estate-container estate-footer__inner">
          <Link className="estate-brand estate-brand--footer" href="/" aria-label="De Imóveis, início"><Image src="/site/logo.png" alt="De Imóveis — Gestores Imobiliários" width={963} height={259} style={{ width: "100%", height: "auto" }} /></Link>
          <p>Um bom lugar abre espaço para novas histórias.</p>
          <div><a href="#imoveis">Imóveis</a><a href="#sobre">Sobre</a><a href="#servicos">Serviços</a><a href="#simulador">Simulador</a><a href="#depoimentos">Depoimentos</a><a href="#contato">Contato</a><Link href="/login">Área do corretor</Link></div>
          <small>© {new Date().getFullYear()} De Imóveis. Todos os direitos reservados.</small>
        </div>
      </footer>
    </main>
  );
}
