import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicListing, getPublicListingSummary } from "@/lib/public-listings";
import { getSiteBaseUrl } from "@/lib/site-url";
import { ListingGallery } from "@/app/listing-gallery";
import { ThemeToggle } from "@/app/theme-toggle";

// Reuse rendered public detail pages briefly; signed photo URLs remain valid for one hour.
export const revalidate = 60;

type ListingPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  const property = await getPublicListingSummary(id);
  if (!property) return { title: "Imóvel não encontrado | De Imóveis" };
  return {
    title: `${property.title} | De Imóveis`,
    description: property.description?.slice(0, 155) || `Veja os detalhes do imóvel ${property.title}.`,
    alternates: { canonical: `/anuncio/${id}` },
    openGraph: {
      type: "website",
      siteName: "De Imóveis",
      title: `${property.title} | De Imóveis`,
      description: property.description?.slice(0, 155) || `Veja os detalhes do imóvel ${property.title}.`,
      url: new URL(`/anuncio/${id}`, getSiteBaseUrl()).toString(),
    },
  };
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const typeLabels: Record<string, string> = { apartamento: "Apartamento", casa: "Casa", terreno: "Terreno", comercial: "Comercial", rural: "Rural" };

function formatPrice(price: number | null, purpose: string) {
  if (price === null) return "Consulte o valor";
  return `${money.format(price)}${purpose === "aluguel" ? " / mês" : ""}`;
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  const property = await getPublicListing(id);
  if (!property) notFound();

  const price = property.purpose === "aluguel" ? property.rent_price : property.sale_price ?? property.rent_price;
  const location = [property.neighborhood, property.city, property.state].filter(Boolean).join(" · ");
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const message = encodeURIComponent(`Olá! Tenho interesse no imóvel ${property.internal_code} — ${property.title}.`);
  const features: { label: string; value: string | number }[] = [];
  if (property.bedrooms !== null) features.push({ label: "Quartos", value: property.bedrooms });
  if (property.suites !== null) features.push({ label: "Suítes", value: property.suites });
  if (property.bathrooms !== null) features.push({ label: "Banheiros", value: property.bathrooms });
  if (property.parking_spaces !== null) features.push({ label: "Vagas", value: property.parking_spaces });
  if (property.total_area !== null) features.push({ label: "Área total", value: `${property.total_area} m²` });
  if (property.built_area !== null) features.push({ label: "Área construída", value: `${property.built_area} m²` });
  if (property.condo_fee !== null) features.push({ label: "Condomínio", value: money.format(property.condo_fee) });
  if (property.property_tax !== null) features.push({ label: "IPTU", value: money.format(property.property_tax) });

  return (
    <main className="estate-site estate-detail">
      <header className="estate-header">
        <div className="estate-container estate-header__inner">
          <Link className="estate-brand" href="/" aria-label="De Imóveis, início"><Image src="/site/logo.png" alt="De Imóveis — Gestores Imobiliários" width={963} height={259} priority style={{ width: "100%", height: "auto" }} /></Link>
          <nav className="estate-nav" aria-label="Navegação principal"><Link href="/#imoveis">Imóveis</Link><Link href="/#sobre">Sobre</Link></nav>
          <ThemeToggle />
          <Link className="estate-header__action" href="/login">Área do corretor <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <div className="estate-container estate-detail__container">
        <div className="estate-breadcrumb"><Link href="/">Início</Link><span>/</span><Link href="/#imoveis">Imóveis</Link><span>/</span><span>{property.internal_code}</span></div>
        <div className="estate-detail__heading"><div><span className="estate-eyebrow">{typeLabels[property.property_type] ?? property.property_type} <span className="estate-detail__separator">·</span> {property.purpose === "aluguel" ? "Locação" : property.purpose === "ambos" ? "Venda e locação" : "Venda"}</span><h1>{property.title}</h1><p className="estate-detail__location">{location || "Localização sob consulta"}</p></div><span className="estate-detail__code">Cód. {property.internal_code}</span></div>

        {property.photos.length > 0 ? <ListingGallery photos={property.photos} title={property.title} /> : (
          <div className="estate-detail__no-photo"><span>As fotos deste imóvel estarão disponíveis em breve.</span></div>
        )}

        <div className="estate-detail__content">
          <section className="estate-detail__main">
            <div className="estate-detail__summary"><div><span className="estate-card__price-label">{property.purpose === "aluguel" ? "Locação" : "Valor do imóvel"}</span><strong>{formatPrice(price, property.purpose)}</strong>{property.purpose === "ambos" && property.rent_price !== null && <span className="estate-detail__second-price">Locação: {formatPrice(property.rent_price, "aluguel")}</span>}</div><span className="estate-detail__status">Disponível</span></div>
            {features.length > 0 && <div className="estate-feature-grid">{features.map((feature) => <div key={feature.label}><span>{feature.label}</span><strong>{feature.value}</strong></div>)}</div>}
            {property.description && <section className="estate-description"><span className="estate-eyebrow">Sobre o imóvel</span><h2>Um pouco mais sobre este espaço</h2><p>{property.description}</p></section>}
            <Link className="estate-back-link" href="/#imoveis">← Voltar para os imóveis</Link>
          </section>
          <aside className="estate-contact-card"><span className="estate-contact-card__icon">✳</span><span className="estate-eyebrow">{whatsapp ? "Vamos conversar?" : "Mais possibilidades"}</span><h2>{whatsapp ? "Gostou deste imóvel?" : "Encontre outras opções."}</h2><p>{whatsapp ? "Fale com a nossa equipe para saber mais e combinar uma visita." : "Explore os outros imóveis disponíveis na vitrine."}</p>{whatsapp ? <a className="estate-button estate-button--wide" href={`https://wa.me/${whatsapp}?text=${message}`} target="_blank" rel="noreferrer">Tenho interesse <span aria-hidden="true">↗</span></a> : <Link className="estate-button estate-button--wide" href="/#imoveis">Ver outros imóveis <span aria-hidden="true">↗</span></Link>}<small>Referência: {property.internal_code}</small></aside>
        </div>
      </div>

      <footer className="estate-footer"><div className="estate-container estate-footer__inner"><Link className="estate-brand estate-brand--footer" href="/" aria-label="De Imóveis, início"><Image src="/site/logo.png" alt="De Imóveis — Gestores Imobiliários" width={963} height={259} style={{ width: "100%", height: "auto" }} /></Link><p>Um bom lugar abre espaço para novas histórias.</p><div><Link href="/#imoveis">Imóveis</Link><Link href="/#sobre">Sobre</Link><Link href="/login">Área do corretor</Link></div><small>© {new Date().getFullYear()} De Imóveis. Todos os direitos reservados.</small></div></footer>
    </main>
  );
}
