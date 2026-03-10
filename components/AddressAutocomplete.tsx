'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Home, MapPin } from 'lucide-react';

declare global {
    interface Window {
        google?: typeof google;
        initGoogleMaps?: () => void;
    }
}

let googleMapsLoading = false;
let googleMapsLoaded = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMaps(): Promise<void> {
    return new Promise((resolve) => {
        if (googleMapsLoaded && window.google?.maps?.places) {
            resolve();
            return;
        }

        loadCallbacks.push(resolve);

        if (googleMapsLoading) return;
        googleMapsLoading = true;

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.warn('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está configurada');
            googleMapsLoading = false;
            loadCallbacks.forEach(cb => cb());
            loadCallbacks.length = 0;
            return;
        }

        window.initGoogleMaps = () => {
            googleMapsLoaded = true;
            googleMapsLoading = false;
            loadCallbacks.forEach(cb => cb());
            loadCallbacks.length = 0;
        };

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=initGoogleMaps&language=es&region=CL`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    });
}

interface AddressResult {
    address: string;
    comuna: string;
    city: string;
}

interface AddressAutocompleteProps {
    address: string;
    comuna: string;
    city: string;
    onAddressChange: (result: AddressResult) => void;
    onManualAddressChange?: (value: string) => void;
}

export default function AddressAutocomplete({
    address,
    comuna,
    city,
    onAddressChange,
    onManualAddressChange,
}: AddressAutocompleteProps) {
    const addressInputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const [mapsReady, setMapsReady] = useState(false);

    useEffect(() => {
        loadGoogleMaps().then(() => {
            if (window.google?.maps?.places) {
                setMapsReady(true);
            }
        });
    }, []);

    useEffect(() => {
        if (!mapsReady || !addressInputRef.current || autocompleteRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
            types: ['address'],
            componentRestrictions: { country: 'cl' },
            fields: ['address_components', 'formatted_address'],
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.address_components) return;

            let streetNumber = '';
            let route = '';
            let newComuna = '';
            let newCity = '';

            for (const component of place.address_components) {
                const type = component.types[0];
                if (type === 'street_number') streetNumber = component.long_name;
                if (type === 'route') route = component.long_name;
                if (type === 'locality' || type === 'sublocality_level_1' || type === 'administrative_area_level_3') {
                    if (!newComuna) newComuna = component.long_name;
                }
                if (type === 'administrative_area_level_2' || type === 'administrative_area_level_1') {
                    if (!newCity) newCity = component.long_name;
                }
            }

            const fullAddress = streetNumber ? `${route} ${streetNumber}` : route || place.formatted_address || '';

            onAddressChange({
                address: fullAddress,
                comuna: newComuna || comuna,
                city: newCity || city,
            });
        });

        autocompleteRef.current = autocomplete;

        return () => {
            if (autocompleteRef.current) {
                google.maps.event.clearInstanceListeners(autocompleteRef.current);
                autocompleteRef.current = null;
            }
        };
    }, [mapsReady]);

    const handleManualChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (onManualAddressChange) {
            onManualAddressChange(e.target.value);
        }
    }, [onManualAddressChange]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Dirección</label>
                <div className="relative group">
                    <Home className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                    <input
                        ref={addressInputRef}
                        type="text"
                        value={address}
                        onChange={handleManualChange}
                        placeholder="Busca tu dirección..."
                        autoComplete="off"
                        className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Comuna</label>
                    <div className="relative group">
                        <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                        <input
                            type="text"
                            value={comuna}
                            onChange={(e) => onAddressChange({ address, comuna: e.target.value, city })}
                            placeholder="Providencia"
                            className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Ciudad</label>
                    <div className="relative group">
                        <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-veci-primary transition-colors" />
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => onAddressChange({ address, comuna, city: e.target.value })}
                            placeholder="Santiago"
                            className="w-full bg-white/50 border border-white focus:bg-white pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-veci-primary/50 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
