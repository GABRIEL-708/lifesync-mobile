import Constants from 'expo-constants';
import { getToken, deleteToken } from '../utils/secureStorage';

/**
 * URL pública del backend desplegado en Render (HTTPS / TLS).
 * Es la URL por defecto en todos los entornos (iPhone, Android, Web).
 */
export const RENDER_API_BASE_URL = 'https://lifesync-mobile.onrender.com/api';

export function getApiBaseUrl(): string {
  // 1. Override explícito por variable de entorno (ej. EXPO_PUBLIC_API_BASE_URL en mobile/.env)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }

  // 2. Desarrollo local opcional: EXPO_PUBLIC_USE_LOCAL_API=true usa el backend de la laptop
  if (process.env.EXPO_PUBLIC_USE_LOCAL_API === 'true') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const h = window.location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') {
        return 'http://localhost:5000/api';
      }
    }
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host && /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      return `http://${host}:5000/api`;
    }
  }

  // 3. Producción por defecto: backend público en Render
  return RENDER_API_BASE_URL;
}

const OFFLINE_CACHE_KEY = 'lifesync_offline_medical_cache';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INTERCEPTOR HTTP GLOBAL CON SOPORTE OFFLINE / MODO AVIÓN
 * Extrae automáticamente el JWT de hardware seguro y lo inyecta como Bearer token.
 * Si no hay conexión (Modo Avión), intercepta y recupera los datos de caché local.
 * ══════════════════════════════════════════════════════════════════════════════
 */
class ApiClient {
  private getBaseURL(): string {
    return getApiBaseUrl();
  }

  /**
   * Petición genérica con interceptor de autorización y caché offline
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; fromCache?: boolean }> {
    const url = `${this.getBaseURL()}${endpoint}`;
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
      if (endpoint === '/medical-record/me' && responseData?.data) {
        await this.saveOfflineCache(responseData.data);
      }

      return { data: responseData.data ?? responseData, fromCache: false };
    } catch (networkError: any) {
      // ── 3. Manejo de Desconexión / Modo Avión (Prueba de Fuego) ─────────────
      if (
        endpoint === '/medical-record/me' ||
        networkError.message.includes('fetch') ||
        networkError.message.includes('Network') ||
        networkError.message.includes('connect') ||
        networkError.message.includes('timed out')
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

  private async saveOfflineCache(data: any): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OFFLINE_CACHE_KEY, serialized);
      }
    } catch {
      // Ignorar si no está disponible
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

export const apiClient = new ApiClient();
