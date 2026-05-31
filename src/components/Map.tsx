import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import polylineLib from '@mapbox/polyline';
import { Waypoint, RouteResponsePayload, AnimationPayload, WebsiteAnimationPayload, EmailAnimationPayload } from '../types';
import { Box } from 'lucide-react';

function getEuclideanDistance(p1: number[], p2: number[]) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

interface MapProps {
  origin?: Waypoint;
  destination?: Waypoint;
  intermediates: Waypoint[];
  routeResult: RouteResponsePayload | null;
  animationPayload?: AnimationPayload | null;
}

export default function RouteMap({ origin, destination, intermediates, routeResult, animationPayload }: MapProps) {
  const mapRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const [animationTick, setAnimationTick] = useState(0);

  const renderingPolyline = useMemo(() => {
    if (animationPayload && animationPayload.target === 'WEBSITE') {
      return (animationPayload as WebsiteAnimationPayload).simplifiedPolyline;
    }
    if (routeResult && routeResult.polyline) return routeResult.polyline;
    return null;
  }, [routeResult, animationPayload]);

  const routeGeoJSON = useMemo(() => {
    if (!renderingPolyline) return null;
    try {
      const decoded = polylineLib.decode(renderingPolyline);
      const coords = decoded.map(p => [p[1], p[0]]);
      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      };
    } catch (e) {
      return null;
    }
  }, [renderingPolyline]);

  const emailGeoJSON = useMemo(() => {
    if (animationPayload && animationPayload.target === 'EMAIL') {
      const p = animationPayload as EmailAnimationPayload;
      if (p.simplifiedCoordinates && p.simplifiedCoordinates.length > 0) {
        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: p.simplifiedCoordinates.map(c => [c.lng, c.lat])
          }
        };
      }
    }
    return null;
  }, [animationPayload]);

  useEffect(() => {
    if (!routeGeoJSON) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setAnimationTick(0);
      return;
    }
    
    let duration = 8000;
    let isLooping = true;
    if (animationPayload && animationPayload.target === 'WEBSITE') {
      duration = (animationPayload as WebsiteAnimationPayload).recommendedDurationSeconds * 1000;
      isLooping = (animationPayload as WebsiteAnimationPayload).loop;
    }

    let start = performance.now();
    const animate = (time: number) => {
      let progress = (time - start) / duration;
      if (isLooping) {
        progress = progress % 1;
      } else {
        if (progress > 1) progress = 1;
      }
      
      setAnimationTick(progress);
      
      if (isLooping || progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  }, [routeGeoJSON, animationPayload]);

  const animatedPointFeature = useMemo(() => {
    if (!routeGeoJSON || !routeGeoJSON.geometry || !routeGeoJSON.geometry.coordinates) return null;
    if (animationPayload && animationPayload.target === 'EMAIL') return null; // No point animation for email
    
    const coords = routeGeoJSON.geometry.coordinates as [number, number][];
    if (coords.length < 2) return null;

    let totalDist = 0;
    const segments = [];
    for (let i = 0; i < coords.length - 1; i++) {
      const d = getEuclideanDistance(coords[i], coords[i+1]);
      totalDist += d;
      segments.push({ d, p1: coords[i], p2: coords[i+1] });
    }

    if (totalDist === 0) return null;

    let targetDist = totalDist * animationTick;
    let currentDist = 0;
    let currentPoint = coords[coords.length - 1]; // default to end

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (currentDist + seg.d >= targetDist) {
            const ratio = seg.d === 0 ? 0 : (targetDist - currentDist) / seg.d;
            currentPoint = [
                seg.p1[0] + (seg.p2[0] - seg.p1[0]) * ratio,
                seg.p1[1] + (seg.p2[1] - seg.p1[1]) * ratio
            ];
            break;
        }
        currentDist += seg.d;
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: currentPoint
      }
    };
  }, [routeGeoJSON, animationTick, animationPayload]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    if (!map) return;
    
    // Calculate bounding box of all points
    const points: [number, number][] = [];
    if (origin) points.push([origin.location.lng, origin.location.lat]);
    if (destination) points.push([destination.location.lng, destination.location.lat]);
    intermediates.forEach(w => points.push([w.location.lng, w.location.lat]));
    
    if (routeGeoJSON && routeGeoJSON.geometry) {
      (routeGeoJSON.geometry as any).coordinates.forEach((c: any) => points.push(c));
    }

    if (points.length === 0) return;

    let minLng = points[0][0];
    let maxLng = points[0][0];
    let minLat = points[0][1];
    let maxLat = points[0][1];

    for (const p of points) {
      if (p[0] < minLng) minLng = p[0];
      if (p[0] > maxLng) maxLng = p[0];
      if (p[1] < minLat) minLat = p[1];
      if (p[1] > maxLat) maxLat = p[1];
    }

    try {
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]], 
        { padding: 60, duration: 1000 }
      );
    } catch (e) { }

  }, [origin, destination, intermediates, routeGeoJSON]);

  // OSM Raster style
  const mapStyle = {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap Contributors'
      }
    },
    layers: [
      {
        id: 'osm',
        type: 'raster' as const,
        source: 'osm'
      }
    ]
  };

  return (
    <div className="w-full h-full bg-slate-100 relative">
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: 21.0122,  // Changed initial view string matching Warszawa long/lat approx
          latitude: 52.2297,
          zoom: 6
        }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
      >
        {origin && (
          <Marker longitude={origin.location.lng} latitude={origin.location.lat} anchor="bottom">
            <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold text-white z-10">A</div>
          </Marker>
        )}
        
        {destination && (
          <Marker longitude={destination.location.lng} latitude={destination.location.lat} anchor="bottom">
            <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold text-white z-10">B</div>
          </Marker>
        )}

        {intermediates.map((w, idx) => {
          let displayIdx = idx + 1;
          if (routeResult?.optimizedIntermediateWaypointIndex && routeResult.optimizedIntermediateWaypointIndex.length > 0) {
            const optIdx = routeResult.optimizedIntermediateWaypointIndex.indexOf(idx);
            if (optIdx !== -1) {
              displayIdx = optIdx + 1;
            }
          }

          return (
            <Marker key={w.id} longitude={w.location.lng} latitude={w.location.lat} anchor="bottom">
              <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold text-white">
                {displayIdx}
              </div>
            </Marker>
          );
        })}

        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON as any}>
            <Layer
              id="route-line"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#2563eb',
                'line-width': 5,
                'line-opacity': 0.7
              }}
            />
          </Source>
        )}
        
        {emailGeoJSON && (
          <Source id="email-route" type="geojson" data={emailGeoJSON as any}>
            <Layer
              id="email-route-line"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#f97316', // orange
                'line-width': 4,
                'line-dasharray': [2, 2],
                'line-opacity': 0.9
              }}
            />
          </Source>
        )}

        {animatedPointFeature && animatedPointFeature.geometry && animatedPointFeature.geometry.coordinates && (
          <Marker 
            longitude={animatedPointFeature.geometry.coordinates[0]} 
            latitude={animatedPointFeature.geometry.coordinates[1]} 
            anchor="center"
            style={{ zIndex: 20 }}
          >
            {animationPayload && animationPayload.target === 'WEBSITE' && (animationPayload as WebsiteAnimationPayload).animationStyle === 'PACKAGE' ? (
               <div className="w-8 h-8 bg-amber-500 rounded border-2 border-white shadow-xl flex items-center justify-center">
                 <Box className="w-5 h-5 text-white" />
               </div>
            ) : (
               <div className="w-5 h-5 bg-green-500 rounded-full border-[3px] border-white shadow-xl flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
               </div>
            )}
          </Marker>
        )}
      </MapGL>
      
      {animationPayload && animationPayload.target === 'EMAIL' && (
        <div className="absolute top-4 left-4 bg-orange-100 border border-orange-300 text-orange-800 px-3 py-2 rounded shadow-md z-10 text-xs font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          Email Preview Mode (highly simplified)
        </div>
      )}
    </div>
  );
}
