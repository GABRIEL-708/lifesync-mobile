import { getToken, saveToken, deleteToken } from '../utils/secureStorage';

const API_BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string) ??
  'http://localhost:5000/api';

const OFFLINE_CACHE_KEY = 'lifesync_offline_medical_cache';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INTERCEPTOR HTTP GLOBAL CON SOPORTE OFFLINE / MODO AVIÓN
 * Extrae automáticamente el JWT de hardware seguro y lo inyecta como Bearer token.
 * Si no hay conexión (Modo Avión), intercepta y recupera los datos de caché local.
 * ══════════════════════════════════════════════════════════════════════════════
 */
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Petición genérica con interceptor de autorización y caché offline
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; fromCache?: boolean }> {
    const url = `${this.baseURL}${endpoint}`;
    const token = await getToken();

    // ── 1. Interceptor de Request: inyección de Bearer Token ───────────────────
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // ── 2. Interceptor de Response: detección de token expirado ─────────────
      if (response.status === 401) {
        await deleteToken();
        throw new Error('Sesión expirada. Por favor vuelve a iniciar sesión.');
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message =
          errorBody?.errors?.[0]?.message ||
          errorBody?.message ||
          `Error en la petición (${response.status})`;
        throw new Error(message);
      }

      const responseData = await response.json();

      // Guardar en caché offline para la prueba de fuego de Modo Avión
      if (endpoint.includes('/medical-record') && options.method !== 'GET') {
        // Se actualizó en la nube
      } else if (endpoint === '/medical-record/me' && responseData?.data) {
        await this.saveOfflineCache(responseData.data);
      }

      return { data: responseData.data ?? responseData, fromCache: false };
    } catch (networkError: any) {
      // ── 3. Manejo de Desconexión / Modo Avión (Prueba de Fuego) ─────────────
      // Si la petición falla por falta de internet y es consulta de historial,
      // servimos los datos desde la caché local sin crashear la app.
      if (
        endpoint === '/medical-record/me' ||
        networkError.message.includes('fetch') ||
        networkError.message.includes('Network')
      ) {
        const cached = await this.getOfflineCache();
        if (cached) {
          console.warn('[ApiClient] Modo Offline / Avión detectado: sirviendo caché local.');
          return { data: cached as T, fromCache: true };
        }
      }

      throw networkError;
    }
  }

  // Métodos auxiliares HTTP
  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // Caché local para Modo Avión
  private async saveOfflineCache(data: any): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OFFLINE_CACHE_KEY, serialized);
      }
    } catch {
      // Ignorar si falla el storage
    }
  }

  private async getOfflineCache(): Promise<any | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(OFFLINE_CACHE_KEY);
        return item ? JSON.parse(item) : null;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
