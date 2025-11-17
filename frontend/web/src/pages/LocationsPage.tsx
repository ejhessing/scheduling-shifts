import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { MapPin, Plus, Edit, Trash2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z.string().min(1, 'ZIP code is required'),
  country: z.string().default('US'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geofenceRadius: z.number().min(10).max(1000).default(100),
  timezone: z.string().default('America/New_York'),
  description: z.string().optional(),
});

type LocationForm = z.infer<typeof locationSchema>;

export default function LocationsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);

  const isManager = ['manager', 'admin', 'owner'].includes(user?.role || '');

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await locationApi.getLocations();
      return response.data.data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LocationForm>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      country: 'US',
      geofenceRadius: 100,
      timezone: 'America/New_York',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LocationForm) => {
      return locationApi.createLocation({
        name: data.name,
        address: {
          street: data.street,
          city: data.city,
          state: data.state,
          zip: data.zip,
          country: data.country,
          lat: data.lat,
          lng: data.lng,
        },
        geofenceRadius: data.geofenceRadius,
        timezone: data.timezone,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setShowModal(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ locationId, data }: { locationId: string; data: LocationForm }) => {
      return locationApi.updateLocation(locationId, {
        name: data.name,
        address: {
          street: data.street,
          city: data.city,
          state: data.state,
          zip: data.zip,
          country: data.country,
          lat: data.lat,
          lng: data.lng,
        },
        geofenceRadius: data.geofenceRadius,
        timezone: data.timezone,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setShowModal(false);
      setEditingLocation(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (locationId: string) => locationApi.deleteLocation(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const handleOpenModal = (location?: any) => {
    if (location) {
      setEditingLocation(location);
      setValue('name', location.name);
      setValue('street', location.address.street);
      setValue('city', location.address.city);
      setValue('state', location.address.state);
      setValue('zip', location.address.zip);
      setValue('country', location.address.country);
      setValue('lat', location.address.lat);
      setValue('lng', location.address.lng);
      setValue('geofenceRadius', location.geofenceRadius);
      setValue('timezone', location.timezone);
      setValue('description', location.description || '');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLocation(null);
    reset();
  };

  const onSubmit = (data: LocationForm) => {
    if (editingLocation) {
      updateMutation.mutate({ locationId: editingLocation.locationId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (locationId: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      deleteMutation.mutate(locationId);
    }
  };

  // Auto-populate lat/lng based on address (placeholder - would use geocoding API in production)
  const handleGeocodeAddress = () => {
    // In production, call a geocoding service like Google Maps API
    alert('Geocoding would happen here. For now, enter lat/lng manually.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Locations</h2>
          <p className="text-gray-600">Manage work locations and geofencing</p>
        </div>
        {isManager && (
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Add Location
          </button>
        )}
      </div>

      {/* Locations list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Loading locations...
          </div>
        ) : !data?.locations || data.locations.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No locations yet</p>
            {isManager && (
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                <Plus className="w-5 h-5 mr-2" />
                Create First Location
              </button>
            )}
          </div>
        ) : (
          data.locations.map((location: any) => (
            <div key={location.locationId} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start">
                  <MapPin className="w-6 h-6 text-primary-600 mr-3 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{location.name}</h3>
                    <p className="text-sm text-gray-600">
                      {location.address.street}, {location.address.city}, {location.address.state}{' '}
                      {location.address.zip}
                    </p>
                  </div>
                </div>
                {isManager && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenModal(location)}
                      className="p-2 text-gray-600 hover:text-primary-600 rounded-lg hover:bg-gray-100"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(location.locationId)}
                      className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Geofence Radius:</span>
                  <span className="font-medium">{location.geofenceRadius}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Timezone:</span>
                  <span className="font-medium">{location.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Coordinates:</span>
                  <span className="font-medium text-xs">
                    {location.address.lat.toFixed(6)}, {location.address.lng.toFixed(6)}
                  </span>
                </div>
                {location.description && (
                  <div className="pt-2 border-t">
                    <p className="text-gray-600">{location.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label htmlFor="name" className="label">
                  Location Name
                </label>
                <input {...register('name')} type="text" id="name" className="input" />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="street" className="label">
                  Street Address
                </label>
                <input {...register('street')} type="text" id="street" className="input" />
                {errors.street && (
                  <p className="mt-1 text-sm text-red-600">{errors.street.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="label">
                    City
                  </label>
                  <input {...register('city')} type="text" id="city" className="input" />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="state" className="label">
                    State
                  </label>
                  <input {...register('state')} type="text" id="state" className="input" />
                  {errors.state && (
                    <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="zip" className="label">
                    ZIP Code
                  </label>
                  <input {...register('zip')} type="text" id="zip" className="input" />
                  {errors.zip && <p className="mt-1 text-sm text-red-600">{errors.zip.message}</p>}
                </div>

                <div>
                  <label htmlFor="country" className="label">
                    Country
                  </label>
                  <input {...register('country')} type="text" id="country" className="input" />
                  {errors.country && (
                    <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lat" className="label">
                    Latitude
                  </label>
                  <input
                    {...register('lat', { valueAsNumber: true })}
                    type="number"
                    step="any"
                    id="lat"
                    className="input"
                  />
                  {errors.lat && <p className="mt-1 text-sm text-red-600">{errors.lat.message}</p>}
                </div>

                <div>
                  <label htmlFor="lng" className="label">
                    Longitude
                  </label>
                  <input
                    {...register('lng', { valueAsNumber: true })}
                    type="number"
                    step="any"
                    id="lng"
                    className="input"
                  />
                  {errors.lng && <p className="mt-1 text-sm text-red-600">{errors.lng.message}</p>}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeocodeAddress}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Auto-detect coordinates from address
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="geofenceRadius" className="label">
                    Geofence Radius (meters)
                  </label>
                  <input
                    {...register('geofenceRadius', { valueAsNumber: true })}
                    type="number"
                    id="geofenceRadius"
                    className="input"
                  />
                  {errors.geofenceRadius && (
                    <p className="mt-1 text-sm text-red-600">{errors.geofenceRadius.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="timezone" className="label">
                    Timezone
                  </label>
                  <select {...register('timezone')} id="timezone" className="input">
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="America/Anchorage">Alaska Time</option>
                    <option value="Pacific/Honolulu">Hawaii Time</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="description" className="label">
                  Description (optional)
                </label>
                <textarea
                  {...register('description')}
                  id="description"
                  rows={3}
                  className="input"
                  placeholder="Additional notes about this location..."
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingLocation
                    ? 'Update Location'
                    : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
