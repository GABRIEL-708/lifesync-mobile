import { AuthUser } from '../store/authStore';
import { getApiBaseUrl } from './apiClient';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const getErrorMessage = (data: any, fallback: string): string => {
  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors[0].msg || data.errors[0].message || fallback;
  }
  return data?.message || fallback;
};

/**
 * Register a new user.
 */
export async function register(
  nombre: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const baseURL = getApiBaseUrl();
  const response = await fetch(`${baseURL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, 'Error al registrarse'));
  }

  return data as AuthResponse;
}

/**
 * Login with email + password.
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const baseURL = getApiBaseUrl();
  const response = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, 'Credenciales inválidas'));
  }

  return data as AuthResponse;
}

export async function logout(): Promise<void> {
  // Manejado en local
}
