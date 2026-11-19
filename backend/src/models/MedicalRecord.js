'use strict';

const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 100 },
    relacion: { type: String, required: true, trim: true, maxlength: 50 },
    telefono: { type: String, required: true, trim: true, maxlength: 20 },
  },
  { _id: false }
);

const controlledMedicationSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 100 },
    dosis: { type: String, required: true, trim: true, maxlength: 50 },
    frecuencia: { type: String, required: true, trim: true, maxlength: 50 },
    instrucciones: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false }
);

const medicalRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Cada usuario tiene exactamente un historial clínico
      index: true,
    },
    tipoSangre: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Desconocido'],
      default: 'Desconocido',
    },
    alergias: {
      type: [String],
      default: [],
    },
    condicionesCronicas: {
      type: [String],
      default: [],
    },
    medicamentosControlados: {
      type: [controlledMedicationSchema],
      default: [],
    },
    contactosEmergencia: {
      type: [emergencyContactSchema],
      default: [],
    },
    notasMedicas: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    ultimaUbicacionIncidente: {
      latitud: { type: Number, default: null },
      longitud: { type: Number, default: null },
      timestamp: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
