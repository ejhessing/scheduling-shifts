import * as turf from '@turf/helpers';
import distance from '@turf/distance';
import { Geofence, GeoLocation } from '../types';

export interface GeofenceValidationResult {
  valid: boolean;
  locationId?: string;
  distance: number; // meters
  message: string;
}

/**
 * Validates if a given location is within any of the allowed geofences
 * @param location The user's current location
 * @param allowedLocations Array of locations with geofence data
 * @returns Validation result with details
 */
export function validateGeofence(
  location: GeoLocation,
  allowedLocations: Array<{ id: string; name: string; geofence: Geofence }>
): GeofenceValidationResult {
  if (!allowedLocations || allowedLocations.length === 0) {
    return {
      valid: false,
      distance: Infinity,
      message: 'No allowed locations configured',
    };
  }

  const userPoint = turf.point([location.longitude, location.latitude]);
  let nearestDistance = Infinity;
  let nearestLocationName = '';

  for (const loc of allowedLocations) {
    const { geofence } = loc;
    const radiusMeters = geofence.radiusMeters || 100;
    const centerPoint = turf.point([geofence.longitude, geofence.latitude]);

    // Calculate distance in kilometers, then convert to meters
    const distanceKm = distance(userPoint, centerPoint, { units: 'kilometers' });
    const distanceMeters = distanceKm * 1000;

    if (distanceMeters <= radiusMeters) {
      return {
        valid: true,
        locationId: loc.id,
        distance: Math.round(distanceMeters),
        message: `Within ${loc.name} geofence`,
      };
    }

    if (distanceMeters < nearestDistance) {
      nearestDistance = distanceMeters;
      nearestLocationName = loc.name;
    }
  }

  return {
    valid: false,
    distance: Math.round(nearestDistance),
    message: `Outside geofence. Nearest location: ${nearestLocationName} (${Math.round(nearestDistance)}m away)`,
  };
}

/**
 * Calculates the distance between two geographic points
 * @param point1 First location
 * @param point2 Second location
 * @returns Distance in meters
 */
export function calculateDistance(point1: GeoLocation, point2: GeoLocation): number {
  const p1 = turf.point([point1.longitude, point1.latitude]);
  const p2 = turf.point([point2.longitude, point2.latitude]);
  const distanceKm = distance(p1, p2, { units: 'kilometers' });
  return distanceKm * 1000; // Convert to meters
}

/**
 * Checks if a location has sufficient GPS accuracy
 * @param location Location to check
 * @param maxAccuracy Maximum allowed accuracy in meters (default: 50m)
 * @returns True if accuracy is acceptable
 */
export function isAccuracyAcceptable(location: GeoLocation, maxAccuracy: number = 50): boolean {
  return location.accuracy <= maxAccuracy;
}

/**
 * Creates a geofence boundary object for visualization
 * @param geofence Geofence configuration
 * @returns Circle coordinates for mapping
 */
export function createGeofenceBoundary(geofence: Geofence): Array<[number, number]> {
  const center = turf.point([geofence.longitude, geofence.latitude]);
  const radiusKm = geofence.radiusMeters / 1000;
  const steps = 64;
  const coordinates: Array<[number, number]> = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 360;
    const point = turf.destination(center, radiusKm, angle, { units: 'kilometers' });
    coordinates.push(point.geometry.coordinates as [number, number]);
  }

  return coordinates;
}
