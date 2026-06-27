'use client';

import { useState } from 'react';
import { Category, ReportType, UrgencyLevel } from '@/types';

interface ReportFormProps {
  categories: Category[];
  onSubmit: (data: {
    type: ReportType;
    category_id: string;
    title: string;
    description: string;
    urgency: UrgencyLevel;
    reporter_alias: string;
    contact_info?: string;
  }) => void;
  isLoading: boolean;
  selectedLocation: { latitude: number; longitude: number } | null;
}

export default function ReportForm({
  categories,
  onSubmit,
  isLoading,
  selectedLocation,
}: ReportFormProps) {
  const [type, setType] = useState<ReportType>('necesidad');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('media');
  const [reporterAlias, setReporterAlias] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!categoryId) {
      setErrorMsg('Por favor selecciona una categoría.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('El título es requerido.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('La descripción es requerida.');
      return;
    }
    if (!reporterAlias.trim()) {
      setErrorMsg('El nombre o alias es requerido para evitar spam.');
      return;
    }
    if (!selectedLocation) {
      setErrorMsg('Debes seleccionar una ubicación en el mapa.');
      return;
    }

    onSubmit({
      type,
      category_id: categoryId,
      title: title.trim(),
      description: description.trim(),
      urgency,
      reporter_alias: reporterAlias.trim(),
      contact_info: contactInfo.trim() || undefined,
    });
  };

  const selectedCategory = categories.find(c => c.id === categoryId);
  const categorySlug = selectedCategory?.slug || '';

  let titlePlaceholder = 'Ej: Pozo de agua activo / Falta comida';
  let descPlaceholder = 'Aporta detalles útiles como horarios, cantidades, etc.';

  if (categorySlug === 'personas_desaparecidas') {
    titlePlaceholder = 'Ej: Juan Pérez (42 años) - Desaparecido';
    descPlaceholder = 'Detalla vestimenta, señas físicas particulares, fecha/hora de desaparición y contacto de familiares.';
  } else if (categorySlug === 'personas_encontradas') {
    titlePlaceholder = 'Ej: Juan Pérez - Encontrado a salvo';
    descPlaceholder = 'Detalla estado de salud actual, refugio u hospital donde se encuentra y formas de contacto.';
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-4 bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-100 dark:border-slate-800">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Crear Nuevo Reporte</h2>
      
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Tipo de Reporte */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350 mb-2">¿Qué estás reportando?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('necesidad')}
            className={`py-2.5 px-4 rounded-lg font-medium border text-center transition-all ${
              type === 'necesidad'
                ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-950/30'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            ⚠️ Necesidad Urgente
          </button>
          <button
            type="button"
            onClick={() => setType('recurso')}
            className={`py-2.5 px-4 rounded-lg font-medium border text-center transition-all ${
              type === 'recurso'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/30'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            🤝 Recurso Disponible
          </button>
        </div>
      </div>

      {/* Categoría */}
      <div>
        <label htmlFor="category" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecciona una opción</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Título */}
      <div>
        <label htmlFor="title" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Título corto</label>
        <input
          type="text"
          id="title"
          placeholder={titlePlaceholder}
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="description" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Detalle o Descripción</label>
        <textarea
          id="description"
          placeholder={descPlaceholder}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Urgencia */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nivel de Urgencia</label>
        <div className="grid grid-cols-4 gap-1.5">
          {(['baja', 'media', 'alta', 'critica'] as UrgencyLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setUrgency(level)}
              className={`py-1.5 text-xs font-semibold rounded-md border text-center capitalize transition-all ${
                urgency === level
                  ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Ubicación actual */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/60 dark:border-slate-800">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Coordenadas del reporte</span>
        {selectedLocation ? (
          <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
            Lat: {selectedLocation.latitude.toFixed(6)}, Lng: {selectedLocation.longitude.toFixed(6)}
          </p>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            ⚠️ Toca el mapa para seleccionar la ubicación exacta del reporte.
          </p>
        )}
      </div>

      {/* Datos del Reportante */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="alias" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Tu Alias o Nombre</label>
          <input
            type="text"
            id="alias"
            placeholder="Ej: Vecino / JuanP"
            maxLength={50}
            value={reporterAlias}
            onChange={(e) => setReporterAlias(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="contact" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contacto (Opcional)</label>
          <input
            type="text"
            id="contact"
            placeholder="Telf / Telegram"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Botón de Envío */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg shadow-md transition-colors"
      >
        {isLoading ? 'Enviando reporte...' : 'Publicar Reporte'}
      </button>
    </form>
  );
}
