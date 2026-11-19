import { apiClient } from './apiClient';
import { getToken } from '../utils/secureStorage';

export interface ControlledMedication {
  nombre: string;
  dosis: string;
  frecuencia: string;
  instrucciones?: string;
  proximaToma?: string;
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
  donanteOrganos?: boolean;
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
 * Enviar ubicación de incidente
 */
export async function sendIncidentLocation(latitud: number, longitud: number): Promise<void> {
  await apiClient.post('/medical-record/location', { latitud, longitud });
}

/**
 * Descarga real de archivo médico o aseguradora (Patrón Strategy en el backend)
 * Realiza fetch autenticado con Bearer JWT y dispara la descarga en el dispositivo.
 */
export async function downloadMedicalFile(format: 'json' | 'csv'): Promise<{ filename: string; size: number }> {
  const baseURL =
    (process.env.EXPO_PUBLIC_API_BASE_URL as string) ?? 'http://localhost:5000/api';
  const token = await getToken();

  const response = await fetch(`${baseURL}/medical-record/export?format=${format}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error en el servidor al exportar (${response.status})`);
  }

  const blob = await response.blob();
  const filename =
    format === 'json'
      ? `LifeSync_HistorialClinico_${new Date().toISOString().slice(0, 10)}.json`
      : `LifeSync_ReporteAseguradora_${new Date().toISOString().slice(0, 10)}.csv`;

  // Descarga en navegador web
  if (typeof window !== 'undefined' && window.document) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return { filename, size: blob.size };
}
