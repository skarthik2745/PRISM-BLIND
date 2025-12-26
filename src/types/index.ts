export interface User {
  id: string;
  role: 'patient' | 'doctor';
  full_name: string;
  voice_login_name: string;
  age?: number;
  gender?: string;
  hospital_contact?: string;
  specialization?: string;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContact {
  id: string;
  patient_id: string;
  contact_name: string;
  phone_number: string;
  relationship: string;
  created_at: string;
}

export interface MedicineSchedule {
  id: string;
  patient_id: string;
  medicine_name: string;
  dosage: string;
  scheduled_time: string;
  frequency: string;
  instructions?: string;
  active: boolean;
  created_at: string;
}

export interface VoiceMessage {
  id: string;
  patient_id: string;
  doctor_id: string;
  audio_url?: string;
  transcription?: string;
  message_date: string;
  listened: boolean;
  created_at: string;
}

export interface SOSAlert {
  id: string;
  patient_id: string;
  alert_type: 'single' | 'double';
  latitude?: number;
  longitude?: number;
  status: 'active' | 'cancelled' | 'resolved';
  created_at: string;
  cancelled_at?: string;
  resolved_at?: string;
}

export interface DoctorPatientRelationship {
  id: string;
  doctor_id: string;
  patient_id: string;
  created_at: string;
}
