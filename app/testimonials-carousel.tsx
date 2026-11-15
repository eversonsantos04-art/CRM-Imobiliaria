"use client";

import Image from "next/image";
import { useState } from "react";

const testimonials = [
  {
    name: "Mariana Costa",
    context: "Comprou apartamento em SP",
    image: "/site/avatar-1.jpg",
    quote: "Do primeiro contato à entrega das chaves, tudo foi transparente. A corretora negociou um desconto que eu nem imaginava ser possível.",
  },
  {
    name: "Rafael Almeida",
    context: "Investidor · 3 imóveis",
    image: "/site/avatar-2.jpg",
    quote: "A análise de rentabilidade que recebi foi decisiva. Hoje tenho três imóveis alugados com retorno acima do mercado.",
  },
  {
    name: "Família Nogueira",
    context: "Vendeu casa em Curitiba",
    image: "/site/avatar-3.jpg",
    quote: "Anunciaram numa sexta e em 20 dias já tínhamos proposta acima do pedido. Fotos profissionais fizeram toda a diferença.",
  },
  {
    name: "Juliana Prado",
    context: "Alugou loft em POA",
    image: "/site/avatar-4.jpg",
    quote: "Processo 100% digital, sem fiador e sem dor de cabeça. Assinei o contrato no mesmo dia da visita. Recomendo de olhos fechados.",
  },
];

export function TestimonialsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = testimonials[activeIndex];

  function show(offset: number) {
    setActiveIndex((current) => (current + offset + testimonials.length) % testimonials.length);
  }

  return <>
    <div className="estate-review-slider">
      <button className="estate-review-slider__button" type="button" onClick={() => show(-1)} aria-label="Depoimento anterior">‹</button>
      <div className="estate-review-slider__viewport">
        <article key={active.name} className="estate-review-card" aria-live="polite">
          <div className="estate-review-card__stars" aria-label="5 de 5 estrelas">★★★★★</div>
          <blockquote>“{active.quote}”</blockquote>
          <div className="estate-review-card__who">
            <Image src={active.image} alt={`Foto de ${active.name}`} width={56} height={56} />
            <strong>{active.name}</strong>
            <span>{active.context}</span>
          </div>
        </article>
      </div>
      <button className="estate-review-slider__button" type="button" onClick={() => show(1)} aria-label="Próximo depoimento">›</button>
    </div>
    <div className="estate-review-slider__dots" role="group" aria-label="Escolher depoimento">
      {testimonials.map((item, index) => <button key={item.name} type="button" aria-label={`Depoimento ${index + 1}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)} />)}
    </div>
  </>;
}
