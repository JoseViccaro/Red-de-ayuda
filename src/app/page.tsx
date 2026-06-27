'use client';

import { useState, useEffect } from 'react';
import MapLoader from '@/components/MapLoader';
import ReportForm from '@/components/ReportForm';
import ReportDetails from '@/components/ReportDetails';
import PWARegister from '@/components/PWARegister';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Category, Report, ReportType, UrgencyLevel, ValidationType } from '@/types';
import { supabase } from '@/lib/supabase';
import { saveReportOffline, syncOfflineReports, getOfflineReports } from '@/lib/offlineQueue';

// Categorías Mock por defecto si la base de datos no responde
const MOCK_CATEGORIES: Category[] = [
  { id: '1', slug: 'agua', name: 'Agua potable', icon: 'Droplet' },
  { id: '2', slug: 'alimentos', name: 'Alimentos y comida', icon: 'Apple' },
  { id: '3', slug: 'medicinas', name: 'Medicinas y salud', icon: 'HeartPulse' },
  { id: '4', slug: 'refugio', name: 'Refugio y alojamiento', icon: 'Home' },
  { id: '5', slug: 'electricidad', name: 'Electricidad o Carga', icon: 'Zap' },
  { id: '6', slug: 'atencion_medica', name: 'Atención médica', icon: 'Stethoscope' },
  { id: '7', slug: 'transporte', name: 'Transporte o Evacuación', icon: 'Truck' },
  { id: '8', slug: 'internet', name: 'Internet o Comunicación', icon: 'Wifi' },
  { id: '9', slug: 'personas_desaparecidas', name: 'Búsqueda de Personas', icon: 'Users' },
  { id: '10', slug: 'personas_encontradas', name: 'Personas Encontradas', icon: 'UserCheck' },
];

export default function Home() {
  const { coordinates, loading: geoLoading, error: geoError, requestLocation } = useGeolocation();
  
  // Estados principales
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([10.4806, -66.9036]); // Caracas por defecto
  const [activeTab, setActiveTab] = useState<'map' | 'report' | 'list' | 'details'>('map');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
  // Auth y Sesión
  const [userId, setUserId] = useState<string | null>(null);
  const [myCreatedReports, setMyCreatedReports] = useState<string[]>([]);
  const [userVotesMap, setUserVotesMap] = useState<{ [reportId: string]: ValidationType }>({});

  // Filtros
  const [filterType, setFilterType] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingValidation, setIsSubmittingValidation] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Inicialización (Auth Anónima y Carga) y Polling automático
  useEffect(() => {
    initAuthAndLoad();
    
    if (typeof window !== 'undefined') {
      // Cargar reportes creados localmente
      const stored = localStorage.getItem('red-ayuda-my-created-reports');
      if (stored) {
        try {
          setMyCreatedReports(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }

      // Intentar sincronización automática si estamos online
      if (navigator.onLine) {
        handleSync();
      }
    }

    // Consultar nuevos reportes silenciosamente cada 45 segundos si hay red
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && navigator.onLine) {
        fetchReports();
      }
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  // Centrar mapa si se obtienen coordenadas de geolocalización
  useEffect(() => {
    if (coordinates) {
      setMapCenter([coordinates.latitude, coordinates.longitude]);
      setSelectedLocation(coordinates);
    }
  }, [coordinates]);

  const initAuthAndLoad = async () => {
    try {
      // Iniciar sesión de forma anónima de manera silenciosa
      const { data: authData } = await supabase.auth.getSession();
      let session = authData.session;

      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
        session = signInData.session;
      }

      if (session?.user) {
        setUserId(session.user.id);
      }
    } catch (e) {
      console.warn('Autenticación anónima desactivada o error de red. Fallback a sesión local temporal:', e);
      // Generar un ID temporal para que no rompa el tracking de votos si está offline
      if (typeof window !== 'undefined') {
        let tempId = localStorage.getItem('red-ayuda-temp-user-id');
        if (!tempId) {
          tempId = 'temp-' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('red-ayuda-temp-user-id', tempId);
        }
        setUserId(tempId);
      }
    } finally {
      fetchCategories();
      fetchReports();
      updatePendingCount();
    }
  };

  const updatePendingCount = () => {
    setPendingSyncCount(getOfflineReports().length);
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      if (data && data.length > 0) setCategories(data);
    } catch (e) {
      console.warn('Usando categorías locales (Supabase no configurado):', e);
    }
  };

  const fetchReports = async () => {
    try {
      // Consulta con join simple a validaciones para consolidar votos
      const { data, error } = await supabase.from('reports')
        .select('*, validations(*)')
        .eq('status', 'activo');
      
      if (error) throw error;
      if (data) {
        processAndSetReports(data);
      }
    } catch (e) {
      console.warn('Cargando reportes offline/mock:', e);
      // Fallback a mock data
      processAndSetReports([]);
    }
  };

  // Procesar los reportes devueltos de Supabase para calcular totales y votos del usuario actual
  const processAndSetReports = (dbReports: any[]) => {
    const userVotes: { [reportId: string]: ValidationType } = {};

    const formattedReports: Report[] = dbReports.map((r) => {
      const validations = r.validations || [];
      const counts = { confirmado: 0, desactualizado: 0, duplicado: 0, falso: 0 };
      
      validations.forEach((v: any) => {
        if (v.vote in counts) {
          counts[v.vote as ValidationType]++;
        }
        // Guardar si el usuario actual fue quien validó
        if (userId && v.validator_id === userId) {
          userVotes[r.id] = v.vote as ValidationType;
        }
      });

      return {
        ...r,
        validations_count: counts,
      };
    });

    setUserVotesMap(userVotes);

    // Unir con reportes locales pendientes de sincronizar
    const offlineReportsFormatted: Report[] = getOfflineReports().map((r, index) => ({
      ...r,
      id: `offline-${index}`,
      status: 'activo',
      updated_at: r.created_at,
      validations_count: { confirmado: 0, desactualizado: 0, duplicado: 0, falso: 0 },
    }));

    // Si no cargó datos remotos, asegurar al menos que se muestre el mock inicial
    const baseReports = formattedReports.length > 0 ? formattedReports : [];
    setReports([...offlineReportsFormatted, ...baseReports]);
  };

  const handleCreateReport = async (formData: {
    type: ReportType;
    category_id: string;
    title: string;
    description: string;
    urgency: UrgencyLevel;
    reporter_alias: string;
    contact_info?: string;
  }) => {
    if (!selectedLocation) return;
    setIsLoading(true);

    const reportData = {
      ...formData,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      reporter_id: (userId && !userId.startsWith('temp-')) ? userId : undefined,
    };

    if (typeof window !== 'undefined' && !navigator.onLine) {
      saveReportOffline(reportData);
      setSyncStatus('Reporte guardado localmente (Offline).');
      updatePendingCount();
      setIsLoading(false);
      fetchReports();
      setActiveTab('map');
      return;
    }

    try {
      const { data, error } = await supabase.from('reports').insert({
        ...reportData,
        status: 'activo',
      }).select('id').single();
      if (error) throw error;

      if (data && data.id && typeof window !== 'undefined') {
        const updated = [...myCreatedReports, data.id];
        setMyCreatedReports(updated);
        localStorage.setItem('red-ayuda-my-created-reports', JSON.stringify(updated));
      }

      setSyncStatus('Reporte publicado con éxito.');
      fetchReports();
      setActiveTab('map');
    } catch (e) {
      console.error('Error al subir el reporte, guardando offline:', e);
      saveReportOffline(reportData);
      setSyncStatus('Error de conexión. Guardado localmente.');
      updatePendingCount();
      fetchReports();
      setActiveTab('map');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateReport = async (vote: ValidationType) => {
    if (!selectedReport || !userId) return;
    setIsSubmittingValidation(true);

    // Si el reporte es offline local, no se puede votar todavía
    if (selectedReport.id.startsWith('offline-')) {
      alert('No se pueden validar reportes que aún no han sido sincronizados.');
      setIsSubmittingValidation(false);
      return;
    }

    try {
      const { error } = await supabase.from('validations').insert({
        report_id: selectedReport.id,
        validator_id: userId,
        vote,
      });

      if (error) throw error;

      // Actualizar localmente
      setUserVotesMap(prev => ({ ...prev, [selectedReport.id]: vote }));
      
      // Actualizar el listado y el reporte activo en pantalla
      const updatedCount = { ...(selectedReport.validations_count || { confirmado: 0, desactualizado: 0, duplicado: 0, falso: 0 }) };
      updatedCount[vote]++;
      
      const updatedReport = {
        ...selectedReport,
        validations_count: updatedCount,
      };

      setSelectedReport(updatedReport);
      setReports(prev => prev.map(r => r.id === selectedReport.id ? updatedReport : r));

      setSyncStatus('Validación registrada con éxito.');
    } catch (e) {
      console.error('Error al validar reporte:', e);
      alert('Error de conexión al registrar la validación.');
    } finally {
      setIsSubmittingValidation(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    // Si es un reporte guardado localmente (offline) que aún no se sincronizó
    if (reportId.startsWith('offline-')) {
      const index = parseInt(reportId.replace('offline-', ''), 10);
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('red-ayuda-offline-reports');
        if (stored) {
          try {
            const queue = JSON.parse(stored);
            queue.splice(index, 1);
            localStorage.setItem('red-ayuda-offline-reports', JSON.stringify(queue));
            updatePendingCount();
          } catch (e) {
            console.error('Error al manipular cola offline:', e);
          }
        }
      }
      setReports(prev => prev.filter(r => r.id !== reportId));
      setSelectedReport(null);
      setActiveTab('map');
      setSyncStatus('Reporte local eliminado.');
      return;
    }

    // Si es un reporte en el servidor, usamos UPDATE a status='resuelto' (aprovechando RLS)
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'resuelto' })
        .eq('id', reportId);

      if (error) throw error;

      // Remover del estado local para actualizar el mapa y la lista
      setReports(prev => prev.filter(r => r.id !== reportId));
      setSelectedReport(null);
      setActiveTab('map');
      setSyncStatus('Reporte marcado como resuelto / eliminado.');
    } catch (e) {
      console.error('Error al eliminar reporte:', e);
      alert('Error al intentar eliminar el reporte. Verifica tu conexión.');
    }
  };

  const handleSync = async () => {
    setSyncStatus('Sincronizando reportes pendientes...');
    const result = await syncOfflineReports();
    updatePendingCount();
    if (result.success > 0 || result.failed > 0) {
      setSyncStatus(`Sincronización completada: ${result.success} exitosos, ${result.failed} fallidos.`);
      fetchReports();
    } else {
      setSyncStatus('');
    }
  };

  const selectLocationOnMap = (lat: number, lng: number) => {
    setSelectedLocation({ latitude: lat, longitude: lng });
    setMapCenter([lat, lng]);
  };

  const handleSelectReport = (report: Report) => {
    setSelectedReport(report);
    setMapCenter([report.latitude, report.longitude]);
    setActiveTab('details');
  };

  // Filtrar la lista de reportes
  const filteredReports = reports.filter((r) => {
    const typeMatch = filterType === 'all' || r.type === filterType;
    const urgencyMatch = filterUrgency === 'all' || r.urgency === filterUrgency;
    const categoryMatch = filterCategory === 'all' || r.category_id === filterCategory;
    
    // Filtro por texto (busca en título, descripción, alias y datos de contacto)
    const matchesSearch = searchQuery.trim() === '' || 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reporter_alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.contact_info && r.contact_info.toLowerCase().includes(searchQuery.toLowerCase()));

    return typeMatch && urgencyMatch && categoryMatch && matchesSearch;
  });

  return (
    <div className="flex flex-col flex-1 h-dvh bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden">
      {/* PWA Register & Online Detector */}
      <PWARegister />

      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-3 shadow-md flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-1.5">
            🇻🇪 Red de Ayuda
          </h1>
          <p className="text-[10px] text-slate-400">Plataforma Humanitaria Móvil</p>
        </div>
        <div className="flex gap-2">
          {pendingSyncCount > 0 && (
            <button
              onClick={handleSync}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs px-2.5 py-1.5 rounded-full font-bold transition-all shadow animate-pulse"
            >
              🔄 Sincronizar ({pendingSyncCount})
            </button>
          )}
          <button
            onClick={requestLocation}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1.5 rounded-full font-bold transition-all shadow"
            disabled={geoLoading}
          >
            {geoLoading ? 'Buscando GPS...' : '📍 Usar Ubicación'}
          </button>
        </div>
      </header>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-800 text-[11px] font-medium py-1 px-4 text-center">
          {syncStatus}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        
        {/* Panel lateral: visible en desktop, controlado por tabs en móvil */}
        <div className={`
          w-full md:w-96 md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-20 overflow-y-auto
          ${activeTab === 'map' ? 'hidden md:flex' : 'flex'}
          h-full
        `}>
          {activeTab === 'report' ? (
            <div className="p-4">
              <ReportForm
                categories={categories}
                onSubmit={handleCreateReport}
                isLoading={isLoading}
                selectedLocation={selectedLocation}
                onLocationChange={selectLocationOnMap}
              />
              <button 
                onClick={() => setActiveTab('map')} 
                className="w-full mt-3 py-2 text-slate-600 dark:text-slate-400 text-sm font-semibold border border-dashed rounded-lg"
              >
                Volver al mapa
              </button>
            </div>
          ) : activeTab === 'details' && selectedReport ? (
            <div className="p-4">
              <ReportDetails
                report={selectedReport}
                onClose={() => { setSelectedReport(null); setActiveTab('list'); }}
                onValidate={handleValidateReport}
                isSubmitting={isSubmittingValidation}
                userVote={userVotesMap[selectedReport.id] || null}
                currentUserId={userId}
                onDeleteReport={handleDeleteReport}
                myCreatedReports={myCreatedReports}
              />
              <button 
                onClick={() => setActiveTab('map')} 
                className="w-full mt-3 py-2 text-slate-600 dark:text-slate-400 text-sm font-semibold border border-dashed rounded-lg"
              >
                Volver al mapa
              </button>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-4">
              {/* Botón para reportar en Desktop */}
              <button
                onClick={() => setActiveTab('report')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
              >
                ✍️ Crear Nuevo Reporte
              </button>

              <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-slate-100">Filtros Activos</h2>
                {(filterType !== 'all' || filterUrgency !== 'all' || filterCategory !== 'all' || searchQuery !== '') && (
                  <button 
                    onClick={() => { setFilterType('all'); setFilterUrgency('all'); setFilterCategory('all'); setSearchQuery(''); }}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Buscador de Texto */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nombre, C.I., palabra..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Selector de Tipo */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {['all', 'necesidad', 'recurso'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`py-1 text-xs rounded font-medium capitalize ${
                      filterType === t 
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' 
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t === 'all' ? 'Todos' : t}
                  </button>
                ))}
              </div>

              {/* Selector de Urgencia */}
              <div>
                <span className="text-xs font-bold text-slate-400 block mb-1">Filtrar Urgencia</span>
                <select
                  value={filterUrgency}
                  onChange={(e) => setFilterUrgency(e.target.value)}
                  className="w-full text-xs rounded border border-slate-200 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-350"
                >
                  <option value="all">Cualquier urgencia</option>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>

              {/* Lista de reportes actuales */}
              <div className="mt-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Reportes Filtrados ({filteredReports.length})
                </h3>
                <div className="space-y-2">
                  {filteredReports.map((report) => (
                    <div 
                      key={report.id}
                      onClick={() => handleSelectReport(report)}
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">{report.title}</h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          report.type === 'necesidad' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {report.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{report.description}</p>
                      <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400">
                        <span>Por: {report.reporter_alias}</span>
                        <span className="capitalize">{report.urgency}</span>
                      </div>
                    </div>
                  ))}
                  {filteredReports.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-6">No se encontraron reportes con estos filtros.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mapa ocupando todo el fondo */}
        <div className="absolute inset-0 md:relative md:flex-1 w-full h-full z-10">
          <MapLoader
            reports={filteredReports}
            center={mapCenter}
            zoom={13}
            onSelectLocation={selectLocationOnMap}
            interactive={true}
            userLocation={coordinates}
            selectedReportId={selectedReport?.id}
          />
        </div>
      </main>

      {/* Barra de navegación inferior (Mobile) */}
      <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around py-2.5 md:hidden shrink-0 z-30">
        <button
          onClick={() => { setActiveTab('map'); }}
          className={`flex flex-col items-center gap-1 text-xs font-semibold ${
            activeTab === 'map' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>🗺️</span>
          <span>Mapa</span>
        </button>
        <button
          onClick={() => { setActiveTab('report'); }}
          className={`flex flex-col items-center gap-1 text-xs font-semibold ${
            activeTab === 'report' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>✍️</span>
          <span>Reportar</span>
        </button>
        <button
          onClick={() => { setActiveTab('list'); }}
          className={`flex flex-col items-center gap-1 text-xs font-semibold ${
            activeTab === 'list' || activeTab === 'details' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>📋</span>
          <span>Listado</span>
        </button>
      </nav>
    </div>
  );
}
