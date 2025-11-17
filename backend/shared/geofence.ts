import * as turf from '@turf/turf';

export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface GeofenceLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
}

export interface GeofenceValidationResult {
  valid: boolean;
  locationId?: string;
  locationName?: string;
  distance?: number; // in meters
  nearestLocationId?: string;
  nearestDistance?: number;
}

/**
 * Validates if a location is within any of the allowed geofences
 */
export const validateGeofence = (
  location: Location,
  allowedLocations: GeofenceLocation[]
): GeofenceValidationResult => {
  if (!allowedLocations || allowedLocations.length === 0) {
    return {
      valid: false,
      distance: undefined,
    };
  }

  const point = turf.point([location.lng, location.lat]);
  let nearestLocation: GeofenceLocation | null = null;
  let nearestDistance = Infinity;

  for (const loc of allowedLocations) {
    const center = turf.point([loc.lng, loc.lat]);
    const distance = turf.distance(point, center, { units: 'meters' });

    // Track nearest location regardless of whether it's within geofence
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLocation = loc;
    }

    // Check if within geofence radius
    const radius = loc.radius || 100; // Default 100 meters
    if (distance <= radius) {
      return {
        valid: true,
        locationId: loc.id,
        locationName: loc.name,
        distance: Math.round(distance),
      };
    }
  }

  // Not within any geofence
  return {
    valid: false,
    nearestLocationId: nearestLocation?.id,
    nearestDistance: Math.round(nearestDistance),
  };
};

/**
 * Calculates distance between two points in meters
 */
export const calculateDistance = (loc1: Location, loc2: Location): number => {
  const point1 = turf.point([loc1.lng, loc1.lat]);
  const point2 = turf.point([loc2.lng, loc2.lat]);
  return turf.distance(point1, point2, { units: 'meters' });
};

/**
 * Checks if a location has acceptable GPS accuracy
 */
export const isAccuracyAcceptable = (
  location: Location,
  maxAccuracy: number = 50
): boolean => {
  if (!location.accuracy) {
    return true; // If no accuracy provided, assume it's acceptable
  }
  return location.accuracy <= maxAccuracy;
};

/**
 * Creates a geofence circle (for visualization purposes)
 */
export const createGeofenceCircle = (
  center: Location,
  radiusInMeters: number,
  steps: number = 64
): turf.Feature<turf.Polygon> => {
  const point = turf.point([center.lng, center.lat]);
  return turf.circle(point, radiusInMeters, { steps, units: 'meters' });
};
