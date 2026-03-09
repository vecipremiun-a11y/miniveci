'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useCart } from './CartProvider';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

const PLACEHOLDER = '/placeholder-product.svg';

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, totalItems, subtotal, updateQuantity, removeItem } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const formattedSubtotal = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(subtotal);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 right-0 z-[70] h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label="Carrito de compras"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-veci-primary" />
            <h2 className="text-lg font-extrabold text-veci-dark">Mi Carrito</h2>
            {totalItems > 0 && (
              <span className="bg-veci-primary/10 text-veci-primary text-xs font-bold px-2 py-0.5 rounded-full">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <ShoppingCart className="w-16 h-16 text-slate-200" />
              <p className="text-slate-500 font-medium">Tu carrito está vacío</p>
              <button
                onClick={onClose}
                className="text-sm font-bold text-veci-primary hover:underline"
              >
                Seguir comprando
              </button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => {
                const itemTotal = new Intl.NumberFormat('es-CL', {
                  style: 'currency',
                  currency: 'CLP',
                  maximumFractionDigits: 0,
                }).format(item.price * item.quantity);

                return (
                  <li key={item.id} className="flex gap-3 bg-slate-50 rounded-2xl p-3">
                    <img
                      src={item.image || PLACEHOLDER}
                      alt={item.name}
                      className="w-16 h-16 object-contain rounded-xl bg-white shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{itemTotal}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-slate-700 w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="self-start w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Subtotal</span>
              <span className="text-lg font-extrabold text-veci-dark">{formattedSubtotal}</span>
            </div>
            <Link
              href="/carrito"
              onClick={onClose}
              className="btn-primary w-full py-3 rounded-full font-bold text-center flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              Ir al carrito
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
