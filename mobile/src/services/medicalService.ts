import { apiClient } from './apiClient';

export interface ControlledMedication {
  nombre: string;
  dosis: string;
  frecuencia: string;
  instrucciones?: string;
}

export interface EmergencyContact {
  nombre: string;
  relacion: string;
  telefono: string;
}

export interface MedicalRecordData {
  id?: string;
  tipoSangre: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Desconocido';
  alergias: string[];
  condicionesCronicas: string[];
  medicamentosControlados: ControlledMedication[];
  contactosEmergencia: EmergencyContact[];
  notasMedicas?: string;
  ultimaUbicacionIncidente?: {
    latitud: number;
    longitud: number;
    timestamp?: string;
  } | null;
}

/**
 * Obtener mi historial médico (con interceptor de Bearer Token y fallback a cache local)
 */
export async function getMedicalRecord(): Promise<{ record: MedicalRecordData; isOffline: boolean }> {
  const result = await apiClient.get<MedicalRecordData>('/medical-record/me');
  return {
    record: result.data,
    isOffline: Boolean(result.fromCache),
  };
}

/**
 * Actualizar historial médico
 */
export async function updateMedicalRecord(record: MedicalRecordData): Promise<MedicalRecordData> {
  const result = await apiClient.put<MedicalRecordData>('/medical-record/me', record);
  return result.data;
}

/**
 * Enviar ubicación de incidente (si el permiso GPS fue concedido)
 */
export async function sendIncidentLocation(latitud: number, longitud: number): Promise<void> {
  await apiClient.post('/medical-record/location', { latitud, longitud });
}

/**
 * Exportar historial médico en formato JSON o CSV (Patrón Strategy en el servidor)
 */
export function getExportUrl(format: 'json' | 'csv'): string {
  const baseURL =
    (process.env.EXPO_PUBLIC_API_BASE_URL as string) ?? 'http://localhost:5000/api';
  return `${baseURL}/medical-record/export?format=${format}`;
}
