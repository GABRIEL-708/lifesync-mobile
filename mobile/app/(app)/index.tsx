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
import { deleteToken, getToken } from '../../src/utils/secureStorage';
import {
  getMedicalRecord,
  updateMedicalRecord,
  MedicalRecordData,
  getExportUrl,
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
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Estados del Patrón Observer (Alertas Médicas)
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);

  // Estados de la Máquina de Estados (GPS / Sensores)
  const [gpsStatus, setGpsStatus] = useState<SensorStatus>(gpsStateMachine.getStatus());

  // Formulario de edición
  const [formBloodType, setFormBloodType] = useState('O+');
  const [formAllergies, setFormAllergies] = useState('Penicilina, Mariscos');
  const [formConditions, setFormConditions] = useState('Asma leve');
  const [formMedName, setFormMedName] = useState('Salbutamol');
  const [formMedDose, setFormMedDose] = useState('100mcg');
  const [formMedFreq, setFormMedFreq] = useState('Cada 8 horas');
  const [formContactName, setFormContactName] = useState('Dra. María González');
  const [formContactPhone, setFormContactPhone] = useState('999-123-4567');
  const [formContactRel, setFormContactRel] = useState('Médico particular');

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
            nombre: formContactName.trim() || 'Contacto',
            relacion: formContactRel.trim() || 'Familiar',
            telefono: formContactPhone.trim() || '000-000-0000',
          },
        ],
        notasMedicas: 'Historial protegido con esquemas Zod en LifeSync.',
      };

      const res = await updateMedicalRecord(updated);
      setRecord(res);
      setEditModalVisible(false);
      Alert.alert('Éxito', 'Historial médico actualizado en la nube.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  // ── Disparar Alerta Médica Local (Demostración Patrón Observer) ─────────────
  const handleTriggerSimulatedAlert = () => {
    medicalAlertDispatcher.triggerCriticalMedicationAlert(
      formMedName || 'Salbutamol',
      formMedDose || '100mcg',
      'Tomar inhalación con aerocámara inmediatamente.'
    );
  };

  // ── Simular máquina de estados y degradación gradual ───────────────────────
  const handleGrantPermission = () => {
    gpsStateMachine.startRequest();
    setTimeout(() => {
      gpsStateMachine.grant();
    }, 400);
  };

  const handleDenyPermission = () => {
    gpsStateMachine.startRequest();
    setTimeout(() => {
      gpsStateMachine.deny(false);
    }, 400);
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await deleteToken();
    clearAuth();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>LifeSync Mobile</Text>
          <Text style={styles.userName}>Paciente: {user?.nombre || 'Usuario'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'demo@lifesync.com'}</Text>
        </View>

        {/* Indicador de conexión / Modo Avión */}
        <View style={[styles.badge, isOffline ? styles.badgeOffline : styles.badgeOnline]}>
          <Text style={styles.badgeText}>
            {isOffline ? '✈️ Modo Avión (Offline)' : '🟢 En Línea (TLS/HTTPS)'}
          </Text>
        </View>
      </View>

      {/* ── HISTORIAL CLÍNICO DE EMERGENCIA (Core de Negocio) ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📋 Historial Clínico de Emergencia</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditModalVisible(true)}
          >
            <Text style={styles.editBtnText}>✏️ Editar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.recordBody}>
            {/* Tipo de sangre */}
            <View style={styles.bloodTypeBox}>
              <Text style={styles.bloodTypeLabel}>Tipo de Sangre</Text>
              <Text style={styles.bloodTypeValue}>{record?.tipoSangre || 'O+'}</Text>
            </View>

            {/* Alergias */}
            <View style={styles.infoRow}>
              <Text style={styles.label}>⚠️ Alergias:</Text>
              <View style={styles.tagsContainer}>
                {(record?.alergias || []).length > 0 ? (
                  record?.alergias.map((a, i) => (
                    <View key={i} style={styles.tagAlert}>
                      <Text style={styles.tagAlertText}>{a}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.value}>Ninguna reportada</Text>
                )}
              </View>
            </View>

            {/* Condiciones Crónicas */}
            <View style={styles.infoRow}>
              <Text style={styles.label}>🩺 Condiciones Crónicas:</Text>
              <Text style={styles.value}>
                {(record?.condicionesCronicas || []).join(', ') || 'Ninguna'}
              </Text>
            </View>

            {/* Medicamentos Controlados */}
            <View style={styles.infoRow}>
              <Text style={styles.label}>💊 Medicamentos Controlados:</Text>
              {(record?.medicamentosControlados || []).map((m, i) => (
                <View key={i} style={styles.medCard}>
                  <Text style={styles.medName}>{m.nombre}</Text>
                  <Text style={styles.medDetails}>Dosis: {m.dosis} | Frecuencia: {m.frecuencia}</Text>
                </View>
              ))}
            </View>

            {/* Contactos de Emergencia */}
            <View style={styles.infoRow}>
              <Text style={styles.label}>📞 Contactos de Emergencia:</Text>
              {(record?.contactosEmergencia || []).map((c, i) => (
                <View key={i} style={styles.contactCard}>
                  <Text style={styles.contactName}>{c.nombre} ({c.relacion})</Text>
                  <Text style={styles.contactPhone}>📱 {c.telefono}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── PATRÓN OBSERVER: Alertas Médicas Locales ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🔔 Módulo de Alertas (Patrón Observer)</Text>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={handleTriggerSimulatedAlert}
          >
            <Text style={styles.actionBtnTextSec}>+ Simular Alerta</Text>
          </TouchableOpacity>
        </View>

        {alerts.length === 0 ? (
          <Text style={styles.emptyNote}>
            No hay alertas activas. Presiona "+ Simular Alerta" para comprobar el patrón Observer en tiempo real.
          </Text>
        ) : (
          alerts.map((alt) => (
            <View key={alt.id} style={styles.alertCard}>
              <Text style={styles.alertTitle}>{alt.titulo}</Text>
              <Text style={styles.alertMsg}>{alt.mensaje}</Text>
              <Text style={styles.alertTime}>Hora: {alt.timestamp} | Prioridad: {alt.nivelPrioridad}</Text>
            </View>
          ))
        )}
      </View>

      {/* ── MÁQUINA DE ESTADOS Y DEGRADACIÓN GRADUAL (GPS/Sensores) ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛰️ Sensores y Degradación Gradual (FSM)</Text>
        <Text style={styles.sensorSubtitle}>
          Estado actual: <Text style={{ fontWeight: '800', color: '#4f46e5' }}>{gpsStatus.state}</Text>
        </Text>

        <View style={[
          styles.degradationBox,
          gpsStatus.state === 'GRANTED' ? styles.boxSuccess : styles.boxWarning
        ]}>
          <Text style={styles.degradationText}>{gpsStatus.statusMessage}</Text>
        </View>

        <View style={styles.fsmButtonGroup}>
          <TouchableOpacity
            style={[styles.fsmButton, { backgroundColor: '#10b981' }]}
            onPress={handleGrantPermission}
          >
            <Text style={styles.fsmBtnText}>✓ Conceder GPS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fsmButton, { backgroundColor: '#ef4444' }]}
            onPress={handleDenyPermission}
          >
            <Text style={styles.fsmBtnText}>✗ Denegar GPS (Degradación)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── PATRÓN STRATEGY: Exportación de Historial ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📤 Exportación (Patrón Strategy en Nube)</Text>
        <Text style={styles.exportDesc}>
          El servidor procesa bajo demanda usando Strategy: JSON para sistemas hospitalarios o CSV para aseguradoras.
        </Text>

        <View style={styles.exportButtonGroup}>
          <TouchableOpacity
            style={styles.strategyBtn}
            onPress={async () => {
              const url = getExportUrl('json');
              const token = await getToken();
              Alert.alert(
                'Strategy: JSON Hospitalario',
                `Endpoint: ${url}\n\nCabecera inyectada:\nAuthorization: Bearer ${token ? token.slice(0, 15) + '...' : 'none'}`
              );
            }}
          >
            <Text style={styles.strategyBtnText}>📄 Exportar JSON (Médico)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.strategyBtn}
            onPress={async () => {
              const url = getExportUrl('csv');
              const token = await getToken();
              Alert.alert(
                'Strategy: CSV Aseguradoras',
                `Endpoint: ${url}\n\nCabecera inyectada:\nAuthorization: Bearer ${token ? token.slice(0, 15) + '...' : 'none'}`
              );
            }}
          >
            <Text style={styles.strategyBtnText}>📊 Exportar CSV (Seguros)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── BOTÓN CERRAR SESIÓN ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Cerrar Sesión Segura</Text>
      </TouchableOpacity>

      {/* ── MODAL DE EDICIÓN DE HISTORIAL CLÍNICO ── */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Historial Clínico</Text>

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.modalLabel}>Tipo de sangre:</Text>
              <TextInput
                style={styles.modalInput}
                value={formBloodType}
                onChangeText={setFormBloodType}
                placeholder="A+, A-, B+, O+, etc."
              />

              <Text style={styles.modalLabel}>Alergias (separadas por coma):</Text>
              <TextInput
                style={styles.modalInput}
                value={formAllergies}
                onChangeText={setFormAllergies}
                placeholder="Penicilina, Mariscos"
              />

              <Text style={styles.modalLabel}>Condiciones Crónicas:</Text>
              <TextInput
                style={styles.modalInput}
                value={formConditions}
                onChangeText={setFormConditions}
                placeholder="Asma, Diabetes"
              />

              <Text style={styles.modalLabel}>Medicamento Controlado:</Text>
              <TextInput
                style={styles.modalInput}
                value={formMedName}
                onChangeText={setFormMedName}
                placeholder="Nombre del medicamento"
              />
              <TextInput
                style={styles.modalInput}
                value={formMedDose}
                onChangeText={setFormMedDose}
                placeholder="Dosis (ej. 100mcg)"
              />
              <TextInput
                style={styles.modalInput}
                value={formMedFreq}
                onChangeText={setFormMedFreq}
                placeholder="Frecuencia (ej. Cada 8 hrs)"
              />

              <Text style={styles.modalLabel}>Contacto de Emergencia:</Text>
              <TextInput
                style={styles.modalInput}
                value={formContactName}
                onChangeText={setFormContactName}
                placeholder="Nombre"
              />
              <TextInput
                style={styles.modalInput}
                value={formContactPhone}
                onChangeText={setFormContactPhone}
                placeholder="Teléfono"
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveRecord}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 18, paddingBottom: 40 },
  header: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  appName: { fontSize: 24, fontWeight: '800', color: '#4f46e5' },
  userName: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginTop: 4 },
  userEmail: { fontSize: 13, color: '#6b7280' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
  },
  badgeOnline: { backgroundColor: '#d1fae5' },
  badgeOffline: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  editBtn: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: { color: '#4f46e5', fontWeight: '700', fontSize: 13 },
  recordBody: { gap: 10 },
  bloodTypeBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  bloodTypeLabel: { fontSize: 12, color: '#991b1b', fontWeight: '600' },
  bloodTypeValue: { fontSize: 26, fontWeight: '900', color: '#b91c1c' },
  infoRow: { marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#4b5563', marginBottom: 4 },
  value: { fontSize: 14, color: '#1f2937' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagAlert: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  tagAlertText: { fontSize: 12, color: '#92400e', fontWeight: '700' },
  medCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  medName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  medDetails: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  contactCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  contactName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  contactPhone: { fontSize: 12, color: '#4f46e5', fontWeight: '600', marginTop: 2 },
  actionBtnSecondary: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionBtnTextSec: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyNote: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  alertCard: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#991b1b' },
  alertMsg: { fontSize: 12, color: '#7f1d1d', marginTop: 2 },
  alertTime: { fontSize: 10, color: '#b91c1c', marginTop: 4, fontWeight: '600' },
  sensorSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  degradationBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  boxSuccess: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  boxWarning: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  degradationText: { fontSize: 12, color: '#374151', lineHeight: 16 },
  fsmButtonGroup: { flexDirection: 'row', gap: 10 },
  fsmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  fsmBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  exportDesc: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  exportButtonGroup: { flexDirection: 'row', gap: 10 },
  strategyBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  strategyBtnText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  logoutBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 14 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#4b5563', marginTop: 8 },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: { padding: 10 },
  modalCancelText: { color: '#6b7280', fontWeight: '600' },
  modalSaveBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveText: { color: '#fff', fontWeight: '700' },
});
