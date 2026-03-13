"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Banner {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

export function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/store/banners")
      .then((r) => r.json())
      .then((data: Banner[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setBanners(data);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % banners.length);
  }, [banners.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Auto‑play every 5s
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [banners.length, next]);

  if (!loaded || banners.length === 0) return null;

  const currentBanner = banners[current];
  const hasLink = !!currentBanner.linkUrl;

  const slideContent = (
    <div className="relative block w-full">
      {banners.map((banner, i) => (
        <Image
          key={banner.id}
          src={banner.imageUrl}
          alt={banner.title || "Banner promocional"}
          width={1920}
          height={600}
          className="w-full h-auto transition-opacity duration-700"
          style={{
            opacity: i === current ? 1 : 0,
            position: i === 0 ? "relative" : "absolute",
            top: 0,
            left: 0,
          }}
          priority={i === 0}
          sizes="100vw"
        />
      ))}
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden bg-gray-100 pt-24 md:pt-28">
      {/* Slides */}
      {hasLink ? (
        <Link href={currentBanner.linkUrl!}>{slideContent}</Link>
      ) : (
        slideContent
      )}

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white transition-colors"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-5 w-5 text-gray-800" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white transition-colors"
            aria-label="Siguiente banner"
          >
            <ChevronRight className="h-5 w-5 text-gray-800" />
          </button>
        </>
      )}

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-8 bg-white"
                  : "w-2.5 bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
