import { RouteRequestPayload, RouteResponsePayload } from '../../types';

export interface RoutingProvider {
  computeRoute(req: RouteRequestPayload): Promise<RouteResponsePayload>;
}
