'use client';

import { useState, useCallback } from 'react';

interface GeolocationState {
  coordinates: { latitude: number; longitude: number } | null;
  error: string | null;
  loading: boolean;
  permissionStatus: PermissionState | 'unknown';
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    error: null,
    loading: false,
    permissionStatus: 'unknown',
  });

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'La geolocalización no está soportada por este navegador.',
        loading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          error: null,
          loading: false,
          permissionStatus: 'granted',
        });
      },
      (error) => {
        let errorMsg = 'Error al obtener la ubicación.';
        let newPermission: PermissionState | 'unknown' = 'unknown';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Ubicación denegada. Por favor, actívala en la configuración de tu navegador.';
            newPermission = 'denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'La información de ubicación no está disponible actualmente.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Se agotó el tiempo de espera para obtener la ubicación.';
            break;
        }

        setState((prev) => ({
          ...prev,
          error: errorMsg,
          loading: false,
          permissionStatus: newPermission !== 'unknown' ? newPermission : prev.permissionStatus,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  return {
    ...state,
    requestLocation,
  };
}
