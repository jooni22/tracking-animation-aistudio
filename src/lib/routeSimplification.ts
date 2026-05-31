import { Location } from '../types';
import polylineLib from '@mapbox/polyline';

// A simple 2D point interface
interface Point {
  x: number; // lng
  y: number; // lat
}

function getSqDist(p1: Point, p2: Point) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function getSqSegDist(p: Point, p1: Point, p2: Point) {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function simplifyRadialDist(points: Point[], sqTolerance: number) {
  let prevPoint = points[0];
  const newPoints = [prevPoint];
  let point: Point;

  for (let i = 1, len = points.length; i < len; i++) {
    point = points[i];
    if (getSqDist(point, prevPoint) > sqTolerance) {
      newPoints.push(point);
      prevPoint = point;
    }
  }
  if (prevPoint !== point!) {
    newPoints.push(point!);
  }
  return newPoints;
}

function simplifyDPStep(points: Point[], first: number, last: number, sqTolerance: number, simplified: Point[]) {
  let maxSqDist = sqTolerance;
  let index = -1;

  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], points[first], points[last]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

function simplifyDouglasPeucker(points: Point[], sqTolerance: number) {
  const last = points.length - 1;
  const simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);
  return simplified;
}

export function simplifyPoints(points: Point[], tolerance: number, highestQuality: boolean = false) {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  const initialPoints = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
  return simplifyDouglasPeucker(initialPoints, sqTolerance);
}

export function parseAndSimplifyPolyline(polylineStr: string, tolerance: number): Location[] {
  try {
    const coords = polylineLib.decode(polylineStr);
    const points: Point[] = coords.map(c => ({ y: c[0], x: c[1] }));
    const simplified = simplifyPoints(points, tolerance);
    return simplified.map(p => ({ lat: p.y, lng: p.x }));
  } catch (err) {
    console.error("Failed to parse and simplify polyline", err);
    return [];
  }
}
