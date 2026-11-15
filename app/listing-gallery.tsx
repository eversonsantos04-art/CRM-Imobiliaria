"use client";

import { useEffect, useRef, useState } from "react";
import type { ListingPhoto } from "@/lib/public-listings";

export function ListingGallery({ photos, title }: { photos: ListingPhoto[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isOpen = activeIndex !== null;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowRight") setActiveIndex((index) => index === null ? null : (index + 1) % photos.length);
      if (event.key === "ArrowLeft") setActiveIndex((index) => index === null ? null : (index - 1 + photos.length) % photos.length);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [isOpen, photos.length]);

  function movePhoto(direction: -1 | 1) {
    setActiveIndex((index) => index === null ? null : (index + direction + photos.length) % photos.length);
  }

  return (
    <>
      <div className={`estate-gallery${photos.length === 1 ? " estate-gallery--single" : photos.length === 2 ? " estate-gallery--two" : photos.length > 5 ? " estate-gallery--many" : ""}`}>
        {photos.map((photo, index) => (
          <figure className={index === 0 ? "estate-gallery__cover" : ""} key={photo.id}>
            <button
              className="estate-gallery__photo"
              type="button"
              onClick={(event) => { triggerRef.current = event.currentTarget; setActiveIndex(index); }}
              aria-label={`Ampliar foto ${index + 1} de ${photos.length} de ${title}`}
            >
              {/* Signed photo URLs are intentionally rendered as regular images. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption || `${title} — foto ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} />
            </button>
          </figure>
        ))}
      </div>

      {activeIndex !== null && (
        <div className="estate-lightbox" onClick={(event) => { if (event.target === event.currentTarget) setActiveIndex(null); }}>
          <div className="estate-lightbox__dialog" role="dialog" aria-modal="true" aria-label={`Fotos de ${title}`} tabIndex={-1} ref={dialogRef}>
            <button className="estate-lightbox__close" type="button" onClick={() => setActiveIndex(null)} aria-label="Fechar fotos">×</button>
            {photos.length > 1 && <button className="estate-lightbox__arrow estate-lightbox__arrow--left" type="button" onClick={() => movePhoto(-1)} aria-label="Foto anterior">‹</button>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="estate-lightbox__image" src={photos[activeIndex].url} alt={photos[activeIndex].caption || `${title} — foto ${activeIndex + 1}`} />
            {photos.length > 1 && <button className="estate-lightbox__arrow estate-lightbox__arrow--right" type="button" onClick={() => movePhoto(1)} aria-label="Próxima foto">›</button>}
            <p className="estate-lightbox__caption" aria-live="polite">
              {photos[activeIndex].caption || title}<span>{activeIndex + 1} / {photos.length}</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
