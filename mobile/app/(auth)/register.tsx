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
import { SafeAreaView } from 'react-native-safe-area-context';
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

  // ── Evaluaciones de seguridad en tiempo real ──
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
      setError('Por seguridad, no uses palabras obvias como "12345678" ni tu nombre.');
      return;
    }
    if (!passwordsMatch) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await register(nombre.trim(), email.trim(), password);
      await saveToken(token);
      // Marca needsOnboarding=true para enviar directo a llenar el expediente clínico
      setAuth(token, user, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardContainer}>
            <View style={styles.brandBadge}>
              <Text style={{ fontSize: 24 }}>❤️‍🩹</Text>
            </View>
            <Text style={styles.title}>LifeSync</Text>
            <Text style={styles.subtitle}>Crea tu cuenta médica protegida</Text>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nombre Completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Juan Pérez"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
                value={nombre}
                onChangeText={setNombre}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="usuario@ejemplo.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Input de Contraseña con botón de Ver/Ocultar */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Contraseña (mínimo 8 caracteres)</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, paddingRight: 40 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>
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
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Confirmar Contraseña</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword.length > 0 &&
                    (passwordsMatch ? styles.inputValid : styles.inputInvalid),
                ]}
                placeholder="Repite tu contraseña"
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
            </View>

            <TouchableOpacity
              style={[styles.button, (!hasMinLength || loading) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || !hasMinLength}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Crear cuenta protegida</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
              <Link href="/(auth)/login" style={styles.link}>
                Inicia sesión
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingVertical: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brandBadge: {
    alignSelf: 'center',
    backgroundColor: '#eef2ff',
    padding: 8,
    borderRadius: 12,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e1b4b',
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
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
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  strengthBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  strengthBarContainer: {
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  checklist: {
    gap: 2,
  },
  checkDone: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  checkPending: {
    fontSize: 11,
    color: '#94a3b8',
  },
  matchText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 2,
  },
  mismatchText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 2,
  },
  button: {
    backgroundColor: '#4338ca',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  footerText: { color: '#64748b', fontSize: 13 },
  link: { color: '#4338ca', fontSize: 13, fontWeight: '700' },
});
