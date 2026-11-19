import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { register } from '../../src/services/authService';
import { useAuthStore } from '../../src/store/authStore';
import { saveToken } from '../../src/utils/secureStorage';

export default function RegisterScreen() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  // ─── Evaluaciones de seguridad en tiempo real ─────────────────────────────
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Detección de patrones inseguros
  const isCommonPattern = useMemo(() => {
    const lower = password.toLowerCase();
    const common = ['12345678', 'password', 'contraseña', 'qwerty', 'admin123', 'admin'];
    if (common.some((c) => lower.includes(c))) return true;
    if (email && email.includes('@')) {
      const userPart = email.split('@')[0].toLowerCase();
      if (userPart.length > 3 && lower.includes(userPart)) return true;
    }
    if (nombre && nombre.trim().length > 3 && lower.includes(nombre.trim().toLowerCase())) {
      return true;
    }
    return false;
  }, [password, email, nombre]);

  // Nivel de seguridad (0 a 4)
  const strengthScore = useMemo(() => {
    let score = 0;
    if (hasMinLength) score++;
    if (hasNumber) score++;
    if (hasUpperCase) score++;
    if (hasSpecialChar) score++;
    if (isCommonPattern && score > 1) score = 1;
    return score;
  }, [hasMinLength, hasNumber, hasUpperCase, hasSpecialChar, isCommonPattern]);

  const strengthLabel = useMemo(() => {
    if (!password) return '';
    if (isCommonPattern) return 'Muy vulnerable (patrón común)';
    if (strengthScore <= 1) return 'Débil';
    if (strengthScore === 2) return 'Media';
    if (strengthScore === 3) return 'Buena';
    return 'Excelente y segura';
  }, [strengthScore, password, isCommonPattern]);

  const strengthColor = useMemo(() => {
    if (isCommonPattern) return '#ef4444';
    if (strengthScore <= 1) return '#ef4444';
    if (strengthScore === 2) return '#f59e0b';
    if (strengthScore === 3) return '#3b82f6';
    return '#10b981';
  }, [strengthScore, isCommonPattern]);

  const handleRegister = async () => {
    setError('');

    // Validaciones estrictas antes del envío
    if (!nombre.trim()) {
      setError('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!hasMinLength) {
      setError('La contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    if (isCommonPattern) {
      setError('Por seguridad, no uses palabras obvias como "12345678", "password" ni tu propio nombre.');
      return;
    }
    if (!passwordsMatch) {
      setError('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await register(nombre.trim(), email.trim(), password);
      await saveToken(token);
      setAuth(token, user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>LifeSync</Text>
        <Text style={styles.subtitle}>Crea tu cuenta médica protegida</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
          value={nombre}
          onChangeText={setNombre}
        />

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico (ej. usuario@gmail.com)"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        {/* Input de Contraseña con botón de Ver/Ocultar */}
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Contraseña (mínimo 8 caracteres)"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
          </TouchableOpacity>
        </View>

        {/* Indicador de Fuerza de Contraseña */}
        {password.length > 0 && (
          <View style={styles.strengthBox}>
            <View style={styles.strengthBarContainer}>
              <View
                style={[
                  styles.strengthBarFill,
                  {
                    width: `${(strengthScore / 4) * 100}%`,
                    backgroundColor: strengthColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.strengthText, { color: strengthColor }]}>
              Seguridad: {strengthLabel}
            </Text>

            {/* Checklist de requisitos de seguridad */}
            <View style={styles.checklist}>
              <Text style={hasMinLength ? styles.checkDone : styles.checkPending}>
                {hasMinLength ? '✓' : '○'} Mínimo 8 caracteres
              </Text>
              <Text style={hasNumber ? styles.checkDone : styles.checkPending}>
                {hasNumber ? '✓' : '○'} Al menos un número (0-9)
              </Text>
              <Text style={hasUpperCase ? styles.checkDone : styles.checkPending}>
                {hasUpperCase ? '✓' : '○'} Al menos una mayúscula (A-Z)
              </Text>
              <Text style={hasSpecialChar ? styles.checkDone : styles.checkPending}>
                {hasSpecialChar ? '✓' : '○'} Al menos un símbolo (!@#$...)
              </Text>
            </View>
          </View>
        )}

        {/* Confirmar Contraseña */}
        <TextInput
          style={[
            styles.input,
            confirmPassword.length > 0 &&
              (passwordsMatch ? styles.inputValid : styles.inputInvalid),
          ]}
          placeholder="Confirmar contraseña"
          placeholderTextColor="#9ca3af"
          secureTextEntry={!showPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {confirmPassword.length > 0 && (
          <Text style={passwordsMatch ? styles.matchText : styles.mismatchText}>
            {passwordsMatch ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas NO coinciden'}
          </Text>
        )}

        {/* Alerta de seguridad para datos médicos */}
        <View style={styles.securityNotice}>
          <Text style={styles.securityTitle}>🛡️ Protección de datos de salud</Text>
          <Text style={styles.securityText}>
            Tu contraseña se encriptará con <Text style={{ fontWeight: '700' }}>bcrypt (12 rondas)</Text>.
            Evita usar tu nombre, fecha de nacimiento o combinaciones obvias.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (!hasMinLength || loading) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || !hasMinLength}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Crear cuenta segura</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Inicia sesión
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f9fafb' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 36,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#4f46e5',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  error: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 14,
    color: '#111827',
  },
  inputValid: {
    borderColor: '#10b981',
    borderWidth: 1.5,
  },
  inputInvalid: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    padding: 6,
  },
  eyeIcon: {
    fontSize: 18,
  },
  strengthBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  strengthBarContainer: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  checklist: {
    gap: 3,
  },
  checkDone: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  checkPending: {
    fontSize: 12,
    color: '#9ca3af',
  },
  matchText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
  mismatchText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
  securityNotice: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 2,
  },
  securityText: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 16,
  },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  footerText: { color: '#6b7280', fontSize: 14 },
  link: { color: '#4f46e5', fontSize: 14, fontWeight: '600' },
});
