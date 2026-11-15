"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicPropertyCard } from "@/lib/public-listings";

const typeLabels: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  terreno: "Terreno",
  comercial: "Comercial",
  rural: "Rural",
};

const purposeLabels: Record<string, string> = {
  venda: "À venda",
  aluguel: "Para alugar",
  ambos: "Venda e locação",
};

type CatalogFilters = {
  search: string;
  purpose: string;
  type: string;
  city: string;
  minimumPrice: string;
  maximumPrice: string;
  minimumBedrooms: string;
  sort: string;
};

const emptyFilters: CatalogFilters = {
  search: "", purpose: "", type: "", city: "", minimumPrice: "", maximumPrice: "", minimumBedrooms: "", sort: "recent",
};

function hasCatalogFilters(filters: CatalogFilters) {
  return Boolean(filters.search || filters.purpose || filters.type || filters.city || filters.minimumPrice || filters.maximumPrice || filters.minimumBedrooms || filters.sort !== "recent");
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function mainPrice(property: PublicPropertyCard) {
  if (property.purpose === "aluguel") return property.rent_price;
  return property.sale_price ?? property.rent_price;
}

function priceLabel(property: PublicPropertyCard) {
  const price = mainPrice(property);
  if (price === null) return "Consulte o valor";
  return `${money.format(price)}${property.purpose === "aluguel" ? " / mês" : ""}`;
}

function locationLabel(property: PublicPropertyCard) {
  return [property.neighborhood, property.city, property.state].filter(Boolean).join(", ");
}

function PropertyCard({ property }: { property: PublicPropertyCard }) {
  const cover = property.photos[0];

  return (
    <article className="estate-card">
      <Link className="estate-card__visual" href={`/anuncio/${property.id}`} aria-label={`Ver ${property.title}`}>
        {cover ? (
          // A URL assinada é criada no servidor depois que o anúncio passa pela view pública.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={cover.caption || property.title} loading="lazy" />
        ) : (
          <span className="estate-card__placeholder" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none"><path d="M7 21.5 24 8l17 13.5V41H7V21.5Z"/><path d="M18 41V27h12v14M14 21h.01M34 21h.01"/></svg>
            <span>Foto em breve</span>
          </span>
        )}
        <span className="estate-card__badge">{purposeLabels[property.purpose] ?? "Disponível"}</span>
      </Link>
      <div className="estate-card__body">
        <div className="estate-card__type">{typeLabels[property.property_type] ?? property.property_type}</div>
        <h3><Link href={`/anuncio/${property.id}`}>{property.title}</Link></h3>
        <p className="estate-card__location">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 8.2c0 4.1-6 9.2-6 9.2S4 12.3 4 8.2a6 6 0 1 1 12 0Z"/><circle cx="10" cy="8" r="2"/></svg>
          {locationLabel(property) || "Localização sob consulta"}
        </p>
        <div className="estate-card__facts">
          {property.bedrooms !== null && property.bedrooms > 0 && <span><strong>{property.bedrooms}</strong> quartos</span>}
          {property.built_area !== null && property.built_area > 0 && <span><strong>{property.built_area}</strong> m²</span>}
          {property.parking_spaces !== null && property.parking_spaces > 0 && <span><strong>{property.parking_spaces}</strong> vagas</span>}
        </div>
        <div className="estate-card__bottom">
          <div><span className="estate-card__price-label">{property.purpose === "aluguel" ? "Locação" : "Valor"}</span><strong className="estate-card__price">{priceLabel(property)}</strong>{property.purpose === "ambos" && property.rent_price !== null && <span className="estate-card__second-price">Locação: {money.format(property.rent_price)} / mês</span>}</div>
          <Link className="estate-card__arrow" href={`/anuncio/${property.id}`} aria-label={`Detalhes de ${property.title}`}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12M10 4l6 6-6 6"/></svg>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PropertyCatalog({ properties, connected }: { properties: PublicPropertyCard[]; connected: boolean }) {
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<CatalogFilters>(emptyFilters);

  const cities = useMemo(
    () => [...new Set(properties.map((property) => property.city).filter((value): value is string => Boolean(value)))].sort(),
    [properties],
  );

  const filtered = useMemo(() => {
    const query = appliedFilters.search.trim().toLocaleLowerCase("pt-BR");
    const minimum = appliedFilters.minimumPrice === "" ? null : Number(appliedFilters.minimumPrice);
    const maximum = appliedFilters.maximumPrice === "" ? null : Number(appliedFilters.maximumPrice);
    const minimumBeds = appliedFilters.minimumBedrooms === "" ? null : Number(appliedFilters.minimumBedrooms);
    const matches = properties.filter((property) => {
      const haystack = [property.title, property.internal_code, property.neighborhood, property.city, property.state]
        .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      const matchesPurpose = !appliedFilters.purpose || property.purpose === appliedFilters.purpose || property.purpose === "ambos";
      const price = mainPrice(property);
      return matchesPurpose
        && (!appliedFilters.type || property.property_type === appliedFilters.type)
        && (!appliedFilters.city || property.city === appliedFilters.city)
        && (!query || haystack.includes(query))
        && (minimum === null || (price !== null && price >= minimum))
        && (maximum === null || (price !== null && price <= maximum))
        && (minimumBeds === null || (property.bedrooms !== null && property.bedrooms >= minimumBeds));
    });

    if (appliedFilters.sort === "price-low") return matches.sort((a, b) => (mainPrice(a) ?? Number.MAX_VALUE) - (mainPrice(b) ?? Number.MAX_VALUE));
    if (appliedFilters.sort === "price-high") return matches.sort((a, b) => (mainPrice(b) ?? -1) - (mainPrice(a) ?? -1));
    if (appliedFilters.sort === "area") return matches.sort((a, b) => (b.built_area ?? b.total_area ?? 0) - (a.built_area ?? a.total_area ?? 0));
    return matches.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [appliedFilters, properties]);

  function resetFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  const hasFilters = hasCatalogFilters(filters) || hasCatalogFilters(appliedFilters);

  return (
    <section className="estate-listings" id="imoveis">
      <div className="estate-container">
        <div className="estate-section-heading">
          <div><span className="estate-eyebrow">Uma boa escolha começa aqui</span><h2>Imóveis em destaque</h2><p>Encontre um espaço que combine com a vida que você quer viver.</p></div>
          <div className="estate-section-heading__tools">{hasFilters && <button className="estate-clear-filters" type="button" onClick={resetFilters}>Limpar filtros</button>}<span className="estate-results-count">{filtered.length} {filtered.length === 1 ? "imóvel" : "imóveis"}</span></div>
        </div>

        <form className="estate-search-form" role="search" aria-label="Filtrar imóveis" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...filters }); }}>
        <div className="estate-filters">
          <label className="estate-search-field"><span className="sr-only">Buscar por imóvel, bairro ou cidade</span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8"/><path d="m13 13 4 4"/></svg><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Buscar imóvel, bairro ou cidade" /></label>
          <label><span className="estate-filter-caption">Operação</span><select aria-label="Tipo de negócio" value={filters.purpose} onChange={(event) => setFilters({ ...filters, purpose: event.target.value })}><option value="">Comprar ou alugar</option><option value="venda">Comprar</option><option value="aluguel">Alugar</option></select></label>
          <label><span className="estate-filter-caption">Tipo de imóvel</span><select aria-label="Tipo de imóvel" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">Todos os tipos</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="estate-filter-caption">Cidade</span><select aria-label="Cidade" value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })}><option value="">Todas as cidades</option>{cities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>

        <div className="estate-filters__advanced" aria-label="Filtros adicionais">
          <label><span className="sr-only">Preço mínimo em reais</span><input type="number" min="0" inputMode="numeric" value={filters.minimumPrice} onChange={(event) => setFilters({ ...filters, minimumPrice: event.target.value })} placeholder="Preço mínimo" /></label>
          <label><span className="sr-only">Preço máximo em reais</span><input type="number" min="0" inputMode="numeric" value={filters.maximumPrice} onChange={(event) => setFilters({ ...filters, maximumPrice: event.target.value })} placeholder="Preço máximo" /></label>
          <label><span className="sr-only">Quantidade mínima de quartos</span><select value={filters.minimumBedrooms} onChange={(event) => setFilters({ ...filters, minimumBedrooms: event.target.value })}><option value="">Quartos</option><option value="1">1 ou mais</option><option value="2">2 ou mais</option><option value="3">3 ou mais</option><option value="4">4 ou mais</option></select></label>
          <label><span className="sr-only">Ordenar imóveis</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="recent">Mais recentes</option><option value="price-low">Menor preço</option><option value="price-high">Maior preço</option><option value="area">Maior área</option></select></label>
          <button className="estate-search-submit" type="submit">Pesquisar imóveis</button>
        </div>
        </form>

        {filtered.length > 0 ? (
          <div className="estate-grid">{filtered.map((property) => <PropertyCard key={property.id} property={property} />)}</div>
        ) : (
          <div className="estate-empty">
            <span className="estate-empty__icon"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 21.5 24 8l17 13.5V41H7V21.5Z"/><path d="M18 41V27h12v14"/></svg></span>
            <h3>{connected ? "Nenhum imóvel encontrado" : "Estamos preparando a vitrine"}</h3>
            <p>{connected ? "Tente ajustar os filtros para encontrar outras opções." : "Os imóveis disponíveis aparecerão aqui em breve."}</p>
            {connected && hasFilters && <button className="estate-button estate-button--light" type="button" onClick={resetFilters}>Limpar filtros</button>}
          </div>
        )}
      </div>
    </section>
  );
}
