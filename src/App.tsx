import { useState, useEffect } from 'react';
import { Settings, Play, Plus, Trash2, ArrowUp, ArrowDown, MapPin, Route, RotateCcw, Sparkles, Map } from 'lucide-react';
import RouteMap from './components/Map';
import AutocompleteInput from './components/AutocompleteInput';
import AnimationOutput from './components/AnimationOutput';
import { RouteRequestPayload, RouteResponsePayload, TravelMode, Waypoint, AnimationPayload } from './types';


function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const SAMPLE_TRIP = {
  origin: { id: generateId(), name: "Warszawa", location: { lat: 52.2297, lng: 21.0122 } },
  destination: { id: generateId(), name: "Białystok", location: { lat: 53.1325, lng: 23.1688 } },
  intermediates: [
    { id: generateId(), name: "Ostrów Mazowiecka", location: { lat: 52.8026, lng: 21.8951 } },
    { id: generateId(), name: "Zambrów", location: { lat: 52.9818, lng: 22.2458 } }
  ]
};

export default function App() {
  const [origin, setOrigin] = useState<Waypoint | undefined>(SAMPLE_TRIP.origin);
  const [destination, setDestination] = useState<Waypoint | undefined>(SAMPLE_TRIP.destination);
  const [intermediates, setIntermediates] = useState<Waypoint[]>(SAMPLE_TRIP.intermediates);
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVE');
  const [optimize, setOptimize] = useState(false);
  
  const [routeResult, setRouteResult] = useState<RouteResponsePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectingCities, setDetectingCities] = useState(false);
  const [animationPayload, setAnimationPayload] = useState<AnimationPayload | null>(null);

  const handleGenerateRoute = async (customIntermediates?: Waypoint[]) => {
    if (!origin || !destination) {
      setError("Origin and Destination are required.");
      return;
    }

    setLoading(true);
    setError(null);
    setRouteResult(null);

    const payload: RouteRequestPayload = {
      origin,
      destination,
      intermediates: customIntermediates !== undefined ? customIntermediates : intermediates,
      travelMode,
      optimizeWaypointOrder: optimize
    };

    try {
      const res = await fetch('/api/compute-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setRouteResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate route.");
    } finally {
      setLoading(false);
    }
  };

  const handleDetectRouteCities = async () => {
    if (!origin || !destination) return;
    setDetectingCities(true);
    setError(null);
    try {
      const res = await fetch('/api/suggest-stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      if (data.cities && Array.isArray(data.cities)) {
        const newStops = data.cities.map((c: any) => ({
          id: generateId(),
          name: c.name,
          location: { lat: c.lat, lng: c.lng },
          reason: c.reason
        }));
        setIntermediates(newStops);
        await handleGenerateRoute(newStops);
      } else {
        throw new Error("No suggested intermediate cities found for this route.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Błąd podczas wykrywania miast na trasie.");
    } finally {
      setDetectingCities(false);
    }
  };

  useEffect(() => {
    handleGenerateRoute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    const newIntermediates = [...intermediates];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newIntermediates.length) return;
    
    const temp = newIntermediates[index];
    newIntermediates[index] = newIntermediates[targetIndex];
    newIntermediates[targetIndex] = temp;
    setIntermediates(newIntermediates);
    setRouteResult(null); // invalidate current route
  };

  const removeWaypoint = (id: string) => {
    setIntermediates(intermediates.filter(w => w.id !== id));
    setRouteResult(null);
  };

  const resetTrip = () => {
    setOrigin(SAMPLE_TRIP.origin);
    setDestination(SAMPLE_TRIP.destination);
    setIntermediates(SAMPLE_TRIP.intermediates);
    setRouteResult(null);
    setError(null);
  };

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const hr = Math.floor(min / 60);
    if (hr > 0) return `${hr}h ${min % 60}m`;
    return `${min}m`;
  };

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans">
      
      {/* Top Header */}
      <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-1.5 rounded shadow-sm">
            <Route className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">RouteEngine <span className="text-slate-400 font-normal">PoC v1.2.0</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Server: Connected</span>
          </div>
          <button className="text-xs font-semibold px-4 py-1.5 border border-slate-300 rounded hover:bg-slate-50 transition-colors hidden sm:block">Export Config</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        
        {/* Sidebar Panel */}
        <aside className="w-full md:w-[380px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="p-6 space-y-5 border-b border-slate-100">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Trip Definition</label>
            
            <div className="space-y-3">
              {/* Origin (Punkt Nadania) */}
              <AutocompleteInput
                label="Punkt Nadania (Origin)"
                placeholder="Wpisz lub wyszukaj punkt nadania..."
                value={origin?.name || ""}
                dotColor="bg-green-500"
                onSelect={(name, location) => {
                  setOrigin({ id: origin?.id || generateId(), name, location });
                  setIntermediates([]);
                  setRouteResult(null);
                }}
              />

              {/* Destination (Punkt Odbioru) */}
              <AutocompleteInput
                label="Punkt Odbioru (Destination)"
                placeholder="Wpisz lub wyszukaj punkt odbioru..."
                value={destination?.name || ""}
                dotColor="bg-red-500"
                onSelect={(name, location) => {
                  setDestination({ id: destination?.id || generateId(), name, location });
                  setIntermediates([]);
                  setRouteResult(null);
                }}
              />
            </div>
            
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Intermediate Stops ({intermediates.length})</label>
                <button 
                  onClick={() => {
                    setIntermediates([...intermediates, {
                      id: generateId(),
                      name: `New Mock Stop ${generateId()}`,
                      location: { lat: 52.5 + Math.random() * 0.5, lng: 21.5 + Math.random() * 1.5 }
                    }]);
                    setRouteResult(null);
                  }}
                  className="text-blue-600 text-[10px] font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> + RANDOM STOP
                </button>
              </div>

              {/* Autocomplete Input to search/add custom stops */}
              <AutocompleteInput
                label="Add Custom Intermediate Stop"
                placeholder="Geocode & Add custom stop..."
                value=""
                dotColor="bg-blue-400"
                onSelect={(name, location) => {
                  setIntermediates([...intermediates, {
                    id: generateId(),
                    name,
                    location
                  }]);
                  setRouteResult(null);
                }}
              />

              {/* AI Auto-fill Cities Along Route button */}
              <button
                type="button"
                onClick={handleDetectRouteCities}
                disabled={detectingCities || !origin || !destination}
                className="w-full mt-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 text-blue-700 hover:text-blue-800 font-semibold py-2 px-3 rounded-lg text-xs flex justify-center items-center gap-2 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {detectingCities ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                )}
                {detectingCities ? "Wyszukiwanie głównych miast..." : "Wykryj miasta na trasie (AI)"}
              </button>
            </div>
            
            <div className="space-y-2">
              {intermediates.map((wp, i) => (
                <div key={wp.id} className="flex items-center group bg-white border border-slate-200 rounded-md p-2 shadow-sm border-l-4 border-l-blue-500">
                  <div className="text-slate-300 mr-2 flex flex-col gap-0.5">
                     <button onClick={() => moveWaypoint(i, -1)} disabled={i === 0} className="hover:text-slate-500 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                     <button onClick={() => moveWaypoint(i, 1)} disabled={i === intermediates.length - 1} className="hover:text-slate-500 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <span className="text-xs truncate font-medium text-slate-800">{wp.name}</span>
                    <span className="text-[10px] text-indigo-500 font-medium truncate" title={wp.reason || `Przystanek ${i + 1}`}>
                      {wp.reason || `Stop ${i + 1}`}
                    </span>
                  </div>
                  <button onClick={() => removeWaypoint(wp.id)} className="text-slate-300 hover:text-red-500 ml-2 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Routing Options */}
        <div className="p-6 space-y-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2">
              Optimize Order
            </label>
            <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${optimize ? 'bg-blue-600' : 'bg-slate-300'}`} onClick={() => setOptimize(!optimize)}>
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${optimize ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-medium text-slate-500">Travel Mode</label>
            <select 
              value={travelMode} 
              onChange={e => setTravelMode(e.target.value as TravelMode)}
              className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="DRIVE">Driving (Default)</option>
              <option value="BICYCLE">Bicycling</option>
              <option value="WALK">Walking</option>
            </select>
          </div>
          
          {error && (
            <div className="p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">
              {error}
            </div>
          )}

          <button 
            onClick={handleGenerateRoute}
            disabled={loading}
            className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-md hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:bg-slate-400 disabled:shadow-none flex justify-center items-center gap-2"
          >
            {loading ? <RotateCcw className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Computing optimized route..." : "Generate Optimized Route"}
          </button>
        </div>

        {/* Statistics */}
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Route Metrics</label>
            <button onClick={resetTrip} className="text-xs text-slate-400 hover:text-slate-700 font-medium flex items-center gap-1">
               <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-100 p-3 rounded-lg shadow-sm">
              <p className="text-[10px] text-slate-500">Total Distance</p>
              <p className="text-xl font-bold text-slate-800">
                {routeResult ? formatDistance(routeResult.distanceMeters) : "--"} 
              </p>
            </div>
            <div className="bg-white border border-slate-100 p-3 rounded-lg shadow-sm">
              <p className="text-[10px] text-slate-500">Duration</p>
              <p className="text-xl font-bold text-slate-800">
                {routeResult ? formatDuration(routeResult.durationSeconds) : "--"} 
              </p>
            </div>
          </div>
          
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">API Provider:</span>
              <span className="font-mono font-medium text-slate-700">google_routes_v2 (mock)</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Status:</span>
              <span className="font-mono font-medium text-slate-700">{routeResult ? 'SUCCESS' : 'IDLE'}</span>
            </div>
          </div>

          {routeResult && origin && destination && (
            <AnimationOutput 
              routeResult={routeResult}
              origin={origin}
              destination={destination}
              intermediates={intermediates}
              onPayloadGenerated={setAnimationPayload}
            />
          )}
        </div>
      </aside>

      {/* Main Content Area (Map + Debug) */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 relative bg-[#E2E8F0]">
          <RouteMap 
            origin={origin}
            destination={destination}
            intermediates={intermediates}
            routeResult={routeResult}
            animationPayload={animationPayload}
          />
        </div>
        
        {/* Debug / Raw Output Panel (Bottom) */}
        {routeResult && (
          <div className="h-64 border-t border-slate-300 bg-[#1E293B] flex flex-col">
            <div className="h-9 border-b border-slate-700 bg-slate-900 flex items-center px-4 justify-between shrink-0">
              <div className="flex space-x-6 h-full">
                <button className="text-[11px] font-bold text-white border-b-2 border-blue-500 h-full px-1">DEBUG_PANEL</button>
                <div className="flex items-center space-x-2 border-l border-slate-700 pl-4">
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] text-slate-400">DIAGNOSTICS</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 p-4 font-mono text-[11px] leading-relaxed overflow-y-auto w-full text-blue-300 bg-slate-900/50 flex flex-col lg:flex-row gap-6" style={{ scrollbarWidth: 'none' }}>
              <div className="flex-1">
                <div className="opacity-70 text-slate-500 mb-2">// Optimized Order Comparison</div>
                <div className="bg-slate-800/80 rounded border border-slate-700/50 overflow-hidden text-[10px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="py-2 px-3 text-slate-400 font-normal">Original Index</th>
                        <th className="py-2 px-3 text-slate-400 font-normal">Name</th>
                        <th className="py-2 px-3 text-slate-400 font-normal">Opt. Index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {intermediates.map((w, i) => {
                        const optIdx = routeResult.optimizedIntermediateWaypointIndex?.indexOf(i);
                        return (
                          <tr key={w.id} className="hover:bg-slate-800/50">
                            <td className="py-2 px-3 text-slate-300">{i}</td>
                            <td className="py-2 px-3 truncate max-w-[120px] text-blue-200">{w.name}</td>
                            <td className="py-2 px-3 font-bold text-emerald-400">{optIdx !== -1 && optIdx !== undefined ? optIdx : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(!routeResult.optimizedIntermediateWaypointIndex || routeResult.optimizedIntermediateWaypointIndex.length === 0) && (
                    <div className="text-slate-500 p-3 italic text-center">Optimization disabled or not returned.</div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 flex flex-col gap-3">
                 <div className="flex-1 flex flex-col">
                    <div className="opacity-70 text-slate-500 mb-1">// Request Payload</div>
                    <pre className="bg-slate-800/80 p-2 rounded border border-slate-700/50 overflow-auto max-h-[80px] text-blue-200" style={{ scrollbarWidth: 'none' }}>
                      {JSON.stringify(routeResult.rawRequest, null, 2)}
                    </pre>
                 </div>
                 <div className="flex-1 flex flex-col">
                    <div className="opacity-70 text-slate-500 mb-1">// Response Data</div>
                    <pre className="bg-slate-800/80 p-2 rounded border border-slate-700/50 overflow-auto max-h-[80px] text-emerald-300" style={{ scrollbarWidth: 'none' }}>
                      {JSON.stringify(routeResult.rawResponse, null, 2)}
                    </pre>
                 </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>

    {/* Bottom Status Bar */}
    <footer className="h-7 border-t border-slate-200 bg-white flex items-center px-4 justify-between shrink-0">
      <div className="flex items-center space-x-4">
        <span className="text-[10px] text-slate-400">UTF-8</span>
        <span className="text-[10px] text-slate-400">React v18.2.0</span>
        <span className="text-[10px] text-emerald-600 font-semibold">● API Ready</span>
      </div>
      <div className="flex items-center space-x-3 hidden sm:flex">
        <span className="text-[10px] text-slate-400">Main Thread: Active</span>
      </div>
    </footer>

    </div>
  );
}
