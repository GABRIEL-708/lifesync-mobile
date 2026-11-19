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
} from 'react-native';
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

export default function HomeScreen() {
  const { user, clearAuth } = useAuthStore();
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

  // Formulario de edición
  const [formBloodType, setFormBloodType] = useState('O+');
  const [formAllergies, setFormAllergies] = useState('');
  const [formConditions, setFormConditions] = useState('');
  const [formMedName, setFormMedName] = useState('');
  const [formMedDose, setFormMedDose] = useState('');
  const [formMedFreq, setFormMedFreq] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formContactRel, setFormContactRel] = useState('');

  // ── 1. Cargar historial clínico al montar ──────────────────────────────────
  const fetchRecord = async () => {
    try {
      setLoading(true);
      const res = await getMedicalRecord();
      setRecord(res.record);
      setIsOffline(res.isOffline);

      if (res.record) {
        setFormBloodType(res.record.tipoSangre || 'O+');
        setFormAllergies((res.record.alergias || []).join(', '));
        setFormConditions((res.record.condicionesCronicas || []).join(', '));
        if (res.record.medicamentosControlados?.[0]) {
          setFormMedName(res.record.medicamentosControlados[0].nombre);
          setFormMedDose(res.record.medicamentosControlados[0].dosis);
          setFormMedFreq(res.record.medicamentosControlados[0].frecuencia);
        }
        if (res.record.contactosEmergencia?.[0]) {
          setFormContactName(res.record.contactosEmergencia[0].nombre);
          setFormContactRel(res.record.contactosEmergencia[0].relacion);
          setFormContactPhone(res.record.contactosEmergencia[0].telefono);
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

    // ── 2. Suscribir Observador de Alertas Médicas (Patrón Observer) ───────────
    const unsubscribeObserver = medicalAlertDispatcher.subscribe((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
      setActiveBannerAlert(newAlert);
      // Auto-ocultar banner flotante tras 6 segundos
      setTimeout(() => {
        setActiveBannerAlert((curr) => (curr?.id === newAlert.id ? null : curr));
      }, 6000);
    });

    // ── 3. Suscribir a la Máquina de Estados de Permisos ───────────────────────
    const unsubscribeGps = gpsStateMachine.subscribe((status) => {
      setGpsStatus(status);
    });

    return () => {
      unsubscribeObserver();
      unsubscribeGps();
    };
  }, []);

  // ── Guardar edición de historial ──────────────────────────────────────────
  const handleSaveRecord = async () => {
    setSaving(true);
    try {
      const updated: MedicalRecordData = {
        tipoSangre: formBloodType as any,
        alergias: formAllergies.split(',').map((s) => s.trim()).filter(Boolean),
        condicionesCronicas: formConditions.split(',').map((s) => s.trim()).filter(Boolean),
        medicamentosControlados: [
          {
            nombre: formMedName.trim() || 'Medicamento',
            dosis: formMedDose.trim() || '1 dosis',
            frecuencia: formMedFreq.trim() || 'Diario',
          },
        ],
        contactosEmergencia: [
          {
            nombre: formContactName.trim() || 'Contacto de Emergencia',
            relacion: formContactRel.trim() || 'Familiar',
            telefono: formContactPhone.trim() || '000-000-0000',
          },
        ],
        notasMedicas: 'Historial validado con esquemas Zod en LifeSync.',
      };

      const res = await updateMedicalRecord(updated);
      setRecord(res);
      setEditModalVisible(false);
      Alert.alert('Éxito', 'Historial médico guardado en la nube.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  // ── Disparar Alertas Médicas Locales (Patrón Observer) ──────────────────────
  const handleTriggerMedAlert = () => {
    const med = record?.medicamentosControlados?.[0]?.nombre || 'Salbutamol Inhalador';
    const dose = record?.medicamentosControlados?.[0]?.dosis || '100 mcg';
    medicalAlertDispatcher.triggerCriticalMedicationAlert(
      med,
      dose,
      'Administrar con cámara espaciadora. Monitorear frecuencia respiratoria.'
    );
  };

  const handleTriggerAnomalyAlert = () => {
    medicalAlertDispatcher.triggerAnomalyAlert(
      'Taquicardia en reposo',
      'Ritmo cardíaco de 128 bpm detectado por sensor vestible. Se sugiere reposo inmediato.'
    );
  };

  // ── Descargar archivos reales con Patrón Strategy ──────────────────────────
  const handleDownloadStrategy = async (format: 'json' | 'csv') => {
    setDownloading(format);
    setDownloadSuccessMessage(null);
    try {
      const { filename, size } = await downloadMedicalFile(format);
      const sizeKb = (size / 1024).toFixed(1);
      const msg = `✓ Archivo "${filename}" (${sizeKb} KB) descargado exitosamente vía Patrón Strategy.`;
      setDownloadSuccessMessage(msg);
      setTimeout(() => setDownloadSuccessMessage(null), 5000);
    } catch (err: any) {
      Alert.alert('Error de Descarga', err.message || 'No se pudo descargar el archivo.');
    } finally {
      setDownloading(null);
    }
  };

  // ── Simular máquina de estados y degradación gradual ───────────────────────
  const handleGrantPermission = () => {
    gpsStateMachine.startRequest();
    setTimeout(() => {
      gpsStateMachine.grant();
    }, 350);
  };

  const handleDenyPermission = () => {
    gpsStateMachine.startRequest();
    setTimeout(() => {
      gpsStateMachine.deny(false);
    }, 350);
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await deleteToken();
    clearAuth();
  };

  return (
    <View style={styles.screen}>
      {/* ── BANNER FLOTANTE DE ALERTA MÉDICA (Observer en tiempo real) ── */}
      {activeBannerAlert && (
        <View style={styles.floatingAlertBanner}>
          <View style={styles.alertIconBadge}>
            <Text style={{ fontSize: 20 }}>{activeBannerAlert.tipo === 'CRITICAL_MEDICATION' ? '💊' : '🚨'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.floatingAlertTitle}>{activeBannerAlert.titulo}</Text>
            <Text style={styles.floatingAlertMsg}>{activeBannerAlert.mensaje}</Text>
          </View>
          <TouchableOpacity
            style={styles.floatingAlertClose}
            onPress={() => setActiveBannerAlert(null)}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── NOTIFICACIÓN DE DESCARGA EXITOSA ── */}
      {downloadSuccessMessage && (
        <View style={styles.downloadNotificationBanner}>
          <Text style={styles.downloadNotificationText}>{downloadSuccessMessage}</Text>
        </View>
      )}

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ── HEADER PREMIUM ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.logoRow}>
                <View style={styles.logoIcon}>
                  <Text style={{ fontSize: 18 }}>❤️‍🩹</Text>
                </View>
                <Text style={styles.appName}>LifeSync</Text>
              </View>
              <Text style={styles.patientName}>{user?.nombre || 'Paciente Registrado'}</Text>
              <Text style={styles.patientEmail}>{user?.email || 'demo@lifesync.com'}</Text>
            </View>

            <TouchableOpacity style={styles.logoutSmallBtn} onPress={handleLogout}>
              <Text style={styles.logoutSmallText}>Salir</Text>
            </TouchableOpacity>
          </View>

          {/* Indicador de Conexión / Modo Avión */}
          <View style={styles.statusRow}>
            <View style={[styles.badge, isOffline ? styles.badgeOffline : styles.badgeOnline]}>
              <View style={[styles.dot, isOffline ? styles.dotOffline : styles.dotOnline]} />
              <Text style={[styles.badgeText, isOffline ? styles.badgeTextOffline : styles.badgeTextOnline]}>
                {isOffline ? 'Modo Avión (Caché Local Offline)' : 'Conectado a la Nube (TLS/HTTPS)'}
              </Text>
            </View>
            <Text style={styles.encryptionBadge}>🔒 Hardware Encrypted</Text>
          </View>
        </View>

        {/* ── TARJETA PRINCIPAL: EXPEDIENTE CLÍNICO DE EMERGENCIA ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.sectionIcon}>🪪</Text>
              <Text style={styles.cardTitle}>Expediente Médico Vital</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={styles.editBtnText}>✏️ Editar Datos</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#4f46e5" style={{ marginVertical: 30 }} />
          ) : (
            <View style={styles.recordGrid}>
              {/* Badge 3D de Tipo de Sangre */}
              <View style={styles.bloodBanner}>
                <View style={styles.bloodCircle}>
                  <Text style={styles.bloodTypeSymbol}>{record?.tipoSangre || 'O+'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.bloodHeading}>Tipo de Sangre del Paciente</Text>
                  <Text style={styles.bloodSub}>Dato crítico para transfusiones de urgencia</Text>
                </View>
              </View>

              {/* Alergias Severas */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeading}>⚠️ Alergias Medicamentosas / Ambientales</Text>
                <View style={styles.tagsWrapper}>
                  {(record?.alergias || []).length > 0 ? (
                    record?.alergias.map((item, index) => (
                      <View key={index} style={styles.tagDanger}>
                        <Text style={styles.tagDangerText}>⛔ {item}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Sin alergias conocidas registradas</Text>
                  )}
                </View>
              </View>

              {/* Condiciones Crónicas */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeading}>🩺 Diagnósticos y Condiciones Crónicas</Text>
                <View style={styles.tagsWrapper}>
                  {(record?.condicionesCronicas || []).length > 0 ? (
                    record?.condicionesCronicas.map((cond, idx) => (
                      <View key={idx} style={styles.tagCondition}>
                        <Text style={styles.tagConditionText}>• {cond}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Ninguna condición crónica activa</Text>
                  )}
                </View>
              </View>

              {/* Medicamentos Controlados */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeading}>💊 Medicamentos Controlados Prescritos</Text>
                {(record?.medicamentosControlados || []).map((m, i) => (
                  <View key={i} style={styles.medCard}>
                    <View style={styles.medHeaderRow}>
                      <Text style={styles.medName}>{m.nombre}</Text>
                      <View style={styles.medDosePill}>
                        <Text style={styles.medDoseText}>{m.dosis}</Text>
                      </View>
                    </View>
                    <Text style={styles.medFrequency}>🕒 {m.frecuencia}</Text>
                  </View>
                ))}
              </View>

              {/* Contactos de Emergencia */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeading}>📞 Contactos de Emergencia Inmediatos</Text>
                {(record?.contactosEmergencia || []).map((c, i) => (
                  <View key={i} style={styles.contactItem}>
                    <View style={styles.contactAvatar}>
                      <Text style={{ fontSize: 16 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.contactName}>{c.nombre}</Text>
                      <Text style={styles.contactRel}>{c.relacion}</Text>
                    </View>
                    <TouchableOpacity style={styles.phonePill}>
                      <Text style={styles.phoneText}>📞 {c.telefono}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── MÓDULO 2: PATRÓN OBSERVER (ALERTAS MÉDICAS LOCALES) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.sectionIcon}>🔔</Text>
              <View>
                <Text style={styles.cardTitle}>Centro de Alertas Médicas</Text>
                <Text style={styles.patternTag}>Patrón de Diseño Observer</Text>
              </View>
            </View>
          </View>

          <Text style={styles.helperText}>
            Los observadores suscritos reaccionan a eventos de salud en segundo plano, activando notificaciones visuales y auditivas automáticas.
          </Text>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: '#4f46e5' }]}
              onPress={handleTriggerMedAlert}
            >
              <Text style={[styles.btnOutlineText, { color: '#4f46e5' }]}>
                ⏰ Alerta Medicamento
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: '#dc2626' }]}
              onPress={handleTriggerAnomalyAlert}
            >
              <Text style={[styles.btnOutlineText, { color: '#dc2626' }]}>
                🚨 Simular Anomalía
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Alertas Históricas */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.subHeadingText}>Historial de Notificaciones ({alerts.length})</Text>
            {alerts.length === 0 ? (
              <View style={styles.emptyAlertsBox}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>🔕</Text>
                <Text style={styles.emptyAlertsText}>No hay alertas activas en este momento.</Text>
                <Text style={styles.emptyAlertsSub}>Toca uno de los botones superiores para activar el Observer.</Text>
              </View>
            ) : (
              alerts.map((al) => (
                <View
                  key={al.id}
                  style={[
                    styles.alertCardItem,
                    al.nivelPrioridad === 'CRITICA' ? styles.alertCardCrit : styles.alertCardHigh,
                  ]}
                >
                  <View style={styles.alertCardHeader}>
                    <Text style={styles.alertCardTitle}>{al.titulo}</Text>
                    <Text style={styles.alertCardTime}>{al.timestamp}</Text>
                  </View>
                  <Text style={styles.alertCardBody}>{al.mensaje}</Text>
                  <View style={styles.alertPriorityBadge}>
                    <Text style={styles.alertPriorityText}>Prioridad: {al.nivelPrioridad}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── MÓDULO 3: PATRÓN STRATEGY (EXPORTACIÓN Y DESCARGA REAL) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.sectionIcon}>📤</Text>
              <View>
                <Text style={styles.cardTitle}>Exportación de Expediente</Text>
                <Text style={styles.patternTag}>Patrón de Diseño Strategy</Text>
              </View>
            </View>
          </View>

          <Text style={styles.helperText}>
            El servidor procesa el expediente bajo demanda y lo transforma según el receptor mediante estrategias intercambiables en tiempo de ejecución.
          </Text>

          <View style={styles.strategyRow}>
            {/* Estrategia 1: JSON */}
            <View style={styles.strategyBox}>
              <Text style={styles.strategyTitle}>Sistemas Hospitalarios</Text>
              <Text style={styles.strategyFormat}>Formato: JSON Clínico (HL7 Compatible)</Text>
              <TouchableOpacity
                style={[styles.strategyDownloadBtn, { backgroundColor: '#4338ca' }]}
                onPress={() => handleDownloadStrategy('json')}
                disabled={downloading !== null}
              >
                {downloading === 'json' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.strategyDownloadBtnText}>⬇️ Descargar .JSON</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Estrategia 2: CSV */}
            <View style={styles.strategyBox}>
              <Text style={styles.strategyTitle}>Compañías de Seguros</Text>
              <Text style={styles.strategyFormat}>Formato: Tabular CSV Sanitizado</Text>
              <TouchableOpacity
                style={[styles.strategyDownloadBtn, { backgroundColor: '#059669' }]}
                onPress={() => handleDownloadStrategy('csv')}
                disabled={downloading !== null}
              >
                {downloading === 'csv' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.strategyDownloadBtnText}>⬇️ Descargar .CSV</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── MÓDULO 4: SENSORES, MÁQUINA DE ESTADOS Y DEGRADACIÓN GRADUAL ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.sectionIcon}>🛰️</Text>
              <View>
                <Text style={styles.cardTitle}>Sensores y Permisos Nativos</Text>
                <Text style={styles.patternTag}>Máquina de Estados FSM + Graceful Degradation</Text>
              </View>
            </View>
          </View>

          {/* Visualizador de Estados FSM */}
          <View style={styles.fsmVisualizer}>
            <View style={[styles.fsmStep, gpsStatus.state === 'IDLE' && styles.fsmStepActive]}>
              <Text style={styles.fsmStepText}>IDLE</Text>
            </View>
            <Text style={styles.fsmArrow}>→</Text>
            <View style={[styles.fsmStep, gpsStatus.state === 'REQUESTING' && styles.fsmStepActive]}>
              <Text style={styles.fsmStepText}>REQUEST</Text>
            </View>
            <Text style={styles.fsmArrow}>→</Text>
            <View
              style={[
                styles.fsmStep,
                gpsStatus.state === 'GRANTED' && styles.fsmStepSuccess,
                gpsStatus.state === 'DENIED_SOFT' && styles.fsmStepWarning,
              ]}
            >
              <Text style={styles.fsmStepText}>{gpsStatus.state}</Text>
            </View>
          </View>

          {/* Caja explicativa de Graceful Degradation */}
          <View
            style={[
              styles.degradationAlertBox,
              gpsStatus.state === 'GRANTED' ? styles.alertBoxGreen : styles.alertBoxYellow,
            ]}
          >
            <Text style={styles.degradationTitle}>
              {gpsStatus.state === 'GRANTED'
                ? '🟢 Sensor GPS Activo — Transmisión a la Nube'
                : '🛡️ Degradación Gradual Activa (Sin Crash)'}
            </Text>
            <Text style={styles.degradationDesc}>{gpsStatus.statusMessage}</Text>
          </View>

          {/* Controles de Simulación de Permisos */}
          <View style={styles.fsmButtonContainer}>
            <TouchableOpacity
              style={[styles.fsmControlBtn, { backgroundColor: '#10b981' }]}
              onPress={handleGrantPermission}
            >
              <Text style={styles.fsmControlBtnText}>✓ Conceder GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fsmControlBtn, { backgroundColor: '#ef4444' }]}
              onPress={handleDenyPermission}
            >
              <Text style={styles.fsmControlBtnText}>✗ Denegar GPS (Degradar)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── BOTÓN CERRAR SESIÓN ── */}
        <TouchableOpacity style={styles.dangerLogoutBtn} onPress={handleLogout}>
          <Text style={styles.dangerLogoutText}>Cerrar Sesión Segura</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── MODAL ELEGANTE DE EDICIÓN DE HISTORIAL ── */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeading}>Actualizar Expediente Clínico</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={{ fontSize: 18, color: '#6b7280', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Tipo de Sangre:</Text>
              <TextInput
                style={styles.fieldInput}
                value={formBloodType}
                onChangeText={setFormBloodType}
                placeholder="A+, A-, B+, B-, AB+, O+, O-"
              />

              <Text style={styles.fieldLabel}>Alergias (separadas por comas):</Text>
              <TextInput
                style={styles.fieldInput}
                value={formAllergies}
                onChangeText={setFormAllergies}
                placeholder="Penicilina, Sulfas, Mariscos..."
              />

              <Text style={styles.fieldLabel}>Condiciones Crónicas (separadas por comas):</Text>
              <TextInput
                style={styles.fieldInput}
                value={formConditions}
                onChangeText={setFormConditions}
                placeholder="Hipertensión, Asma, Diabetes..."
              />

              <Text style={styles.fieldLabel}>Medicamento Controlado:</Text>
              <TextInput
                style={styles.fieldInput}
                value={formMedName}
                onChangeText={setFormMedName}
                placeholder="Nombre del medicamento"
              />
              <TextInput
                style={styles.fieldInput}
                value={formMedDose}
                onChangeText={setFormMedDose}
                placeholder="Dosis (ej. 10 mg / 100 mcg)"
              />
              <TextInput
                style={styles.fieldInput}
                value={formMedFreq}
                onChangeText={setFormMedFreq}
                placeholder="Frecuencia (ej. Cada 12 horas)"
              />

              <Text style={styles.fieldLabel}>Contacto de Emergencia:</Text>
              <TextInput
                style={styles.fieldInput}
                value={formContactName}
                onChangeText={setFormContactName}
                placeholder="Nombre completo"
              />
              <TextInput
                style={styles.fieldInput}
                value={formContactRel}
                onChangeText={setFormContactRel}
                placeholder="Parentesco (Familiar, Médico...)"
              />
              <TextInput
                style={styles.fieldInput}
                value={formContactPhone}
                onChangeText={setFormContactPhone}
                placeholder="Número telefónico"
              />
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.btnModalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnModalSubmit}
                onPress={handleSaveRecord}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnModalSubmitText}>Guardar Cambios</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Alerta flotante
  floatingAlertBanner: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 14 : 44,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#991b1b',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  alertIconBadge: { marginRight: 12 },
  floatingAlertTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  floatingAlertMsg: { color: '#fee2e2', fontSize: 12, marginTop: 2 },
  floatingAlertClose: { padding: 6, marginLeft: 8 },

  // Notificación de descarga
  downloadNotificationBanner: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 14 : 44,
    left: 16,
    right: 16,
    zIndex: 9998,
    backgroundColor: '#065f46',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  downloadNotificationText: { color: '#ecfdf5', fontSize: 12, fontWeight: '700' },

  // Header
  header: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logoIcon: {
    backgroundColor: '#1e293b',
    padding: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  appName: { fontSize: 20, fontWeight: '900', color: '#f8fafc', letterSpacing: 0.5 },
  patientName: { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  patientEmail: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  logoutSmallBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutSmallText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeOnline: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  badgeOffline: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  dotOnline: { backgroundColor: '#10b981' },
  dotOffline: { backgroundColor: '#ef4444' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextOnline: { color: '#34d399' },
  badgeTextOffline: { color: '#f87171' },
  encryptionBadge: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  // Tarjetas principales
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionIcon: { fontSize: 22, marginRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  patternTag: { fontSize: 10, color: '#6366f1', fontWeight: '700', textTransform: 'uppercase' },
  editBtn: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  editBtnText: { color: '#4338ca', fontWeight: '700', fontSize: 12 },

  // Expediente
  recordGrid: { gap: 12 },
  bloodBanner: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bloodCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e11d48',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  bloodTypeSymbol: { color: '#fff', fontSize: 22, fontWeight: '900' },
  bloodHeading: { fontSize: 14, fontWeight: '800', color: '#9f1239' },
  bloodSub: { fontSize: 11, color: '#be123c', marginTop: 1 },

  sectionBox: { marginTop: 4 },
  sectionHeading: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 6, textTransform: 'uppercase' },
  tagsWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagDanger: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  tagDangerText: { color: '#991b1b', fontSize: 12, fontWeight: '700' },
  tagCondition: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tagConditionText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },

  medCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  medHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  medDosePill: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  medDoseText: { fontSize: 11, color: '#4338ca', fontWeight: '800' },
  medFrequency: { fontSize: 11, color: '#64748b', marginTop: 3 },

  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  contactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  contactRel: { fontSize: 11, color: '#64748b' },
  phonePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  phoneText: { fontSize: 11, color: '#065f46', fontWeight: '700' },

  // Módulo Observer
  helperText: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 12 },
  actionButtonsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  btnOutlineText: { fontSize: 12, fontWeight: '800' },
  subHeadingText: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 },
  emptyAlertsBox: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyAlertsText: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  emptyAlertsSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  alertCardItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  alertCardCrit: { backgroundColor: '#fef2f2', borderLeftColor: '#dc2626' },
  alertCardHigh: { backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b' },
  alertCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertCardTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  alertCardTime: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  alertCardBody: { fontSize: 11, color: '#334155', marginTop: 4, lineHeight: 15 },
  alertPriorityBadge: { alignSelf: 'flex-start', marginTop: 6 },
  alertPriorityText: { fontSize: 9, fontWeight: '800', color: '#991b1b', textTransform: 'uppercase' },

  // Módulo Strategy
  strategyRow: { gap: 10 },
  strategyBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  strategyTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  strategyFormat: { fontSize: 11, color: '#64748b', marginTop: 1, marginBottom: 8 },
  strategyDownloadBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  strategyDownloadBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Módulo FSM
  fsmVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  fsmStep: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  fsmStepActive: { backgroundColor: '#4f46e5' },
  fsmStepSuccess: { backgroundColor: '#10b981' },
  fsmStepWarning: { backgroundColor: '#f59e0b' },
  fsmStepText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  fsmArrow: { marginHorizontal: 8, color: '#94a3b8', fontWeight: '800' },
  degradationAlertBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  alertBoxGreen: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  alertBoxYellow: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  degradationTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  degradationDesc: { fontSize: 11, color: '#334155', lineHeight: 16 },
  fsmButtonContainer: { flexDirection: 'row', gap: 10 },
  fsmControlBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  fsmControlBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Logout
  dangerLogoutBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerLogoutText: { color: '#b91c1c', fontSize: 14, fontWeight: '800' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeading: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 10, marginBottom: 3 },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  btnModalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  btnModalCancelText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  btnModalSubmit: {
    backgroundColor: '#4338ca',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnModalSubmitText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
