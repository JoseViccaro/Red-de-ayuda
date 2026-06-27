import { ReportType, UrgencyLevel } from '@/types';
import { supabase } from './supabase';

interface OfflineReport {
  type: ReportType;
  category_id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  urgency: UrgencyLevel;
  reporter_alias: string;
  contact_info?: string;
  created_at: string;
}

const STORAGE_KEY = 'red-ayuda-offline-reports';

export function saveReportOffline(report: Omit<OfflineReport, 'created_at'>) {
  if (typeof window === 'undefined') return;

  const queue = getOfflineReports();
  const newReport: OfflineReport = {
    ...report,
    created_at: new Date().toISOString(),
  };

  queue.push(newReport);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getOfflineReports(): OfflineReport[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function clearOfflineReports() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function syncOfflineReports(): Promise<{ success: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { success: 0, failed: 0 };
  }

  const reports = getOfflineReports();
  if (reports.length === 0) return { success: 0, failed: 0 };

  let successCount = 0;
  let failedCount = 0;
  const remainingReports: OfflineReport[] = [];

  for (const report of reports) {
    try {
      const { data, error } = await supabase.from('reports').insert({
        type: report.type,
        category_id: report.category_id,
        title: report.title,
        description: report.description,
        latitude: report.latitude,
        longitude: report.longitude,
        urgency: report.urgency,
        reporter_alias: report.reporter_alias,
        contact_info: report.contact_info,
        status: 'activo',
        // Dejamos que Supabase use su created_at por defecto para v1,
        // o mapeamos la fecha offline si cambiamos el schema.
      }).select('id').single();

      if (error) throw error;

      if (data && data.id) {
        const myCreated = JSON.parse(localStorage.getItem('red-ayuda-my-created-reports') || '[]');
        myCreated.push(data.id);
        localStorage.setItem('red-ayuda-my-created-reports', JSON.stringify(myCreated));
      }

      successCount++;
    } catch (err) {
      console.error('Error al sincronizar reporte offline:', err);
      failedCount++;
      remainingReports.push(report);
    }
  }

  if (remainingReports.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingReports));
  } else {
    clearOfflineReports();
  }

  return { success: successCount, failed: failedCount };
}
