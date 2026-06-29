'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Report } from '@/types';

interface MapProps {
  reports: Report[];
  center: [number, number];
  zoom: number;
  onSelectLocation?: (lat: number, lng: number) => void;
  interactive?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedReportId?: string | null;
}

export default function Map({
  reports,
  center,
  zoom,
  onSelectLocation,
  interactive = false,
  userLocation,
  selectedReportId,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // The marker layer can be either a MarkerClusterGroup (if plugin loaded) or
  // a plain FeatureGroup (fallback). Both share the addLayer/removeLayer API.
  const markerLayerRef = useRef<L.FeatureGroup | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const selectMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Limpiar el contenedor antes de inicializar para evitar el error "Map container is already initialized"
    // común en React 18/Strict Mode en producción
    mapContainerRef.current.innerHTML = '';
    
    // Crear la instancia del mapa
    const map = L.map(mapContainerRef.current).setView(center, zoom);
    mapRef.current = map;

    // Capa de mosaico de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Usar MarkerCluster si está disponible, con fallback a FeatureGroup
    let markerLayer: L.FeatureGroup;
    if (typeof L.markerClusterGroup === 'function') {
      markerLayer = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 40,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let bg = '#2563eb'; // blue-600
          let ring = 'rgba(59,130,246,0.3)';

          if (count > 100) {
            bg = '#dc2626'; // red-600
            ring = 'rgba(239,68,68,0.3)';
          } else if (count > 20) {
            bg = '#f59e0b'; // amber-500
            ring = 'rgba(245,158,11,0.3)';
          }

          return L.divIcon({
            html: `<div style="width:40px;height:40px;border-radius:50%;background:${bg};box-shadow:0 0 0 4px ${ring},0 2px 8px rgba(0,0,0,0.3);border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:white;">${count}</div>`,
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
        }
      });
    } else {
      markerLayer = L.featureGroup();
    }

    map.addLayer(markerLayer);
    markerLayerRef.current = markerLayer;

    // Evento de click para selección manual de ubicación
    if (interactive && onSelectLocation) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        onSelectLocation(lat, lng);

        if (selectMarkerRef.current) {
          selectMarkerRef.current.setLatLng(e.latlng);
        } else {
          const selectionIcon = L.divIcon({
            html: `<div style="width:32px;height:32px;background:#f59e0b;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">📍</div>`,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          });
          selectMarkerRef.current = L.marker(e.latlng, { icon: selectionIcon }).addTo(map);
        }
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Actualizar centro del mapa cuando cambie
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center]);

  // Manejar ubicación del usuario
  useEffect(() => {
    if (!mapRef.current || !userLocation) {
      if (userMarkerRef.current && mapRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const latLng: L.LatLngExpression = [userLocation.latitude, userLocation.longitude];

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latLng);
    } else {
      const userIcon = L.divIcon({
        html: `
          <div style="position:relative;width:24px;height:24px;">
            <span style="position:absolute;display:inline-flex;width:100%;height:100%;border-radius:50%;background:#60a5fa;opacity:0.75;animation:ping 1s cubic-bezier(0,0,0.2,1) infinite;"></span>
            <span style="position:relative;display:inline-flex;width:24px;height:24px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></span>
          </div>
        `,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      userMarkerRef.current = L.marker(latLng, { icon: userIcon })
        .addTo(mapRef.current)
        .bindPopup('Tu ubicación actual');
    }
  }, [userLocation]);

  // Actualizar marcadores de reportes
  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    // Eliminar marcadores viejos que ya no están en la lista
    Object.keys(markersRef.current).forEach((id) => {
      if (!reports.find((r) => r.id === id)) {
        markerLayer.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    // Agregar o actualizar marcadores
    reports.forEach((report) => {
      const latLng: L.LatLngExpression = [report.latitude, report.longitude];
      const isSelected = selectedReportId === report.id;

      const isNeed = report.type === 'necesidad';
      const bg = isNeed
        ? (report.urgency === 'critica' ? '#dc2626' : '#ef4444')
        : '#059669';

      const ring = isSelected
        ? 'box-shadow:0 0 0 4px rgba(59,130,246,0.5),0 2px 8px rgba(0,0,0,0.3);transform:scale(1.25);'
        : 'box-shadow:0 1px 4px rgba(0,0,0,0.3);';

      const markerText = isNeed ? '⚠️' : '🤝';

      const customIcon = L.divIcon({
        html: `<div style="width:32px;height:32px;border-radius:50%;background:${bg};border:2px solid white;display:flex;align-items:center;justify-content:center;${ring}cursor:pointer;transition:all 0.2s;"><span style="font-size:14px;">${markerText}</span></div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      if (markersRef.current[report.id]) {
        markersRef.current[report.id].setLatLng(latLng);
        markersRef.current[report.id].setIcon(customIcon);
      } else {
        const marker = L.marker(latLng, { icon: customIcon });

        const popupContent = `
          <div style="padding:4px;max-width:200px;">
            <h3 style="font-weight:700;color:#1e293b;font-size:14px;line-height:1.3;margin:0;">${report.title}</h3>
            <p style="font-size:11px;color:#64748b;margin:4px 0 0;text-transform:capitalize;">${report.type} - Urgencia: ${report.urgency}</p>
            <p style="font-size:11px;color:#475569;margin:4px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${report.description}</p>
          </div>
        `;
        marker.bindPopup(popupContent);

        markerLayer.addLayer(marker);
        markersRef.current[report.id] = marker;
      }
    });
  }, [reports, selectedReportId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-10" />
    </div>
  );
}
