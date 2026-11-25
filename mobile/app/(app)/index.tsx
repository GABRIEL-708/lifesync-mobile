import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Platform,
  Linking,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import LocationMap from '../../src/components/LocationMap';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Desconocido'] as const;

function isRecordIncomplete(rec: MedicalRecordData | null | undefined): boolean {
  if (!rec) return true;
  const firstContact = rec.contactosEmergencia?.[0];
  const hasPlaceholderContact =
    !firstContact ||
    (firstContact.nombre === 'Contacto inicial' && firstContact.telefono === '000-000-0000');
  return rec.tipoSangre === 'Desconocido' && hasPlaceholderContact;
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { deleteToken } from '../../src/utils/secureStorage';
import {
  getMedicalRecord,
  updateMedicalRecord,
  MedicalRecordData,
  downloadMedicalFile,
} from '../../src/services/medicalService';
import {
  medicalAlertDispatcher,
  MedicalAlert,
} from '../../src/patterns/MedicalAlertObserver';
import {
  gpsStateMachine,
  SensorStatus,
} from '../../src/machines/PermissionStateMachine';
import { initLocalNotifications } from '../../src/services/notificationService';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 360;

  const { user, clearAuth, needsOnboarding, completeOnboarding } = useAuthStore();
  const [record, setRecord] = useState<MedicalRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<'json' | 'csv' | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Estados del Patrón Observer (Alertas Médicas)
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);
  const [activeBannerAlert, setActiveBannerAlert] = useState<MedicalAlert | null>(null);

  // Estados de la Máquina de Estados (GPS / Sensores)
  const [gpsStatus, setGpsStatus] = useState<SensorStatus>(gpsStateMachine.getStatus());

  // Formulario de edición y onboarding inicial
  const [isOnboardingRequired, setIsOnboardingRequired] = useState(needsOnboarding);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBloodType, setFormBloodType] = useState('O+');
  const [formAllergies, setFormAllergies] = useState('');
  const [formConditions, setFormConditions] = useState('');
  const [formMedName, setFormMedName] = useState('');
  const [formMedDose, setFormMedDose] = useState('');
  const [formMedFreq, setFormMedFreq] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formContactRel, setFormContactRel] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // ── Cargar historial clínico ──────────────────────────────────────────────
  const fetchRecord = async () => {
    try {
      setLoading(true);
      const res = await getMedicalRecord();
      setRecord(res.record);
      setIsOffline(res.isOffline);

      if (res.record) {
        const incomplete = isRecordIncomplete(res.record);
        setFormBloodType(res.record.tipoSangre || 'Desconocido');
        setFormAllergies((res.record.alergias || []).join(', '));
        setFormConditions((res.record.condicionesCronicas || []).join(', '));
        setFormNotes(res.record.notasMedicas || '');

        if (res.record.medicamentosControlados?.[0]) {
          setFormMedName(res.record.medicamentosControlados[0].nombre);
          setFormMedDose(res.record.medicamentosControlados[0].dosis);
          setFormMedFreq(res.record.medicamentosControlados[0].frecuencia);
        } else {
          setFormMedName('');
          setFormMedDose('');
          setFormMedFreq('');
        }

        const c = res.record.contactosEmergencia?.[0];
        const isDummyContact = c && c.nombre === 'Contacto inicial' && c.telefono === '000-000-0000';
        if (c && !isDummyContact) {
          setFormContactName(c.nombre);
          setFormContactRel(c.relacion);
          setFormContactPhone(c.telefono);
        } else {
          setFormContactName('');
          setFormContactRel('');
          setFormContactPhone('');
        }

        // Si es cuenta nueva (recién registrada o sin historial llenado), obligar a completarlo primero
        if (needsOnboarding || incomplete) {
          setIsOnboardingRequired(true);
        } else {
          setIsOnboardingRequired(false);
        }
      }
    } catch (err: any) {
      console.warn('Error cargando historial:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
    initLocalNotifications();

    const unsubscribeObserver = medicalAlertDispatcher.subscribe((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setActiveBannerAlert(newAlert);
      setTimeout(() => {
        setActiveBannerAlert((curr) => (curr?.id === newAlert.id ? null : curr));
      }, 7000);
    });

    const unsubscribeGps = gpsStateMachine.subscribe((status) => {
      setGpsStatus(status);
    });

    return () => {
      unsubscribeObserver();
      unsubscribeGps();
      gpsStateMachine.stopWatching();
    };
  }, []);

  // ── Guardar edición de historial ──────────────────────────────────────────
  const handleSaveRecord = async () => {
    setFormError(null);

    const contactName = formContactName.trim();
    const contactRel = formContactRel.trim();
    const contactPhone = formContactPhone.trim();
    const medName = formMedName.trim();
    const medDose = formMedDose.trim();
    const medFreq = formMedFreq.trim();

    if (contactName.length < 2) {
      setFormError('Ingresa el nombre completo de tu contacto de emergencia (mínimo 2 letras).');
      return;
    }
    if (contactRel.length < 2) {
      setFormError('Indica el parentesco o relación del contacto (ej. Madre, Hermano, Pareja).');
      return;
    }
    if (!/^[\d\s+\-()]{7,20}$/.test(contactPhone)) {
      setFormError('Ingresa un teléfono de emergencia válido (7 a 20 dígitos, ej. 999-123-4567).');
      return;
    }
    if (medName.length > 0 && (medName.length < 2 || !medDose || !medFreq)) {
      setFormError('Si registras un medicamento, completa también su dosis y frecuencia.');
      return;
    }

    setSaving(true);
    try {
      const updated: MedicalRecordData = {
        tipoSangre: formBloodType as any,
        alergias: formAllergies.split(',').map((s) => s.trim()).filter(Boolean),
        condicionesCronicas: formConditions.split(',').map((s) => s.trim()).filter(Boolean),
        medicamentosControlados: medName
          ? [
              {
                nombre: medName,
                dosis: medDose,
                frecuencia: medFreq,
              },
            ]
          : [],
        contactosEmergencia: [
          {
            nombre: contactName,
            relacion: contactRel,
            telefono: contactPhone,
          },
        ],
        notasMedicas: formNotes.trim() || 'Historial validado con esquemas Zod en LifeSync.',
      };

      const res = await updateMedicalRecord(updated);
      const wasOnboarding = isOnboardingRequired || needsOnboarding;
      setRecord(res);
      setIsOnboardingRequired(false);
      completeOnboarding();
      setEditModalVisible(false);
      setFormError(null);
      Alert.alert(
        '¡Listo!',
        wasOnboarding
          ? 'Tu historial clínico quedó registrado. Ya puedes usar LifeSync.'
          : 'Historial médico actualizado correctamente.'
      );
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el historial.');
    } finally {
      setSaving(false);
    }
  };

  // ── Alertas Médicas (Observer) ────────────────────────────────────────────
  const handleTriggerMedAlert = () => {
    const med = record?.medicamentosControlados?.[0]?.nombre || 'Salbutamol';
    const dose = record?.medicamentosControlados?.[0]?.dosis || '100 mcg';
    medicalAlertDispatcher.triggerCriticalMedicationAlert(
      med,
      dose,
      'Administrar con espaciador. Monitorear frecuencia respiratoria.'
    );
  };

  const handleTriggerAnomalyAlert = () => {
    medicalAlertDispatcher.triggerAnomalyAlert(
      'Taquicardia en Reposo',
      'Frecuencia de 128 bpm detectada. Se recomienda reposo de inmediato.'
    );
  };

  // ── Descargar archivos reales con Patrón Strategy ──────────────────────────
  const handleDownloadStrategy = async (format: 'json' | 'csv') => {
    setDownloading(format);
    setDownloadSuccessMessage(null);
    try {
      const { filename, size } = await downloadMedicalFile(format);
      const sizeKb = (size / 1024).toFixed(1);
      const msg = `✓ Archivo "${filename}" (${sizeKb} KB) descargado exitosamente.`;
      setDownloadSuccessMessage(msg);
      setTimeout(() => setDownloadSuccessMessage(null), 5000);
    } catch (err: any) {
      Alert.alert('Descarga', err.message || 'Descargando archivo...');
    } finally {
      setDownloading(null);
    }
  };

  const handleGrantPermission = () => {
    // Solicitud REAL al sistema operativo (expo-location)
    gpsStateMachine.requestRealPermission();
  };

  const handleDenyPermission = () => {
    // Simula que el usuario rechaza el permiso para demostrar la Degradación Gradual
    gpsStateMachine.startRequest();
    setTimeout(() => {
      gpsStateMachine.deny(false);
    }, 300);
  };

  const handleRefreshLocation = () => {
    gpsStateMachine.refreshLocation();
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const handleLogout = async () => {
    await deleteToken();
    clearAuth();
  };

  // Helper para mostrar el nombre amigable del estado FSM sin romper el ancho
  const getFsmStateLabel = (st: string) => {
    switch (st) {
      case 'IDLE':
        return 'IDLE';
      case 'REQUESTING':
        return 'SOLICITANDO';
      case 'GRANTED':
        return 'CONCEDIDO';
      case 'DENIED_SOFT':
        return 'DENEGADO';
      case 'PERMANENTLY_BLOCKED':
        return 'BLOQUEADO';
      default:
        return st;
    }
  };

  const mustCompleteRecord = needsOnboarding || isOnboardingRequired;

  // Formulario reutilizable para pantalla inicial obligatoria y modal de edición
  const renderMedicalFormFields = () => (
    <>
      {/* SECCIÓN 1: TIPO DE SANGRE */}
      <View style={styles.formSection}>
        <Text style={styles.formSectionTitle}>🩸 1. Tipo de Sangre</Text>
        <Text style={styles.formHint}>Toca una opción para seleccionarla:</Text>
        <View style={styles.bloodTypeGrid}>
          {BLOOD_TYPES.map((bt) => {
            const selected = formBloodType === bt;
            return (
              <TouchableOpacity
                key={bt}
                style={[styles.bloodChip, selected && styles.bloodChipSelected]}
                onPress={() => setFormBloodType(bt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.bloodChipText, selected && styles.bloodChipTextSelected]}>
                  {bt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SECCIÓN 2: ALERGIAS Y CONDICIONES */}
      <View style={styles.formSection}>
        <Text style={styles.formSectionTitle}>⚠️ 2. Alergias y Condiciones</Text>

        <Text style={styles.formLabel}>Alergias conocidas (opcional)</Text>
        <Text style={styles.formHint}>Escribe cada alergia separada por una coma</Text>
        <TextInput
          style={styles.formInput}
          value={formAllergies}
          onChangeText={setFormAllergies}
          placeholder="Ej. Penicilina, Mariscos, Polen"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.formLabel}>Enfermedades o condiciones crónicas (opcional)</Text>
        <Text style={styles.formHint}>Déjalo vacío si no tienes ninguna</Text>
        <TextInput
          style={styles.formInput}
          value={formConditions}
          onChangeText={setFormConditions}
          placeholder="Ej. Asma, Hipertensión, Diabetes"
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* SECCIÓN 3: MEDICAMENTO CONTROLADO */}
      <View style={styles.formSection}>
        <Text style={styles.formSectionTitle}>💊 3. Medicamento Controlado (opcional)</Text>
        <Text style={styles.formHint}>
          Si tomas algún medicamento importante, indica sus datos:
        </Text>

        <Text style={styles.formLabel}>Nombre del medicamento</Text>
        <TextInput
          style={styles.formInput}
          value={formMedName}
          onChangeText={setFormMedName}
          placeholder="Ej. Salbutamol inhalador, Metformina"
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.formRowTwoCols}>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>Dosis</Text>
            <TextInput
              style={styles.formInput}
              value={formMedDose}
              onChangeText={setFormMedDose}
              placeholder="Ej. 100 mcg / 500 mg"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>Frecuencia</Text>
            <TextInput
              style={styles.formInput}
              value={formMedFreq}
              onChangeText={setFormMedFreq}
              placeholder="Ej. Cada 8 horas"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
      </View>

      {/* SECCIÓN 4: CONTACTO DE EMERGENCIA */}
      <View style={styles.formSection}>
        <Text style={styles.formSectionTitle}>📞 4. Contacto de Emergencia *</Text>
        <Text style={styles.formHint}>
          Obligatorio: persona a llamar en caso de accidente o urgencia
        </Text>

        <Text style={styles.formLabel}>Nombre completo del contacto *</Text>
        <TextInput
          style={styles.formInput}
          value={formContactName}
          onChangeText={setFormContactName}
          placeholder="Ej. María González"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
        />

        <Text style={styles.formLabel}>Parentesco o relación *</Text>
        <TextInput
          style={styles.formInput}
          value={formContactRel}
          onChangeText={setFormContactRel}
          placeholder="Ej. Madre, Padre, Pareja, Hermano"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.formLabel}>Número de teléfono *</Text>
        <TextInput
          style={styles.formInput}
          value={formContactPhone}
          onChangeText={setFormContactPhone}
          placeholder="Ej. 999-123-4567"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
        />
      </View>

      {/* SECCIÓN 5: NOTAS MÉDICAS */}
      <View style={[styles.formSection, { marginBottom: 4 }]}>
        <Text style={styles.formSectionTitle}>📝 5. Notas Médicas (opcional)</Text>
        <Text style={styles.formLabel}>Indicaciones extra para paramédicos</Text>
        <TextInput
          style={[styles.formInput, { minHeight: 56, textAlignVertical: 'top' }]}
          value={formNotes}
          onChangeText={setFormNotes}
          placeholder="Ej. Uso lentes de contacto, alergia al látex..."
          placeholderTextColor="#94a3b8"
          multiline
        />
      </View>
    </>
  );

  // ── PANTALLA COMPLETA OBLIGATORIA AL REGISTRAR NUEVA CUENTA ───────────────
  if (mustCompleteRecord) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.responsiveWrapper}>
              <View style={styles.headerCard}>
                <View style={styles.headerTopRow}>
                  <View style={styles.brandRow}>
                    <View style={styles.brandBadge}>
                      <Text style={{ fontSize: 16 }}>🩺</Text>
                    </View>
                    <Text style={styles.brandTitle}>Expediente Clínico</Text>
                  </View>
                  <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutBtnText}>Salir</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.patientName} numberOfLines={1}>
                  Hola, {user?.nombre || 'Paciente'}
                </Text>
                <Text style={styles.patientEmail}>
                  Paso obligatorio antes de entrar a LifeSync
                </Text>
              </View>

              <View style={styles.onboardingBanner}>
                <Text style={styles.onboardingBannerText}>
                  👋 ¡Cuenta creada con éxito! Para poder continuar, completa tu Historial Clínico de Emergencia.
                </Text>
              </View>

              <View style={styles.card}>
                {renderMedicalFormFields()}

                {!!formError && (
                  <View style={styles.formErrorBox}>
                    <Text style={styles.formErrorText}>⚠️ {formError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btnSave, { marginTop: 14, paddingVertical: 13, alignItems: 'center' }]}
                  onPress={handleSaveRecord}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.btnSaveText, { fontSize: 14 }]}>
                      Guardar Expediente y Continuar →
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveWrapper}>
          {/* ── 1. HEADER MODERNO ── */}
          <View style={styles.headerCard}>
            <View style={styles.headerTopRow}>
              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <Text style={{ fontSize: 16 }}>❤️‍🩹</Text>
                </View>
                <Text style={styles.brandTitle}>LifeSync</Text>
              </View>

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.patientName} numberOfLines={1}>
              {user?.nombre || 'Paciente Titular'}
            </Text>
            <Text style={styles.patientEmail} numberOfLines={1}>
              {user?.email || 'demo@lifesync.com'}
            </Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusPill, isOffline ? styles.pillOffline : styles.pillOnline]}>
                <View style={[styles.statusDot, isOffline ? styles.dotOffline : styles.dotOnline]} />
                <Text style={[styles.statusText, isOffline ? styles.textOffline : styles.textOnline]}>
                  {isOffline ? 'Modo Avión (Caché)' : 'En Línea (TLS / HTTPS)'}
                </Text>
              </View>
              <Text style={styles.cryptoTag}>🔒 AES-256 / JWT</Text>
            </View>
          </View>

          {/* ── 2. EXPEDIENTE CLÍNICO DE EMERGENCIA ── */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardIcon}>🪪</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>Expediente Médico Vital</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.editButtonText}>✏️ Editar</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color="#4f46e5" style={{ marginVertical: 24 }} />
            ) : (
              <View style={styles.recordContent}>
                {/* Tipo de Sangre Card */}
                <View style={styles.bloodTypeCard}>
                  <View style={styles.bloodTypeCircle}>
                    <Text style={styles.bloodTypeLetter}>{record?.tipoSangre || 'O+'}</Text>
                  </View>
                  <View style={styles.bloodTypeInfo}>
                    <Text style={styles.bloodTypeTitle}>Tipo de Sangre</Text>
                    <Text style={styles.bloodTypeSubtitle} numberOfLines={2}>
                      Dato vital para transfusiones de emergencia
                    </Text>
                  </View>
                </View>

                {/* Alergias */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>⚠️ Alergias Registradas</Text>
                  <View style={styles.tagsFlex}>
                    {(record?.alergias || []).length > 0 ? (
                      record?.alergias.map((a, i) => (
                        <View key={i} style={styles.allergyTag}>
                          <Text style={styles.allergyTagText} numberOfLines={1}>⛔ {a}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.placeholderText}>Sin alergias conocidas</Text>
                    )}
                  </View>
                </View>

                {/* Condiciones Crónicas */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>🩺 Condiciones Crónicas</Text>
                  <View style={styles.tagsFlex}>
                    {(record?.condicionesCronicas || []).length > 0 ? (
                      record?.condicionesCronicas.map((c, i) => (
                        <View key={i} style={styles.conditionTag}>
                          <Text style={styles.conditionTagText} numberOfLines={1}>• {c}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.placeholderText}>Ninguna condición crónica reportada</Text>
                    )}
                  </View>
                </View>

                {/* Medicamentos Controlados */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>💊 Medicamentos Controlados</Text>
                  {(record?.medicamentosControlados || []).length > 0 ? (
                    (record?.medicamentosControlados || []).map((m, i) => (
                      <View key={i} style={styles.medicationRow}>
                        <View style={styles.medicationInfoCol}>
                          <Text style={styles.medicationName} numberOfLines={1}>{m.nombre}</Text>
                          <Text style={styles.medicationFreq} numberOfLines={1}>🕒 {m.frecuencia}</Text>
                        </View>
                        <View style={styles.doseBadge}>
                          <Text style={styles.doseBadgeText}>{m.dosis}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.placeholderText}>Sin medicamentos controlados registrados</Text>
                  )}
                </View>

                {/* Contactos de Emergencia */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>📞 Contacto de Emergencia</Text>
                  {(record?.contactosEmergencia || []).map((c, i) => (
                    <View key={i} style={styles.contactRow}>
                      <View style={styles.contactIconCircle}>
                        <Text style={{ fontSize: 13 }}>👤</Text>
                      </View>
                      <View style={styles.contactInfoCol}>
                        <Text style={styles.contactNameText} numberOfLines={1}>{c.nombre}</Text>
                        <Text style={styles.contactRelText} numberOfLines={1}>{c.relacion}</Text>
                      </View>
                      <View style={styles.contactPhoneBadge}>
                        <Text style={styles.contactPhoneText} numberOfLines={1}>📞 {c.telefono}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* ── 3. PATRÓN OBSERVER: ALERTAS MÉDICAS ── */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardIcon}>🔔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>Centro de Alertas Médicas</Text>
                  <Text style={styles.cardBadgeTag}>Patrón de Diseño Observer</Text>
                </View>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              Los observadores se suscriben reactivamente para disparar recordatorios de medicamentos y anomalías en tiempo real.
            </Text>

            {/* Botones de acción simétrica adaptables */}
            <View style={[styles.buttonGrid, isSmallScreen && styles.buttonGridStacked]}>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: '#4f46e5' }]}
                onPress={handleTriggerMedAlert}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionButtonText, { color: '#4f46e5' }]}>
                  ⏰ Recordatorio
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { borderColor: '#dc2626' }]}
                onPress={handleTriggerAnomalyAlert}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>
                  🚨 Simular Anomalía
                </Text>
              </TouchableOpacity>
            </View>

            {/* Historial de Alertas */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.historyTitle}>Alertas Recientes ({alerts.length})</Text>
              {alerts.length === 0 ? (
                <View style={styles.emptyAlertsBox}>
                  <Text style={{ fontSize: 20 }}>🔕</Text>
                  <Text style={styles.emptyAlertsTitle}>Sin alertas activas</Text>
                  <Text style={styles.emptyAlertsSubtitle}>
                    Presiona un botón para verificar el patrón Observer
                  </Text>
                </View>
              ) : (
                alerts.slice(0, 3).map((a) => (
                  <View
                    key={a.id}
                    style={[
                      styles.alertHistoryItem,
                      a.nivelPrioridad === 'CRITICA' ? styles.alertCritBorder : styles.alertHighBorder,
                    ]}
                  >
                    <View style={styles.alertHistoryTop}>
                      <Text style={styles.alertHistoryTitle} numberOfLines={1}>{a.titulo}</Text>
                      <Text style={styles.alertHistoryTime}>{a.timestamp}</Text>
                    </View>
                    <Text style={styles.alertHistoryBody} numberOfLines={2}>{a.mensaje}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* ── 4. PATRÓN STRATEGY: EXPORTACIÓN REAL ── */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardIcon}>📤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>Exportación de Expediente</Text>
                  <Text style={styles.cardBadgeTag}>Patrón de Diseño Strategy</Text>
                </View>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              El servidor transforma los datos bajo demanda según el receptor mediante estrategias dinámicas intercambiables:
            </Text>

            <View style={styles.strategyCardsColumn}>
              {/* Opción 1: JSON Hospitales */}
              <View style={styles.strategyItem}>
                <View style={styles.strategyItemTextCol}>
                  <Text style={styles.strategyItemTitle}>Sistemas Hospitalarios</Text>
                  <Text style={styles.strategyItemDesc}>Formato: JSON Clínico (Estándar HL7)</Text>
                </View>
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: '#4338ca' }]}
                  onPress={() => handleDownloadStrategy('json')}
                  disabled={downloading !== null}
                  activeOpacity={0.8}
                >
                  {downloading === 'json' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.downloadBtnText}>⬇️ .JSON</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Opción 2: CSV Aseguradoras */}
              <View style={styles.strategyItem}>
                <View style={styles.strategyItemTextCol}>
                  <Text style={styles.strategyItemTitle}>Compañías de Seguros</Text>
                  <Text style={styles.strategyItemDesc}>Formato: Tabular CSV Sanitizado</Text>
                </View>
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: '#059669' }]}
                  onPress={() => handleDownloadStrategy('csv')}
                  disabled={downloading !== null}
                  activeOpacity={0.8}
                >
                  {downloading === 'csv' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.downloadBtnText}>⬇️ .CSV</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── 5. MÁQUINA DE ESTADOS Y DEGRADACIÓN GRADUAL ── */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardIcon}>🛰️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>Máquina de Estados de Sensores</Text>
                  <Text style={styles.cardBadgeTag}>FSM + Graceful Degradation</Text>
                </View>
              </View>
            </View>

            {/* Pasos FSM compactos y adaptativos */}
            <View style={styles.fsmFlowContainer}>
              <View style={[styles.fsmChip, gpsStatus.state === 'IDLE' && styles.fsmChipActive]}>
                <Text style={styles.fsmChipText}>IDLE</Text>
              </View>
              <Text style={styles.fsmArrow}>→</Text>
              <View style={[styles.fsmChip, gpsStatus.state === 'REQUESTING' && styles.fsmChipActive]}>
                <Text style={styles.fsmChipText}>SOLICITUD</Text>
              </View>
              <Text style={styles.fsmArrow}>→</Text>
              <View
                style={[
                  styles.fsmChip,
                  gpsStatus.state === 'GRANTED' ? styles.fsmChipGreen : styles.fsmChipOrange,
                ]}
              >
                <Text style={styles.fsmChipText}>{getFsmStateLabel(gpsStatus.state)}</Text>
              </View>
            </View>

            {/* Mensaje de Degradación */}
            <View
              style={[
                styles.degradationBox,
                gpsStatus.state === 'GRANTED' ? styles.boxGreen : styles.boxYellow,
              ]}
            >
              <Text style={styles.degradationTitle}>
                {gpsStatus.state === 'GRANTED'
                  ? '🟢 GPS Activo: Coordenadas reales en tiempo real'
                  : gpsStatus.state === 'REQUESTING'
                  ? '⏳ Solicitando permiso...'
                  : gpsStatus.state === 'IDLE'
                  ? '📍 GPS inactivo'
                  : '🛡️ Degradación Gradual Activa'}
              </Text>
              <Text style={styles.degradationMsg}>{gpsStatus.statusMessage}</Text>
              {!!gpsStatus.error && (
                <Text style={[styles.degradationMsg, { color: '#b91c1c', marginTop: 4 }]}>
                  ⚠️ {gpsStatus.error}
                </Text>
              )}
            </View>

            {/* ── MAPA + COORDENADAS REALES ── */}
            {gpsStatus.state === 'GRANTED' && (
              gpsStatus.lastLocation ? (
                <View>
                  <LocationMap fix={gpsStatus.lastLocation} />
                  <View style={styles.coordsGrid}>
                    <View style={styles.coordCell}>
                      <Text style={styles.coordLabel}>Latitud</Text>
                      <Text style={styles.coordValue}>{gpsStatus.lastLocation.lat.toFixed(6)}</Text>
                    </View>
                    <View style={styles.coordCell}>
                      <Text style={styles.coordLabel}>Longitud</Text>
                      <Text style={styles.coordValue}>{gpsStatus.lastLocation.lng.toFixed(6)}</Text>
                    </View>
                    <View style={styles.coordCell}>
                      <Text style={styles.coordLabel}>Precisión</Text>
                      <Text style={styles.coordValue}>
                        {gpsStatus.lastLocation.accuracy != null
                          ? `± ${Math.round(gpsStatus.lastLocation.accuracy)} m`
                          : '—'}
                      </Text>
                    </View>
                    <View style={styles.coordCell}>
                      <Text style={styles.coordLabel}>Altitud</Text>
                      <Text style={styles.coordValue}>
                        {gpsStatus.lastLocation.altitude != null
                          ? `${Math.round(gpsStatus.lastLocation.altitude)} m`
                          : '—'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.coordFooterRow}>
                    <Text style={styles.coordTimestamp}>
                      🕒 Última lectura: {new Date(gpsStatus.lastLocation.timestamp).toLocaleTimeString()}
                    </Text>
                    <TouchableOpacity onPress={handleRefreshLocation} style={styles.refreshBtn}>
                      <Text style={styles.refreshBtnText}>↻ Actualizar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <ActivityIndicator color="#4f46e5" />
                  <Text style={styles.mapPlaceholderText}>Obteniendo señal GPS...</Text>
                </View>
              )
            )}

            {gpsStatus.state === 'PERMANENTLY_BLOCKED' && (
              <TouchableOpacity style={styles.settingsBtn} onPress={handleOpenSettings}>
                <Text style={styles.settingsBtnText}>⚙️ Abrir Ajustes para activar ubicación</Text>
              </TouchableOpacity>
            )}

            {/* Botones de permisos */}
            <View style={[styles.buttonGrid, isSmallScreen && styles.buttonGridStacked]}>
              <TouchableOpacity
                style={[
                  styles.fsmActionBtn,
                  { backgroundColor: '#10b981' },
                  gpsStatus.state === 'REQUESTING' && { opacity: 0.6 },
                ]}
                onPress={handleGrantPermission}
                disabled={gpsStatus.state === 'REQUESTING'}
                activeOpacity={0.8}
              >
                <Text style={styles.fsmActionBtnText}>
                  {gpsStatus.state === 'GRANTED' ? '✓ GPS Activo' : '📍 Activar GPS real'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fsmActionBtn, { backgroundColor: '#ef4444' }]}
                onPress={handleDenyPermission}
                activeOpacity={0.8}
              >
                <Text style={styles.fsmActionBtnText}>✗ Simular Denegación</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── NOTIFICACIÓN FLOTANTE OBSERVER (renderizada al final para quedar encima) ── */}
      {activeBannerAlert && (
        <View style={styles.floatingBannerContainer} pointerEvents="box-none">
          <View
            style={[
              styles.floatingAlertBanner,
              activeBannerAlert.tipo === 'CRITICAL_MEDICATION' && styles.floatingAlertBannerMed,
            ]}
          >
            <Text style={styles.floatingIcon}>
              {activeBannerAlert.tipo === 'CRITICAL_MEDICATION' ? '💊' : '🚨'}
            </Text>
            <View style={styles.floatingTextContainer}>
              <Text style={styles.floatingAlertTitle} numberOfLines={2}>
                {activeBannerAlert.titulo}
              </Text>
              <Text style={styles.floatingAlertMsg} numberOfLines={3}>
                {activeBannerAlert.mensaje}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.floatingCloseBtn}
              onPress={() => setActiveBannerAlert(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.floatingCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── NOTIFICACIÓN DE DESCARGA STRATEGY ── */}
      {downloadSuccessMessage && (
        <View style={styles.downloadNotificationBanner} pointerEvents="none">
          <Text style={styles.downloadNotificationText}>{downloadSuccessMessage}</Text>
        </View>
      )}

      {/* ── MODAL RESPONSIVO DE EDICIÓN Y REGISTRO INICIAL ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!isOnboardingRequired) setEditModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalTitle}>
                  {isOnboardingRequired
                    ? '🩺 Completa tu Historial Clínico'
                    : '✏️ Editar Expediente Médico'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {isOnboardingRequired
                    ? 'Paso obligatorio al crear cuenta para activar tu perfil de emergencia'
                    : 'Actualiza tus datos vitales y de contacto'}
                </Text>
              </View>
              {!isOnboardingRequired && (
                <TouchableOpacity
                  style={styles.modalCloseIconBtn}
                  onPress={() => {
                    setFormError(null);
                    setEditModalVisible(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {isOnboardingRequired && (
              <View style={styles.onboardingBanner}>
                <Text style={styles.onboardingBannerText}>
                  👋 ¡Bienvenido a LifeSync! Llena tus datos médicos antes de continuar para que estén disponibles en caso de emergencia.
                </Text>
              </View>
            )}

            <ScrollView
              style={{ maxHeight: 430 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {renderMedicalFormFields()}
            </ScrollView>

            {!!formError && (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>⚠️ {formError}</Text>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              {isOnboardingRequired ? (
                <TouchableOpacity style={styles.btnCancel} onPress={handleLogout}>
                  <Text style={[styles.btnCancelText, { color: '#dc2626' }]}>Cerrar sesión</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => {
                    setFormError(null);
                    setEditModalVisible(false);
                  }}
                >
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.btnSave}
                onPress={handleSaveRecord}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnSaveText}>
                    {isOnboardingRequired ? 'Guardar y continuar →' : 'Guardar cambios'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  // Banner Flotante Alerta
  floatingBannerContainer: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    alignItems: 'center',
  },
  floatingAlertBannerMed: { backgroundColor: '#3730a3', borderColor: '#818cf8' },
  floatingAlertBanner: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#991b1b',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  floatingIcon: { fontSize: 20, marginRight: 8 },
  floatingTextContainer: { flex: 1, marginRight: 6 },
  floatingAlertTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  floatingAlertMsg: { color: '#fee2e2', fontSize: 11, marginTop: 2, lineHeight: 14 },
  floatingCloseBtn: { padding: 4 },
  floatingCloseText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Banner Descarga
  downloadNotificationBanner: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 9998,
    elevation: 19,
    backgroundColor: '#065f46',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  downloadNotificationText: { color: '#ecfdf5', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Header Card
  headerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandBadge: {
    backgroundColor: '#1e293b',
    padding: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  brandTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc', letterSpacing: 0.5 },
  logoutBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  patientName: { fontSize: 17, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  patientEmail: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillOnline: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  pillOffline: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  dotOnline: { backgroundColor: '#10b981' },
  dotOffline: { backgroundColor: '#ef4444' },
  statusText: { fontSize: 10, fontWeight: '700' },
  textOnline: { color: '#34d399' },
  textOffline: { color: '#f87171' },
  cryptoTag: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },

  // Cards Estándar
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 },
  cardIcon: { fontSize: 18, marginRight: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  cardBadgeTag: { fontSize: 9, color: '#4f46e5', fontWeight: '800', textTransform: 'uppercase', marginTop: 1 },
  cardDescription: { fontSize: 11, color: '#64748b', lineHeight: 16, marginBottom: 12 },
  editButton: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    flexShrink: 0,
  },
  editButtonText: { color: '#4338ca', fontWeight: '700', fontSize: 11 },

  // Expediente Vital
  recordContent: { gap: 10 },
  bloodTypeCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bloodTypeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e11d48',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bloodTypeLetter: { color: '#fff', fontSize: 17, fontWeight: '900' },
  bloodTypeInfo: { flex: 1, marginLeft: 10 },
  bloodTypeTitle: { fontSize: 13, fontWeight: '800', color: '#9f1239' },
  bloodTypeSubtitle: { fontSize: 10, color: '#be123c', marginTop: 1 },

  infoSection: { marginTop: 2 },
  infoSectionTitle: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 5, textTransform: 'uppercase' },
  tagsFlex: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  allergyTag: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    maxWidth: '100%',
  },
  allergyTagText: { color: '#991b1b', fontSize: 11, fontWeight: '700' },
  conditionTag: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    maxWidth: '100%',
  },
  conditionTagText: { color: '#334155', fontSize: 11, fontWeight: '600' },
  placeholderText: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic' },

  medicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  medicationInfoCol: { flex: 1, paddingRight: 8 },
  medicationName: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  medicationFreq: { fontSize: 10, color: '#64748b', marginTop: 2 },
  doseBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  doseBadgeText: { fontSize: 10, color: '#4338ca', fontWeight: '800' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  contactIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  contactInfoCol: { flex: 1, minWidth: 120, paddingHorizontal: 4 },
  contactNameText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  contactRelText: { fontSize: 10, color: '#64748b' },
  contactPhoneBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    flexShrink: 0,
  },
  contactPhoneText: { fontSize: 10, color: '#065f46', fontWeight: '700' },

  // Botones Simétricos
  buttonGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  buttonGridStacked: { flexDirection: 'column' },
  actionButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  actionButtonText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },

  // Observer Historial
  historyTitle: { fontSize: 11, fontWeight: '800', color: '#334155', marginBottom: 6 },
  emptyAlertsBox: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyAlertsTitle: { fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 4 },
  emptyAlertsSubtitle: { fontSize: 10, color: '#94a3b8', marginTop: 1, textAlign: 'center', paddingHorizontal: 8 },
  alertHistoryItem: {
    borderRadius: 8,
    padding: 9,
    marginBottom: 6,
    borderLeftWidth: 4,
  },
  alertCritBorder: { backgroundColor: '#fef2f2', borderLeftColor: '#dc2626' },
  alertHighBorder: { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b' },
  alertHistoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertHistoryTitle: { fontSize: 11, fontWeight: '800', color: '#0f172a', flex: 1, paddingRight: 6 },
  alertHistoryTime: { fontSize: 9, color: '#64748b', fontWeight: '600' },
  alertHistoryBody: { fontSize: 10, color: '#334155', marginTop: 2, lineHeight: 14 },

  // Strategy Items
  strategyCardsColumn: { gap: 8 },
  strategyItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  strategyItemTextCol: { flex: 1 },
  strategyItemTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  strategyItemDesc: { fontSize: 10, color: '#64748b', marginTop: 1 },
  downloadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  downloadBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // FSM Flow
  fsmFlowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  fsmChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#cbd5e1',
  },
  fsmChipActive: { backgroundColor: '#4f46e5' },
  fsmChipGreen: { backgroundColor: '#10b981' },
  fsmChipOrange: { backgroundColor: '#f59e0b' },
  fsmChipText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  fsmArrow: { marginHorizontal: 4, color: '#94a3b8', fontWeight: '800', fontSize: 11 },

  degradationBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  boxGreen: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  boxYellow: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  degradationTitle: { fontSize: 11, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  degradationMsg: { fontSize: 10, color: '#334155', lineHeight: 14 },
  fsmActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsmActionBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center' },

  // Mapa y coordenadas reales
  coordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  coordCell: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  coordLabel: { fontSize: 9, color: '#64748b', fontWeight: '800', textTransform: 'uppercase' },
  coordValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coordFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  coordTimestamp: { fontSize: 10, color: '#64748b', flex: 1 },
  refreshBtn: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshBtnText: { fontSize: 11, color: '#4338ca', fontWeight: '800' },
  mapPlaceholder: {
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapPlaceholderText: { fontSize: 11, color: '#64748b', marginTop: 6, fontWeight: '700' },
  settingsBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginBottom: 10,
  },
  settingsBtnText: { fontSize: 11, color: '#9a3412', fontWeight: '800' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  modalCloseIconBtn: { padding: 4 },
  onboardingBanner: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  onboardingBannerText: { fontSize: 11, color: '#3730a3', fontWeight: '700', lineHeight: 16 },
  formSection: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  formSectionTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  formHint: { fontSize: 10, color: '#64748b', marginBottom: 4 },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginTop: 6, marginBottom: 3 },
  formInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
  },
  formRowTwoCols: { flexDirection: 'row', gap: 8 },
  bloodTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  bloodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  bloodChipSelected: {
    backgroundColor: '#e11d48',
    borderColor: '#be123c',
  },
  bloodChipText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  bloodChipTextSelected: { color: '#ffffff' },
  formErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  formErrorText: { fontSize: 11, color: '#b91c1c', fontWeight: '700' },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  btnCancel: { paddingVertical: 8, paddingHorizontal: 12 },
  btnCancelText: { color: '#64748b', fontWeight: '700', fontSize: 12 },
  btnSave: {
    backgroundColor: '#4338ca',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnSaveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
