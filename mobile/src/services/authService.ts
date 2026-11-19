import { AuthUser } from '../store/authStore';

// Allow overriding via app.json extra or a build-time env variable.
const API_BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string) ??
  'http://localhost:5000/api/auth';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const getErrorMessage = (data: any, fallback: string): string => {
  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors[0].msg || fallback;
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
  const response = await fetch(`${API_BASE_URL}/register`, {
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
  const response = await fetch(`${API_BASE_URL}/login`, {
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

/**
 * Logout (placeholder for any server-side token invalidation if needed).
 */
export async function logout(): Promise<void> {
  // Client-side token removal is handled by the store / secure storage.
}
