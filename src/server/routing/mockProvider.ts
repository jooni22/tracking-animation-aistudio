import { RoutingProvider } from './provider';
import { RouteRequestPayload, RouteResponsePayload } from '../../types';
import polyline from '@mapbox/polyline';

export class MockProvider implements RoutingProvider {
  async computeRoute(req: RouteRequestPayload): Promise<RouteResponsePayload> {
    const rawRequest = {
      mockProviderParam: 'simulated_provider_osrm',
      inputs: req,
    };
    
    let waypoints = [...req.intermediates];
    let optimizedIndex: number[] = [];
    
    if (req.optimizeWaypointOrder && waypoints.length > 0) {
      // Simulate optimization by reversing the intermediate waypoints indices
      optimizedIndex = Array.from({length: waypoints.length}, (_, i) => waypoints.length - 1 - i);
      const reordered = [];
      for (const i of optimizedIndex) {
        reordered.push(waypoints[i]);
      }
      waypoints = reordered;
    }
    
    const allPoints = [req.origin, ...waypoints, req.destination];
    const coordinatesString = allPoints.map(p => `${p.location.lng},${p.location.lat}`).join(';');
    
    let overallPolyline = "";
    let totalDistance = 0;
    let totalDuration = 0;
    let legs: any[] = [];
    let rawResponse: any = {};

    try {
      const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=polyline`);
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        rawResponse = osrmData;
        if (osrmData.routes && osrmData.routes.length > 0) {
          const route = osrmData.routes[0];
          overallPolyline = route.geometry;
          totalDistance = Math.round(route.distance);
          totalDuration = Math.round(route.duration);
          
          legs = (route.legs || []).map((leg: any) => ({
             distanceMeters: Math.round(leg.distance),
             durationSeconds: Math.round(leg.duration),
             polyline: "", // OSRM doesn't give per-leg polyline easily in this request format without annotations
          }));
        }
      }
    } catch (e) {
      console.error("OSRM fetch failed", e);
    }

    if (!overallPolyline) {
      // Fallback
      let tempDist = 0;
      for (let i = 0; i < allPoints.length - 1; i++) {
        const p1 = allPoints[i].location;
        const p2 = allPoints[i+1].location;
        const dist = Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2)) * 111139; 
        tempDist += dist;
        legs.push({
          distanceMeters: Math.round(dist),
          durationSeconds: Math.round(dist / 10),
          polyline: polyline.encode([[p1.lat, p1.lng], [p2.lat, p2.lng]])
        });
      }
      overallPolyline = polyline.encode(allPoints.map(p => [p.location.lat, p.location.lng] as [number, number]));
      totalDistance = Math.round(tempDist);
      totalDuration = Math.round(tempDist / 10);
      rawResponse = { status: 'FALLBACK_MOCK', notes: "OSRM failed, used straight lines" };
    }

    return {
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      polyline: overallPolyline,
      optimizedIntermediateWaypointIndex: req.optimizeWaypointOrder && optimizedIndex.length > 0 ? optimizedIndex : [],
      legs,
      rawRequest,
      rawResponse,
    };
  }
}
