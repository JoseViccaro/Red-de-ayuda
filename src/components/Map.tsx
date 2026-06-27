'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Report } from '@/types';

// Asegurarse de que el CSS de Leaflet esté importado.
// Lo importaremos en el layout principal para que esté disponible globalmente.

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
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
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

    // Capa de mosaico de OpenStreetMap (estilo adaptado para conexiones lentas y limpio)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Inicializar el grupo de clusters
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 40,
    });
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Evento de click para selección manual de ubicación
    if (interactive && onSelectLocation) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        onSelectLocation(lat, lng);

        // Actualizar o crear marcador temporal de selección
        if (selectMarkerRef.current) {
          selectMarkerRef.current.setLatLng(e.latlng);
        } else {
          const selectionIcon = L.divIcon({
            html: `<div class="w-8 h-8 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center text-white shadow-lg animate-bounce">📍</div>`,
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
          <div class="relative flex h-6 w-6">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-6 w-6 bg-blue-600 border-2 border-white shadow-md"></span>
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
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    // Eliminar marcadores viejos que no estén en la lista (removiendo del clusterGroup)
    Object.keys(markersRef.current).forEach((id) => {
      if (!reports.find((r) => r.id === id)) {
        clusterGroup.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    // Agregar o actualizar marcadores nuevos
    reports.forEach((report) => {
      const latLng: L.LatLngExpression = [report.latitude, report.longitude];
      const isSelected = selectedReportId === report.id;

      // Color e ícono basado en tipo de reporte y urgencia
      const isNeed = report.type === 'necesidad';
      const colorClass = isNeed 
        ? (report.urgency === 'critica' ? 'bg-red-600' : 'bg-red-500') 
        : 'bg-emerald-600';
      
      const pulseClass = isSelected ? 'ring-4 ring-offset-2 ring-blue-500 scale-125' : '';
      
      // Personalizar el marcador textual para casos especiales de personas
      let markerText = isNeed ? '⚠️' : '🤝';
      if (report.category_id) {
        // Encontrar la categoría si coincide con personas desaparecidas/encontradas
        const catSlug = reports.find(r => r.id === report.id)?.category_id;
        // (El emoji se mantiene simple y legible en el mapa, pero podemos usar el texto que queramos)
      }

      const customIcon = L.divIcon({
        html: `
          <div class="w-8 h-8 rounded-full ${colorClass} ${pulseClass} border-2 border-white flex items-center justify-center text-white shadow-md transition-all duration-200 cursor-pointer">
            <span class="text-sm font-bold">${markerText}</span>
          </div>
        `,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      if (markersRef.current[report.id]) {
        markersRef.current[report.id].setLatLng(latLng);
        markersRef.current[report.id].setIcon(customIcon);
      } else {
        const marker = L.marker(latLng, { icon: customIcon });
        
        // Crear popup simple para evitar bloating
        const popupContent = `
          <div class="p-1 max-w-[200px]">
            <h3 class="font-bold text-slate-800 text-sm leading-tight">${report.title}</h3>
            <p class="text-xs text-slate-500 mt-1 capitalize">${report.type} - Urgencia: ${report.urgency}</p>
            <p class="text-xs text-slate-600 mt-1 line-clamp-2">${report.description}</p>
          </div>
        `;
        marker.bindPopup(popupContent);
        
        clusterGroup.addLayer(marker);
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
