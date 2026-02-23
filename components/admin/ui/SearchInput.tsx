"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchInputProps {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    debounceMs?: number;
    className?: string;
}

export function SearchInput({ 
    placeholder = "Buscar...", 
    value, 
    onChange, 
    debounceMs = 300, 
    className = "" 
}: SearchInputProps) {
    const [localValue, setLocalValue] = useState(value);

    // Sync if external value resets
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (localValue !== value) {
                onChange(localValue);
            }
        }, debounceMs);

        return () => {
            clearTimeout(handler);
        };
    }, [localValue, debounceMs, onChange, value]);

    const handleClear = () => {
        setLocalValue("");
        onChange("");
    };

    return (
        <div className={`relative ${className}`}>
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-500" aria-hidden="true" />
            </div>
            <Input
                type="text"
                className="pl-10 pr-10"
                placeholder={placeholder}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                aria-label={placeholder}
            />
            {localValue && (
                <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 group"
                    onClick={handleClear}
                    title="Limpiar búsqueda"
                    aria-label="Limpiar búsqueda"
                >
                    <X className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </button>
            )}
        </div>
    );
}
