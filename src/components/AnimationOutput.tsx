import { useState, useEffect } from 'react';
import { Download, Monitor, Mail, Box, MapPin, Copy, Check, FileCode } from 'lucide-react';
import { 
  RouteResponsePayload, 
  Waypoint, 
  AnimationGenerationOptions, 
  AnimationPayload, 
  WebsiteAnimationPayload, 
  EmailAnimationPayload,
  RouteBounds,
  Location
} from '../types';
import { parseAndSimplifyPolyline } from '../lib/routeSimplification';
import { generateStandaloneHTML } from '../lib/htmlExport';
import polylineLib from '@mapbox/polyline';

interface AnimationOutputProps {
  routeResult: RouteResponsePayload;
  origin: Waypoint;
  destination: Waypoint;
  intermediates: Waypoint[];
  onPayloadGenerated: (payload: AnimationPayload | null) => void;
}

export default function AnimationOutput({ routeResult, origin, destination, intermediates, onPayloadGenerated }: AnimationOutputProps) {
  const [options, setOptions] = useState<AnimationGenerationOptions>({
    target: 'WEBSITE',
    style: 'MARKER',
    durationSeconds: 4,
    loop: true,
    simplifyPath: true
  });

  const [payload, setPayload] = useState<AnimationPayload | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset payload if inputs change
  useEffect(() => {
    setPayload(null);
    onPayloadGenerated(null);
  }, [routeResult, origin, destination, intermediates, options]);

  const generatePayload = () => {
    if (!routeResult || !routeResult.polyline) return;

    // Calculate bounds
    const pointsToBound: Location[] = [
      origin.location,
      destination.location,
      ...intermediates.map(i => i.location)
    ];

    try {
      const decoded = polylineLib.decode(routeResult.polyline);
      decoded.forEach(p => {
        pointsToBound.push({ lat: p[0], lng: p[1] });
      });
    } catch(e) {}

    const bounds: RouteBounds = {
      minLat: Math.min(...pointsToBound.map(p => p.lat)),
      maxLat: Math.max(...pointsToBound.map(p => p.lat)),
      minLng: Math.min(...pointsToBound.map(p => p.lng)),
      maxLng: Math.max(...pointsToBound.map(p => p.lng))
    };

    const orderedIntermediates = routeResult.optimizedIntermediateWaypointIndex 
      ? routeResult.optimizedIntermediateWaypointIndex.map(idx => intermediates[idx]) 
      : intermediates;

    let generated: AnimationPayload;

    if (options.target === 'WEBSITE') {
      let finalPolylineStr = routeResult.polyline;
      let pathCount = 0;
      
      try {
        if (options.simplifyPath) {
          const simplifiedLocations = parseAndSimplifyPolyline(routeResult.polyline, 0.0005);
          const simplifiedCoords = simplifiedLocations.map(p => [p.lat, p.lng] as [number, number]);
          finalPolylineStr = polylineLib.encode(simplifiedCoords);
          pathCount = simplifiedCoords.length;
        } else {
          pathCount = polylineLib.decode(routeResult.polyline).length;
        }
      } catch (e) {
        console.error("Polyline simplification error", e);
      }

      generated = {
        target: 'WEBSITE',
        animationStyle: options.style,
        recommendedDurationSeconds: options.durationSeconds,
        loop: options.loop,
        simplifiedPolyline: finalPolylineStr,
        pathCoordinatesCount: pathCount,
        routeBounds: bounds,
        totalDistanceMeters: routeResult.distanceMeters,
        totalDurationSeconds: routeResult.durationSeconds,
        origin,
        destination,
        intermediates: orderedIntermediates
      } as WebsiteAnimationPayload;
    } else {
      // Email target (aggressive simplification)
      let simplifiedCoords: Location[] = [];
      try {
         simplifiedCoords = parseAndSimplifyPolyline(routeResult.polyline, 0.01);
      } catch(e) {}
      
      generated = {
        target: 'EMAIL',
        recommendedFrameCount: 30,
        recommendedCanvasWidth: 600,
        recommendedCanvasHeight: 400,
        recommendedBackgroundStyle: '#ffffff',
        recommendation: 'SHORT_GIF',
        ctaUrlPlaceholder: 'https://example.com/track/12345',
        simplifiedCoordinates: simplifiedCoords,
        routeBounds: bounds,
        totalDistanceMeters: routeResult.distanceMeters,
        totalDurationSeconds: routeResult.durationSeconds,
        origin,
        destination,
        intermediates: orderedIntermediates
      } as EmailAnimationPayload;
    }

    setPayload(generated);
    onPayloadGenerated(generated);
  };

  const handleCopy = () => {
    if (!payload) return;
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    if (!payload) return;
    const htmlContent = generateStandaloneHTML(payload);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-animation-${payload.target.toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg shadow-sm">
      <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Monitor className="w-4 h-4 text-indigo-500" />
        Animation Output
      </h3>

      <div className="space-y-4">
        {/* Output Target */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={() => setOptions({ ...options, target: 'WEBSITE' })}
            className={`py-2 px-3 flex flex-col items-center justify-center gap-1 rounded-md text-xs border transition-colors ${
              options.target === 'WEBSITE' 
                ? 'bg-white border-indigo-500 text-indigo-700 font-semibold shadow-sm' 
                : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Website
          </button>
          <button 
            type="button"
            onClick={() => setOptions({ ...options, target: 'EMAIL' })}
            className={`py-2 px-3 flex flex-col items-center justify-center gap-1 rounded-md text-xs border transition-colors ${
              options.target === 'EMAIL' 
                ? 'bg-white border-indigo-500 text-indigo-700 font-semibold shadow-sm' 
                : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
        </div>

        {options.target === 'WEBSITE' && (
          <div className="space-y-3 bg-white p-3 rounded border border-indigo-50/50">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium text-slate-500 uppercase">Style</label>
              <div className="flex bg-slate-100 p-0.5 rounded text-xs">
                <button 
                  onClick={() => setOptions({ ...options, style: 'MARKER' })}
                  className={`flex-1 py-1 rounded flex items-center justify-center gap-1 ${options.style === 'MARKER' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-slate-500'}`}
                >
                  <MapPin className="w-3 h-3" /> Marker
                </button>
                <button 
                  onClick={() => setOptions({ ...options, style: 'PACKAGE' })}
                  className={`flex-1 py-1 rounded flex items-center justify-center gap-1 ${options.style === 'PACKAGE' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-slate-500'}`}
                >
                  <Box className="w-3 h-3" /> Package
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium text-slate-500 uppercase">Duration</label>
                <select 
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                  value={options.durationSeconds}
                  onChange={(e) => setOptions({ ...options, durationSeconds: Number(e.target.value) })}
                >
                  <option value={2}>2 seconds</option>
                  <option value={4}>4 seconds</option>
                  <option value={6}>6 seconds</option>
                </select>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 pt-4">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={options.loop} onChange={(e) => setOptions({ ...options, loop: e.target.checked })} className="rounded text-indigo-600" />
                  Loop
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-2">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={options.simplifyPath} onChange={(e) => setOptions({ ...options, simplifyPath: e.target.checked })} className="rounded text-indigo-600" />
                Simplify path
              </label>
            </div>
          </div>
        )}

        {options.target === 'EMAIL' && (
          <div className="space-y-3 bg-white p-3 rounded border border-indigo-50/50">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Email payload is heavily optimized. Path points are drastically reduced. Generates static or GIF-oriented data structure.
            </p>
          </div>
        )}

        <button 
          onClick={generatePayload}
          className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition-colors shadow-sm flex justify-center items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Generate Payload
        </button>

        {payload && (
          <div className="mt-4 flex flex-col gap-2">
             <div className="flex bg-slate-800 rounded p-1">
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="flex-1 py-1.5 flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-200 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  Save as HTML (View in Browser)
                </button>
             </div>
             
             <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payload.target === 'WEBSITE' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {payload.target === 'WEBSITE' ? 'WEB-OPTIMIZED JSON' : 'EMAIL-SAFE JSON'}
                </span>
                <button onClick={handleCopy} className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 text-[10px] font-medium">
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
             </div>
             <pre className="text-[9px] bg-slate-900 text-emerald-300 p-2 rounded max-h-[150px] overflow-y-auto mt-1" style={{ scrollbarWidth: 'none' }}>
                {JSON.stringify(payload, null, 2)}
             </pre>
          </div>
        )}

      </div>
    </div>
  );
}
