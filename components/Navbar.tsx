'use client';

import Link from 'next/link';
import { ShoppingCart, Search, User, LogOut, Shield, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCart } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';

const ADMIN_ROLES = ['owner', 'admin', 'preparacion', 'reparto', 'contenido'];

interface SearchSuggestion {
  id: string;
  name: string;
  slug: string;
  price: number;
  offerPrice: number | null;
  isOffer: boolean;
  image: string | null;
}

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
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchBoxMobileRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userTypingRef = useRef(false);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const isAdmin = session?.user?.role && ADMIN_ROLES.includes(session.user.role);

  useEffect(() => { setHasMounted(true); }, []);

  useEffect(() => {
    if (session?.user?.id && session.user.role === 'customer') {
      fetch('/api/store/customer')
        .then(r => r.json())
        .then(d => { if (d.avatarUrl) setAvatarUrl(d.avatarUrl); })
        .catch(() => {});
    }
  }, [session?.user?.id, session?.user?.role]);

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
      if (
        searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node) &&
        searchBoxMobileRef.current && !searchBoxMobileRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync searchQuery from URL — but skip if user is actively typing
  useEffect(() => {
    if (userTypingRef.current) return;
    if (pathname?.startsWith('/productos')) {
      const urlSearch = searchParams.get('search') || '';
      setSearchQuery(urlSearch);
      if (!urlSearch) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [pathname, searchParams]);

  // Fetch suggestions as user types
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    setActiveIndex(-1);

    const timeout = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/store/products?search=${encodeURIComponent(trimmed)}&limit=8`, { signal: controller.signal })
        .then((res) => res.json())
        .then((json) => {
          const items: SearchSuggestion[] = (json.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            offerPrice: p.offerPrice ?? null,
            isOffer: Boolean(p.isOffer),
            image: p.images?.[0]?.url || null,
          }));
          setSuggestions(items);
          setShowSuggestions(true);
          setLoadingSuggestions(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setLoadingSuggestions(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timeout);
      abortRef.current?.abort();
    };
  }, [searchQuery]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowSuggestions(false);
    setSuggestions([]);
    userTypingRef.current = false;

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      router.push(`/productos/${suggestions[activeIndex].slug}`);
      return;
    }

    const normalizedQuery = searchQuery.trim();
    router.push(normalizedQuery ? `/productos?search=${encodeURIComponent(normalizedQuery)}` : '/productos');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const goToSuggestion = (slug: string) => {
    setShowSuggestions(false);
    setSuggestions([]);
    userTypingRef.current = false;
    router.push(`/productos/${slug}`);
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

  // Don't render Navbar on admin routes
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const suggestionsDropdown = showSuggestions && (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[80]">
      {loadingSuggestions ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-slate-400">
          No se encontraron productos
        </div>
      ) : (
        <>
          <ul>
            {suggestions.map((s, idx) => {
              const hasOffer = s.isOffer && s.offerPrice !== null && s.offerPrice < s.price;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); goToSuggestion(s.slug); }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      idx === activeIndex ? "bg-slate-50" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="w-full h-full object-contain" />
                      ) : (
                        <Search className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-bold", hasOffer ? "text-red-600" : "text-slate-500")}>
                          {formatPrice(hasOffer ? s.offerPrice! : s.price)}
                        </span>
                        {hasOffer && (
                          <span className="text-[10px] text-slate-400 line-through">{formatPrice(s.price)}</span>
                        )}
                      </div>
                    </div>
                    {hasOffer && (
                      <span className="shrink-0 text-[10px] font-extrabold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                        -{Math.round(((s.price - s.offerPrice!) / s.price) * 100)}%
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowSuggestions(false);
              setSuggestions([]);
              userTypingRef.current = false;
              const q = searchQuery.trim();
              router.push(q ? `/productos?search=${encodeURIComponent(q)}` : '/productos');
            }}
            className="w-full px-4 py-2.5 text-sm font-bold text-veci-primary bg-slate-50/80 hover:bg-slate-100 border-t border-slate-100 transition-colors text-center"
          >
            Ver todos los resultados
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 border-b border-transparent",
      scrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-2 border-white/50" : "bg-transparent py-4"
    )}>
      <div className="max-w-7xl mx-auto flex flex-col gap-4">

        {/* Top Row: Logo - Search - Actions */}
        <div className="flex items-center justify-between w-full gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img src="/logo%20veci.png" alt="MiniVeci" className="w-14 h-14 object-contain" />
            <span className="text-xl font-bold text-veci-dark tracking-tight hidden sm:block">MiniVeci</span>
          </div>

          {/* Centered Search Bar - Desktop */}
          <div ref={searchBoxRef} className="hidden md:block flex-1 max-w-xl mx-auto relative">
            <form onSubmit={handleSearchSubmit} className="flex items-center bg-white/80 border-2 border-purple-300 hover:border-purple-400 backdrop-blur-md rounded-full px-4 py-2.5 transition-all group focus-within:ring-2 focus-within:ring-purple-400/40 focus-within:border-purple-500 focus-within:bg-white focus-within:shadow-md shadow-sm">
              <Search className="w-5 h-5 text-purple-400 group-focus-within:text-purple-600 transition-colors" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(event) => { userTypingRef.current = true; setSearchQuery(event.target.value); }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700 placeholder:text-slate-400 font-medium"
              />
              <button type="submit" className="sr-only">Buscar</button>
            </form>
            {suggestionsDropdown}
          </div>

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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-veci-primary to-veci-secondary flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      session.user.name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />
                    )}
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
              {hasMounted && totalItems > 0 && (
                <span className="bg-white/20 text-white text-xs font-extrabold min-w-5 h-5 rounded-full inline-flex items-center justify-center px-1.5">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

        </div>

        {/* Mobile Search */}
        <div ref={searchBoxMobileRef} className="md:hidden relative">
          <form onSubmit={handleSearchSubmit} className="flex items-center bg-white/90 border-2 border-purple-300 hover:border-purple-400 backdrop-blur-md rounded-full px-4 py-2.5 transition-all group focus-within:ring-2 focus-within:ring-purple-400/40 focus-within:border-purple-500 focus-within:bg-white focus-within:shadow-md shadow-sm">
            <Search className="w-5 h-5 text-purple-400 group-focus-within:text-purple-600 transition-colors" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(event) => { userTypingRef.current = true; setSearchQuery(event.target.value); }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none text-sm ml-3 w-full text-slate-700 placeholder:text-slate-400 font-medium"
            />
            <button type="submit" className="sr-only">Buscar</button>
          </form>
          {suggestionsDropdown}
        </div>

        {/* Bottom Row: Navigation Links */}
        <div className="flex items-center justify-center gap-8 font-medium text-slate-600 text-sm overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full">
          <Link href="/" className="hover:text-veci-primary transition-colors whitespace-nowrap">Inicio</Link>
          <Link href="/productos" className="hover:text-veci-primary transition-colors whitespace-nowrap">Tienda</Link>
          <Link href="/suscripcion" className="hover:text-veci-primary transition-colors whitespace-nowrap">Suscripción</Link>
          <Link href="#" className="hover:text-veci-primary transition-colors whitespace-nowrap">Sorteos</Link>
          <Link href="/contacto" className="hover:text-veci-primary transition-colors whitespace-nowrap">Contacto</Link>
        </div>

      </div>

    </nav>
    <CartDrawer open={cartOpen} onClose={closeCart} />
    </>
  );
}
