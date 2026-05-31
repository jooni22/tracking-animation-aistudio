import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { Location } from '../types';

interface AutocompleteInputProps {
  label: string;
  placeholder: string;
  value: string;
  dotColor: string;
  onSelect: (name: string, location: Location) => void;
}

export default function AutocompleteInput({ label, placeholder, value, dotColor, onSelect }: AutocompleteInputProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with prop changes: e.g., when resetting or loading template
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5&countrycodes=pl,de,cz,sk,ua,by,lt`,
        {
          headers: {
            'Accept-Language': 'pl,en',
            'User-Agent': 'RoutePlannerPoC_v1'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search trigger
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query !== value) {
        handleSearch(query);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="relative" ref={containerRef}>
      <span className={`absolute left-3 top-[32px] w-2.5 h-2.5 rounded-full ${dotColor} z-10`}></span>
      
      <div className="flex flex-col">
        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 pl-1">{label}</label>
        <div className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            placeholder={placeholder}
            className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
          <div className="absolute right-2 text-slate-400">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4 hover:text-slate-600 cursor-pointer" onClick={() => handleSearch(query)} />
            )}
          </div>
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((item, index) => {
            const displayName = item.display_name.split(',')[0] + (item.display_name.split(',')[1] ? ', ' + item.display_name.split(',')[1] : '');
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const name = displayName;
                  const lat = parseFloat(item.lat);
                  const lng = parseFloat(item.lon);
                  onSelect(name, { lat, lng });
                  setQuery(name);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-slate-700">{displayName}</span>
                  <span className="text-[10px] text-slate-400 block truncate">{item.display_name}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
