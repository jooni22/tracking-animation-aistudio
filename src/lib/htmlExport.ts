import polylineLib from '@mapbox/polyline';
import { AnimationPayload } from '../types';

function getMercator(lat: number, lng: number) {
  const R = 6378137.0;
  const x = (lng * Math.PI / 180.0) * R;
  const y = Math.log(Math.tan((Math.PI / 4.0) + (lat * Math.PI / 360.0))) * R;
  return { x, y };
}

export function generateStandaloneHTML(payload: AnimationPayload): string {
  let coords: {lat: number, lng: number}[] = [];
  
  if (payload.target === 'WEBSITE') {
    if (payload.simplifiedPolyline) {
       const decoded = polylineLib.decode(payload.simplifiedPolyline);
       coords = decoded.map(c => ({ lat: c[0], lng: c[1] }));
    }
  } else {
    coords = payload.simplifiedCoordinates;
  }

  if (!coords || coords.length < 2) {
    return '<!DOCTYPE html><html><body>Error: Not enough coordinates to generate animation.</body></html>';
  }

  const mercatorCoords = coords.map(c => {
    const m = getMercator(c.lat, c.lng);
    return { ...c, mx: m.x, my: m.y };
  });

  let minX = Math.min(...mercatorCoords.map(c => c.mx));
  let maxX = Math.max(...mercatorCoords.map(c => c.mx));
  let minY = Math.min(...mercatorCoords.map(c => c.my));
  let maxY = Math.max(...mercatorCoords.map(c => c.my));

  const padX = Math.max((maxX - minX) * 0.15, 2000);
  const padY = Math.max((maxY - minY) * 0.15, 2000);

  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  const canvasWidth = 800;
  // Prevent zero division if points are identical
  const xDiff = (maxX - minX) || 1;
  const canvasHeight = Math.max(300, Math.min(1000, Math.round(canvasWidth * ((maxY - minY) / xDiff))));

  const mapX = (mx: number) => ((mx - minX) / xDiff) * canvasWidth;
  const mapY = (my: number) => ((maxY - my) / (maxY - minY)) * canvasHeight; // SVG Y is inverted naturally

  // Using Terrestris free OSM WMS for a static JPEG map background (EPSG:3857), adding STYLES= to avoid WMS spec error
  const wmsUrl = `https://ows.terrestris.de/osm/service?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/jpeg&TRANSPARENT=false&LAYERS=OSM-WMS&STYLES=&WIDTH=${canvasWidth}&HEIGHT=${canvasHeight}&SRS=EPSG:3857&BBOX=${minX},${minY},${maxX},${maxY}`;

  const pathData = mercatorCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${mapX(c.mx).toFixed(2)} ${mapY(c.my).toFixed(2)}`).join(' ');

  const mapPoint = (lat: number, lng: number) => {
    const m = getMercator(lat, lng);
    return { x: mapX(m.x), y: mapY(m.y) };
  };

  const originPt = mapPoint(payload.origin.location.lat, payload.origin.location.lng);
  const destPt = mapPoint(payload.destination.location.lat, payload.destination.location.lng);
  const intermediatePts = payload.intermediates.map(i => mapPoint(i.location.lat, i.location.lng));

  let duration = 4;
  let loopCount = 'indefinite';
  let isPackage = false;

  if (payload.target === 'WEBSITE') {
    duration = payload.recommendedDurationSeconds;
    loopCount = payload.loop ? 'indefinite' : '1';
    isPackage = payload.animationStyle === 'PACKAGE';
  }

  const objectSvg = isPackage 
    ? `<rect x="-10" y="-10" width="20" height="20" fill="#f59e0b" rx="4" stroke="white" stroke-width="2"/>
       <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="white" stroke-width="2"/>` 
    : `<circle cx="0" cy="0" r="8" fill="#22c55e" stroke="#ffffff" stroke-width="3"/>`;

  const cta = payload.target === 'EMAIL' 
    ? `<a href="${payload.ctaUrlPlaceholder}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#4f46e5;color:white;text-align:center;text-decoration:none;border-radius:6px;font-family:sans-serif;font-weight:bold;">Track Shipment</a>` 
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Route Animation Preview</title>
<style>
  body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); max-width: 90vw; width: 100%; box-sizing: border-box; }
  .map-container { display: flex; align-items: center; justify-content: center; border: 4px solid #f1f5f9; border-radius: 12px; background: #e2e8f0; overflow: hidden; margin-bottom: 20px; position: relative; box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);}
  svg { max-width: 100%; height: auto; display: block; overflow: hidden; background: #e2e8f0; }
  .instructions { margin-top: 24px; text-align: left; color: #475569; font-size: 14px; background: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; line-height: 1.6; }
  .instructions code { background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 13px; color: #0f172a; font-family: ui-monospace, SFMono-Regular, monospace; }
  h2 { color: #0f172a; margin-top: 0; margin-bottom: 24px; text-align: center; }
  h3 { color: #1e293b; margin-top: 0; font-size: 16px; font-weight: 700; }
  h4 { color: #334155; margin-top: 20px; margin-bottom: 8px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  ul { margin-top: 8px; margin-bottom: 0; padding-left: 20px; }
  li { margin-bottom: 8px; }
  a { color: #4f46e5; text-decoration: none; font-weight: 500; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="card">
    <h2>${payload.target === 'WEBSITE' ? 'Website Route Animation' : 'Email Route Animation Preview'}</h2>
    <div class="map-container">
      <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
        
        <!-- Real Map Background from OpenStreetMap (WMS) -->
        <image href="${wmsUrl}" x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" preserveAspectRatio="none" />

        <!-- Route Path -->
        <path id="routePath" d="${pathData}" fill="none" stroke="#4f46e5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
        
        <!-- Intermediates -->
        ${intermediatePts.map(pt => `<circle cx="${pt.x.toFixed(2)}" cy="${pt.y.toFixed(2)}" r="6" fill="#f59e0b" stroke="white" stroke-width="2" />`).join('\n        ')}
        
        <!-- Origin/Destination -->
        <circle cx="${originPt.x.toFixed(2)}" cy="${originPt.y.toFixed(2)}" r="8" fill="#10b981" stroke="white" stroke-width="3" />
        <circle cx="${destPt.x.toFixed(2)}" cy="${destPt.y.toFixed(2)}" r="8" fill="#ef4444" stroke="white" stroke-width="3" />
        
        <!-- Animated Object -->
        <g>
          ${objectSvg}
          <animateMotion 
            dur="${duration}s" 
            repeatCount="${loopCount}" 
            path="${pathData}" 
            rotate="auto" />
        </g>
      </svg>
    </div>
    
    <div style="text-align: center;">${cta}</div>

    <div class="instructions">
      <h3>🎨 How to use the payload inside your app</h3>
      <p>This HTML preview uses a mathematically projected SVG map with a real static map image (JPEG) from OpenStreetMap to prove the paths are correct. When implementing this in your own app, here are standard ways to use the JSON data:</p>

      <h4>1. Embedding with a Real Map Engine (Recommended)</h4>
      <ul>
        <li><strong>React-Leaflet / Leaflet:</strong> Use a <code>&lt;Polyline/&gt;</code> for the static route line. For animation, you can use the <a href="https://github.com/bbecquet/Leaflet.Polyline.SnakeAnim" target="_blank">Leaflet.Polyline.SnakeAnim</a> plugin or animate a <code>L.Marker</code> via <code>requestAnimationFrame</code>.</li>
        <li><strong>Mapbox / Maplibre:</strong> Create a <code>GeoJSON</code> source for the simplified route (to draw the line). Animate a <code>Point</code> feature by updating its coordinates over time. (View this PoC's <code>src/components/Map.tsx</code> source code to see an exact example using Maplibre's <code>requestAnimationFrame</code>).</li>
        <li><strong>Google Maps:</strong> Use <code>google.maps.Polyline</code> for the route. You can animate a custom <code>google.maps.SymbolPath</code> along the polyline.</li>
      </ul>

      <h4>2. Standalone SVG Animation (No Map Engine)</h4>
      <p>If you don't want a heavy map library (e.g. for a lightweight marketing page):</p>
      <ul>
        <li>You can copy the exact <code>&lt;svg&gt;</code> block from this page's source code! It relies on standard browser <code>&lt;animateMotion&gt;</code> and uses a free WMS static map background image.</li>
        <li><strong>GSAP / MotionPathPlugin:</strong> If you use GSAP, you can pass the generated SVG path into the MotionPath plugin to smoothly animate any HTML React component along the route.</li>
      </ul>
      
      <h4>3. Quick GIF Export / Email Usage</h4>
      <p>If you need a GIF (e.g., for email), simply use a lightweight screen recording tool to capture the animated map above. The <code>EMAIL</code> JSON payload is heavily simplified precisely so it generates small footprint animations.</p>
    </div>
  </div>
</body>
</html>`;
}
