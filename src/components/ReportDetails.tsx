'use client';

import { Report, ValidationType } from '@/types';
import { useState } from 'react';

interface ReportDetailsProps {
  report: Report;
  onClose: () => void;
  onValidate: (vote: ValidationType) => void;
  isSubmitting: boolean;
  userVote: ValidationType | null;
  currentUserId?: string | null;
  onDeleteReport?: (reportId: string) => Promise<void>;
}

export default function ReportDetails({
  report,
  onClose,
  onValidate,
  isSubmitting,
  userVote,
  currentUserId,
  onDeleteReport,
}: ReportDetailsProps) {
  const [errorMsg, setErrorMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleVote = (vote: ValidationType) => {
    setErrorMsg('');
    if (userVote) {
      setErrorMsg('Ya has validado este reporte.');
      return;
    }
    onValidate(vote);
  };

  const isNeed = report.type === 'necesidad';
  const urgencyColors = {
    baja: 'bg-blue-100 text-blue-800',
    media: 'bg-amber-100 text-amber-800',
    alta: 'bg-orange-100 text-orange-800',
    critica: 'bg-red-100 text-red-800 animate-pulse',
  };

  // Sumar votos de validación comunitarios
  const confirms = report.validations_count?.confirmado || 0;
  const outdateds = report.validations_count?.desactualizado || 0;
  const duplicates = report.validations_count?.duplicado || 0;
  const fakes = report.validations_count?.falso || 0;
  
  const totalVotes = confirms + outdateds + duplicates + fakes;

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-100 dark:border-slate-800 space-y-4">
      {/* Cabecera */}
      <div className="flex justify-between items-start">
        <div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            isNeed ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {report.type === 'necesidad' ? '⚠️ Necesidad' : '🤝 Recurso'}
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2 leading-tight">
            {report.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1"
          aria-label="Cerrar detalles"
        >
          ✕
        </button>
      </div>

      {/* Etiquetas e Info */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded font-semibold capitalize ${urgencyColors[report.urgency]}`}>
          Urgencia: {report.urgency}
        </span>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
          Publicado por: <span className="font-bold">{report.reporter_alias}</span>
        </span>
      </div>

      {/* Descripción */}
      <div className="text-sm text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
        <p className="whitespace-pre-wrap leading-relaxed">{report.description}</p>
      </div>

      {/* Información de Contacto */}
      {report.contact_info && (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-500 block mb-0.5">Contacto / Canal:</span>
          <span className="font-mono bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-800 block break-all">
            {report.contact_info}
          </span>
        </div>
      )}

      {/* Fecha */}
      <p className="text-[10px] text-slate-400">
        Actualizado: {new Date(report.updated_at).toLocaleString('es-VE')}
      </p>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* Sección de Validación Comunitaria */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Validación Comunitaria ({totalVotes} votos)
        </h3>

        {errorMsg && (
          <p className="text-xs text-red-600 font-semibold">{errorMsg}</p>
        )}

        {/* Botones de Voto */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleVote('confirmado')}
            disabled={isSubmitting || !!userVote}
            className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-between transition-all ${
              userVote === 'confirmado'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/20'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <span>✅ Sigue Activo</span>
            <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
              {confirms}
            </span>
          </button>

          <button
            onClick={() => handleVote('desactualizado')}
            disabled={isSubmitting || !!userVote}
            className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-between transition-all ${
              userVote === 'desactualizado'
                ? 'bg-amber-50 border-amber-500 text-amber-800 dark:bg-amber-950/20'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <span>⚠️ Desactualizado</span>
            <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
              {outdateds}
            </span>
          </button>

          <button
            onClick={() => handleVote('duplicado')}
            disabled={isSubmitting || !!userVote}
            className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-between transition-all ${
              userVote === 'duplicado'
                ? 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-950/20'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <span>🔗 Duplicado</span>
            <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
              {duplicates}
            </span>
          </button>

          <button
            onClick={() => handleVote('falso')}
            disabled={isSubmitting || !!userVote}
            className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-between transition-all ${
              userVote === 'falso'
                ? 'bg-red-50 border-red-500 text-red-800 dark:bg-red-950/20'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <span>❌ Falso / Spam</span>
            <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
              {fakes}
            </span>
          </button>
        </div>

        {userVote && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold text-center mt-1">
            ✓ Tu validación ha sido registrada. ¡Gracias por ayudar!
          </p>
        )}
      </div>

      {/* Botón de Eliminar para el Creador */}
      {currentUserId && report.reporter_id === currentUserId && (
        <div className="pt-2">
          <button
            onClick={async () => {
              if (window.confirm('¿Estás seguro de que querés eliminar este reporte?')) {
                setIsDeleting(true);
                try {
                  if (onDeleteReport) {
                    await onDeleteReport(report.id);
                  }
                } catch (err) {
                  console.error(err);
                  setErrorMsg('Error al intentar eliminar el reporte.');
                } finally {
                  setIsDeleting(false);
                }
              }
            }}
            disabled={isDeleting}
            className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            🗑️ {isDeleting ? 'Eliminando...' : 'Eliminar mi Reporte'}
          </button>
        </div>
      )}
    </div>
  );
}
