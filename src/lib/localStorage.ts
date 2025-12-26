import { User, EmergencyContact, MedicineSchedule, VoiceMessage, SOSAlert, DoctorPatientRelationship } from '../types';

class LocalStorageService {
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Users
  getUsers(): User[] {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
  }

  saveUser(user: User): void {
    const users = this.getUsers();
    const existingIndex = users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem('users', JSON.stringify(users));
  }

  getUserByVoiceName(voiceName: string): User | null {
    const users = this.getUsers();
    return users.find(u => u.voice_login_name.toLowerCase() === voiceName.toLowerCase()) || null;
  }

  getUserById(id: string): User | null {
    const users = this.getUsers();
    return users.find(u => u.id === id) || null;
  }

  getDoctors(): User[] {
    return this.getUsers().filter(u => u.role === 'doctor');
  }

  // Current user session
  setCurrentUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  getCurrentUser(): User | null {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  clearCurrentUser(): void {
    localStorage.removeItem('currentUser');
  }

  // Emergency Contacts
  getEmergencyContacts(): EmergencyContact[] {
    const contacts = localStorage.getItem('emergencyContacts');
    return contacts ? JSON.parse(contacts) : [];
  }

  saveEmergencyContact(contact: Omit<EmergencyContact, 'id' | 'created_at'>): EmergencyContact {
    const contacts = this.getEmergencyContacts();
    const newContact: EmergencyContact = {
      ...contact,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };
    contacts.push(newContact);
    localStorage.setItem('emergencyContacts', JSON.stringify(contacts));
    return newContact;
  }

  getEmergencyContactsByPatientId(patientId: string): EmergencyContact[] {
    return this.getEmergencyContacts().filter(c => c.patient_id === patientId);
  }

  // Medicine Schedules
  getMedicineSchedules(): MedicineSchedule[] {
    const schedules = localStorage.getItem('medicineSchedules');
    return schedules ? JSON.parse(schedules) : [];
  }

  saveMedicineSchedule(schedule: Omit<MedicineSchedule, 'id' | 'created_at'>): MedicineSchedule {
    const schedules = this.getMedicineSchedules();
    const newSchedule: MedicineSchedule = {
      ...schedule,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };
    schedules.push(newSchedule);
    localStorage.setItem('medicineSchedules', JSON.stringify(schedules));
    return newSchedule;
  }

  getMedicineSchedulesByPatientId(patientId: string): MedicineSchedule[] {
    return this.getMedicineSchedules().filter(s => s.patient_id === patientId && s.active);
  }

  // Voice Messages
  getVoiceMessages(): VoiceMessage[] {
    const messages = localStorage.getItem('voiceMessages');
    return messages ? JSON.parse(messages) : [];
  }

  saveVoiceMessage(message: Omit<VoiceMessage, 'id' | 'created_at'>): VoiceMessage {
    const messages = this.getVoiceMessages();
    const newMessage: VoiceMessage = {
      ...message,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };
    messages.push(newMessage);
    localStorage.setItem('voiceMessages', JSON.stringify(messages));
    return newMessage;
  }

  getVoiceMessagesByDoctorId(doctorId: string): VoiceMessage[] {
    return this.getVoiceMessages().filter(m => m.doctor_id === doctorId);
  }

  // SOS Alerts
  getSOSAlerts(): SOSAlert[] {
    const alerts = localStorage.getItem('sosAlerts');
    return alerts ? JSON.parse(alerts) : [];
  }

  saveSOSAlert(alert: Omit<SOSAlert, 'id' | 'created_at'>): SOSAlert {
    const alerts = this.getSOSAlerts();
    const newAlert: SOSAlert = {
      ...alert,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };
    alerts.push(newAlert);
    localStorage.setItem('sosAlerts', JSON.stringify(alerts));
    return newAlert;
  }

  updateSOSAlert(id: string, updates: Partial<SOSAlert>): void {
    const alerts = this.getSOSAlerts();
    const index = alerts.findIndex(a => a.id === id);
    if (index >= 0) {
      alerts[index] = { ...alerts[index], ...updates };
      localStorage.setItem('sosAlerts', JSON.stringify(alerts));
    }
  }

  getSOSAlertsByPatientId(patientId: string): SOSAlert[] {
    return this.getSOSAlerts().filter(a => a.patient_id === patientId);
  }

  // Doctor-Patient Relationships
  getDoctorPatientRelationships(): DoctorPatientRelationship[] {
    const relationships = localStorage.getItem('doctorPatientRelationships');
    return relationships ? JSON.parse(relationships) : [];
  }

  saveDoctorPatientRelationship(relationship: Omit<DoctorPatientRelationship, 'id' | 'created_at'>): DoctorPatientRelationship {
    const relationships = this.getDoctorPatientRelationships();
    const newRelationship: DoctorPatientRelationship = {
      ...relationship,
      id: this.generateId(),
      created_at: new Date().toISOString()
    };
    relationships.push(newRelationship);
    localStorage.setItem('doctorPatientRelationships', JSON.stringify(relationships));
    return newRelationship;
  }

  getDoctorIdByPatientId(patientId: string): string | null {
    const relationships = this.getDoctorPatientRelationships();
    const relationship = relationships.find(r => r.patient_id === patientId);
    return relationship ? relationship.doctor_id : null;
  }

  getPatientsByDoctorId(doctorId: string): string[] {
    const relationships = this.getDoctorPatientRelationships();
    return relationships.filter(r => r.doctor_id === doctorId).map(r => r.patient_id);
  }
}

export const localStorageService = new LocalStorageService();