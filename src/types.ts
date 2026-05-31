export interface Location {
  lat: number;
  lng: number;
}

export interface Waypoint {
  id: string;
  location: Location;
  name: string;
  reason?: string;
}

export type TravelMode = 'DRIVE' | 'BICYCLE' | 'WALK' | 'TWO_WHEELER';

export interface RouteRequestPayload {
  origin: Waypoint;
  destination: Waypoint;
  intermediates: Waypoint[];
  travelMode: TravelMode;
  optimizeWaypointOrder: boolean;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
}

export interface RouteResponsePayload {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  optimizedIntermediateWaypointIndex: number[];
  legs: RouteLeg[];
  rawRequest?: any;
  rawResponse?: any;
}

export type AnimationTarget = 'WEBSITE' | 'EMAIL';
export type AnimationStyle = 'MARKER' | 'PACKAGE';

export interface RouteBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface AnimationGenerationOptions {
  target: AnimationTarget;
  style: AnimationStyle;
  durationSeconds: number;
  loop: boolean;
  simplifyPath: boolean;
}

export interface AnimationPayloadBase {
  target: AnimationTarget;
  routeBounds: RouteBounds;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  origin: Waypoint;
  destination: Waypoint;
  intermediates: Waypoint[];
}

export interface WebsiteAnimationPayload extends AnimationPayloadBase {
  target: 'WEBSITE';
  animationStyle: AnimationStyle;
  recommendedDurationSeconds: number;
  loop: boolean;
  simplifiedPolyline: string;
  pathCoordinatesCount: number;
}

export interface EmailAnimationPayload extends AnimationPayloadBase {
  target: 'EMAIL';
  recommendedFrameCount: number;
  recommendedCanvasWidth: number;
  recommendedCanvasHeight: number;
  recommendedBackgroundStyle: string;
  recommendation: 'STATIC_PNG' | 'SHORT_GIF';
  ctaUrlPlaceholder: string;
  simplifiedCoordinates: Location[];
}

export type AnimationPayload = WebsiteAnimationPayload | EmailAnimationPayload;
