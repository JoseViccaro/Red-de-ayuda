export type ReportType = 'recurso' | 'necesidad';

export type UrgencyLevel = 'baja' | 'media' | 'alta' | 'critica';

export type ReportStatus = 'activo' | 'resuelto' | 'bloqueado';

export type ValidationType = 'confirmado' | 'desactualizado' | 'duplicado' | 'falso';

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string;
}

export interface Report {
  id: string;
  reporter_id?: string;
  type: ReportType;
  category_id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  urgency: UrgencyLevel;
  reporter_alias: string;
  contact_info?: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  // Campos adicionales opcionales para la UI o agregados
  distance?: number;
  validations_count?: {
    confirmado: number;
    desactualizado: number;
    duplicado: number;
    falso: number;
  };
}

export interface Validation {
  id: string;
  report_id: string;
  validator_id: string;
  vote: ValidationType;
  created_at: string;
}
