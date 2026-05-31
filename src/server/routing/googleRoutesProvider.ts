import { RoutingProvider } from './provider';
import { RouteRequestPayload, RouteResponsePayload } from '../../types';

/**
 * Developer Notes:
 * To use the real Google Routes API:
 * 1. Ensure `GOOGLE_MAPS_PLATFORM_KEY` is added to your AI Studio secrets / environment.
 * 2. In `server.ts`, swap `MockProvider` for `GoogleRoutesProvider`.
 * 3. Understand how optimization is mapped: When `optimizeWaypointOrder` is true, 
 *    the Google API returns an `optimizedIntermediateWaypointIndex` array. 
 *    We pass this directly to the frontend so it retains the original input order and applies the optimization array visually.
 */
export class GoogleRoutesProvider implements RoutingProvider {
  private apiKey: string;
  private endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  }

  async computeRoute(req: RouteRequestPayload): Promise<RouteResponsePayload> {
    if (!this.apiKey) {
      throw new Error("Missing Google Maps Platform API Key");
    }

    const payload = {
      origin: { location: { latLng: { latitude: req.origin.location.lat, longitude: req.origin.location.lng } } },
      destination: { location: { latLng: { latitude: req.destination.location.lat, longitude: req.destination.location.lng } } },
      intermediates: req.intermediates.map(wpt => ({
        location: { latLng: { latitude: wpt.location.lat, longitude: wpt.location.lng } }
      })),
      travelMode: req.travelMode,
      optimizeWaypointOrder: req.optimizeWaypointOrder,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex,routes.legs',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Routes API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) {
      throw new Error("No route returned from Google");
    }

    return {
      distanceMeters: route.distanceMeters || 0,
      durationSeconds: parseInt(route.duration?.replace('s', '') || '0', 10),
      polyline: route.polyline?.encodedPolyline || '',
      optimizedIntermediateWaypointIndex: route.optimizedIntermediateWaypointIndex || [],
      legs: (route.legs || []).map((leg: any) => ({
        distanceMeters: leg.distanceMeters || 0,
        durationSeconds: parseInt(leg.duration?.replace('s', '') || '0', 10),
        polyline: leg.polyline?.encodedPolyline || '',
      })),
      rawRequest: payload,
      rawResponse: data,
    };
  }
}
