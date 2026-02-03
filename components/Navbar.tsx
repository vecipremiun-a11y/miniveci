'use client';

import Link from 'next/link';
import { ShoppingCart, Search } from 'lucide-react';
import { cn } from '@/lib/utils'; // We'll need to create this util
import { useState, useEffect } from 'react';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 border-b border-transparent",
      scrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-2 border-white/50" : "bg-transparent py-4"
    )}>
      <div className="max-w-7xl mx-auto flex flex-col gap-4">

        {/* Top Row: Logo - Search - Actions */}
        <div className="flex items-center justify-between w-full gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-teal-300 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              N
            </div>
            <span className="text-xl font-bold text-veci-dark tracking-tight hidden sm:block">VeciMarket</span>
          </div>

          {/* Centered Search Bar - Expanded */}
          <div className="hidden md:flex flex-1 max-w-xl mx-auto relative items-center bg-white/50 hover:bg-white/80 border border-white backdrop-blur-md rounded-full px-4 py-2.5 transition-all group focus-within:ring-2 focus-within:ring-veci-secondary/50 focus-within:bg-white focus-within:shadow-md">
            <Search className="w-5 h-5 text-slate-400 group-focus-within:text-veci-purple transition-colors" />
            <input
              type="text"
              placeholder="Buscar productos..."
              className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4 shrink-0">
            <button className="hidden lg:block text-slate-600 font-medium hover:text-veci-primary transition-colors text-sm">
              Iniciar sesión
            </button>
            <button className="btn-primary px-5 py-2.5 rounded-full font-bold flex items-center gap-2 text-sm shadow-md hover:shadow-lg transition-all">
              <ShoppingCart className="w-4 h-4" />
              <span>Carrito</span>
            </button>
          </div>

        </div>

        {/* Bottom Row: Navigation Links */}
        <div className="flex items-center justify-center gap-8 font-medium text-slate-600 text-sm overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full">
          <Link href="/" className="hover:text-veci-primary transition-colors whitespace-nowrap">Inicio</Link>
          <Link href="/productos" className="hover:text-veci-primary transition-colors whitespace-nowrap">Productos</Link>
          <Link href="#" className="hover:text-veci-primary transition-colors whitespace-nowrap">Categorías</Link>
          <Link href="#" className="hover:text-veci-primary transition-colors whitespace-nowrap">Ofertas</Link>
          <Link href="#" className="hover:text-veci-primary transition-colors whitespace-nowrap">Contacto</Link>
        </div>

      </div>
    </nav>
  );
}
