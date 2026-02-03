import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProductSidebar } from "@/components/products/ProductSidebar";
import { ProductCard } from "@/components/products/ProductCard";
import { ChevronDown, LayoutGrid, List, Filter } from "lucide-react";

const products = [
    { id: 1, name: "Bananás", price: "1.50", image: "🍌", isPopular: true },
    { id: 2, name: "Chips", price: "0.95", image: "🍟", isPopular: true },
    { id: 3, name: "MeLitro", price: "2.00", image: "🥛", isPopular: false },
    { id: 4, name: "Lamo", price: "2.99", image: "🥣", isPopular: false },
    { id: 5, name: "Tomates", price: "0.99", image: "🍅", isPopular: true },
    { id: 6, name: "Cereal", price: "3.49", image: "🥣", isPopular: true },
    { id: 7, name: "Detergerte", price: "5.99", image: "🧴", isPopular: false },
    { id: 8, name: "Pollo", price: "2.20", image: "🍗", isPopular: false },
    { id: 9, name: "Eggs", price: "2.80", image: "🥚", isPopular: true },
    { id: 10, name: "Broccoli", price: "1.29", image: "🥦", isPopular: true },
    { id: 11, name: "Espaghetti", price: "1.10", image: "🍝", isPopular: false },
    { id: 12, name: "Carne", price: "1.88", image: "🥩", isPopular: false },
];

export default function ProductsPage() {
    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-20">
            <Navbar />

            {/* Spacer for fixed navbar */}
            <div className="h-32 md:h-40"></div>

            <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row gap-8">

                {/* Sidebar - Hidden on mobile, can be toggled */}
                <div className="hidden md:block">
                    <ProductSidebar />
                </div>

                {/* Main Content */}
                <div className="flex-1">

                    {/* Top Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white/40 backdrop-blur-md p-4 rounded-3xl border border-white">
                        <span className="text-slate-500 text-sm font-medium">Mostrando 1-12 de 2500 productos</span>

                        <div className="flex items-center gap-4">
                            {/* Sort Dropdown */}
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                                <span>Ordenar por: <span className="text-veci-dark">Destacados</span></span>
                                <ChevronDown className="w-4 h-4" />
                            </div>

                            <div className="h-6 w-px bg-slate-300"></div>

                            {/* Filter Button (Mobile mainly) */}
                            <button className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-veci-purple transition-colors">
                                Filtrar (+5)
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-2 bg-white/50 p-1 rounded-lg">
                                <button className="p-1.5 rounded-md bg-veci-purple text-white shadow-sm">
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 transition-colors">
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map((product) => (
                            <ProductCard
                                key={product.id}
                                name={product.name}
                                price={product.price}
                                image={product.image}
                                isPopular={product.isPopular}
                            />
                        ))}
                    </div>

                </div>

            </div>

            <Footer />
        </main>
    );
}
