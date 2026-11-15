import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/app/theme-toggle";

export default function ListingNotFound() {
  return (
    <main className="estate-site estate-detail">
      <header className="estate-header">
        <div className="estate-container estate-header__inner">
          <Link className="estate-brand" href="/" aria-label="De Imóveis, início">
            <Image src="/site/logo.png" alt="De Imóveis — Gestores Imobiliários" width={963} height={259} priority style={{ width: "100%", height: "auto" }} />
          </Link>
          <nav className="estate-nav" aria-label="Navegação principal">
            <Link href="/#imoveis">Imóveis</Link>
            <Link href="/#sobre">Sobre</Link>
          </nav>
          <ThemeToggle />
          <Link className="estate-header__action" href="/login">Área do corretor <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <section className="estate-container estate-not-found" aria-labelledby="listing-not-found-title">
        <span className="estate-eyebrow">Anúncio indisponível</span>
        <h1 id="listing-not-found-title">Este imóvel não está mais na vitrine.</h1>
        <p>Ele pode ter sido alugado, vendido ou reservado. Veja as outras opções disponíveis.</p>
        <Link className="estate-button" href="/#imoveis">Ver imóveis disponíveis <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="estate-footer">
        <div className="estate-container estate-footer__inner">
          <Link className="estate-brand estate-brand--footer" href="/" aria-label="De Imóveis, início">
            <Image src="/site/logo.png" alt="De Imóveis — Gestores Imobiliários" width={963} height={259} style={{ width: "100%", height: "auto" }} />
          </Link>
          <p>Um bom lugar abre espaço para novas histórias.</p>
          <div><Link href="/#imoveis">Imóveis</Link><Link href="/#sobre">Sobre</Link></div>
          <small>© {new Date().getFullYear()} De Imóveis. Todos os direitos reservados.</small>
        </div>
      </footer>
    </main>
  );
}
