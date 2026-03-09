'use client';

import Link from 'next/link';
import { ShoppingCart, Search, User, LogOut, Shield, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCart } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';

const ADMIN_ROLES = ['owner', 'admin', 'preparacion', 'reparto', 'contenido'];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { totalItems } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const isAdmin = session?.user?.role && ADMIN_ROLES.includes(session.user.role);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/productos')) {
      setSearchQuery(searchParams.get('search') || '');
      return;
    }

    setSearchQuery('');
  }, [pathname, searchParams]);

  // Live-update URL search param while on /productos
  useEffect(() => {
    if (!pathname?.startsWith('/productos')) return;

    const timeout = setTimeout(() => {
      const current = searchParams.get('search') || '';
      const normalized = searchQuery.trim();
      if (normalized === current) return;

      const params = new URLSearchParams(searchParams.toString());
      if (normalized) {
        params.set('search', normalized);
      } else {
        params.delete('search');
      }
      params.delete('page');
      router.replace(`/productos${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery, pathname, router, searchParams]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery) {
      params.set('search', normalizedQuery);
    }

    router.push(params.toString() ? `/productos?${params.toString()}` : '/productos');
  };

  // Don't render Navbar on admin routes
  if (pathname?.startsWith('/admin')) {
    return null;
  }

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
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl mx-auto relative items-center bg-white/50 hover:bg-white/80 border border-white backdrop-blur-md rounded-full px-4 py-2.5 transition-all group focus-within:ring-2 focus-within:ring-veci-secondary/50 focus-within:bg-white focus-within:shadow-md">
            <Search className="w-5 h-5 text-slate-400 group-focus-within:text-veci-purple transition-colors" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700 placeholder:text-slate-400 font-medium"
            />
            <button type="submit" className="sr-only">Buscar</button>
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-4 shrink-0">
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
            ) : session?.user ? (
              /* Logged-in user menu */
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/50 hover:bg-white/80 border border-white/60 backdrop-blur-md transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-veci-primary to-veci-secondary flex items-center justify-center text-white text-sm font-bold">
                    {session.user.name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
                    {session.user.name || 'Mi cuenta'}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", userMenuOpen && "rotate-180")} />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 truncate">{session.user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
                      {isAdmin && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-600 rounded-full">
                          {session.user.role}
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Shield className="w-4 h-4 text-indigo-500" />
                        Panel de Administración
                      </Link>
                    )}

                    <Link
                      href="/cuenta"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      Mi Cuenta
                    </Link>

                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Not logged in */
              <Link href="/login" className="hidden lg:block text-slate-600 font-medium hover:text-veci-primary transition-colors text-sm">
                Iniciar sesión
              </Link>
            )}
            <button onClick={() => setCartOpen(true)} className="btn-primary px-5 py-2.5 rounded-full font-bold flex items-center gap-2 text-sm shadow-md hover:shadow-lg transition-all">
              <ShoppingCart className="w-4 h-4" />
              <span>Carrito</span>
              {totalItems > 0 && (
                <span className="bg-white/20 text-white text-xs font-extrabold min-w-5 h-5 rounded-full inline-flex items-center justify-center px-1.5">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

        </div>

        <form onSubmit={handleSearchSubmit} className="md:hidden flex items-center bg-white/80 border border-white backdrop-blur-md rounded-full px-4 py-2.5 transition-all group focus-within:ring-2 focus-within:ring-veci-secondary/50 focus-within:bg-white focus-within:shadow-md">
          <Search className="w-5 h-5 text-slate-400 group-focus-within:text-veci-purple transition-colors" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700 placeholder:text-slate-400 font-medium"
          />
          <button type="submit" className="sr-only">Buscar</button>
        </form>

        {/* Bottom Row: Navigation Links */}
        <div className="flex items-center justify-center gap-8 font-medium text-slate-600 text-sm overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full">
          <Link href="/" className="hover:text-veci-primary transition-colors whitespace-nowrap">Inicio</Link>
          <Link href="/productos" className="hover:text-veci-primary transition-colors whitespace-nowrap">Tienda</Link>
          <Link href="/suscripcion" className="hover:text-veci-primary transition-colors whitespace-nowrap">Suscripción</Link>
          <Link href="#" className="hover:text-veci-primary transition-colors whitespace-nowrap">Sorteos</Link>
          <Link href="#" className="hover:text-veci-primary transition-colors whitespace-nowrap">Contacto</Link>
        </div>

      </div>

      <CartDrawer open={cartOpen} onClose={closeCart} />
    </nav>
  );
}
