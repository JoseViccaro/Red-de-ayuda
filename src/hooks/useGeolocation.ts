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

    const getPosition = (highAccuracy: boolean) => {
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
          // Si falló el intento de alta precisión (por timeout o no disponible), reintentamos inmediatamente con baja precisión
          if (highAccuracy && (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)) {
            console.warn('Fallo alta precisión, intentando baja precisión...');
            getPosition(false);
            return;
          }

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
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 6000 : 12000,
          maximumAge: 300000, // 5 minutos de caché para respuesta más rápida
        }
      );
    };

    getPosition(true);
  }, []);

  return {
    ...state,
    requestLocation,
  };
}
