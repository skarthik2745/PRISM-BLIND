import { useState, useEffect } from 'react';
import { LogOut, User, MessageSquare, AlertTriangle, Pill, Volume2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { localStorageService } from '../lib/localStorage';
import { voiceService } from '../services/voiceService';
import { User as UserType, VoiceMessage, SOSAlert, MedicineSchedule } from '../types';

interface PatientData {
  patient: UserType;
  voiceMessages: VoiceMessage[];
  sosAlerts: SOSAlert[];
  medicines: MedicineSchedule[];
}

export default function DoctorDashboard() {
  const { user, signOut } = useAuth();
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    voiceService.speak('Welcome to doctor dashboard. Viewing all your patients.');
    loadPatients();
  }, []);

  const loadPatients = () => {
    setLoading(true);

    const patientIds = localStorageService.getPatientsByDoctorId(user?.id || '');

    if (patientIds.length === 0) {
      setLoading(false);
      return;
    }

    const patientsData: PatientData[] = [];

    for (const patientId of patientIds) {
      const patient = localStorageService.getUserById(patientId);
      if (!patient) continue;

      const voiceMessages = localStorageService.getVoiceMessagesByDoctorId(user?.id || '')
        .filter(msg => msg.patient_id === patientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      const sosAlerts = localStorageService.getSOSAlertsByPatientId(patientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      const medicines = localStorageService.getMedicineSchedulesByPatientId(patientId);

      patientsData.push({
        patient,
        voiceMessages,
        sosAlerts,
        medicines,
      });
    }

    setPatients(patientsData);
    setLoading(false);
  };

  const handlePlayVoiceMessage = async (message: VoiceMessage) => {
    if (message.transcription) {
      await voiceService.speak(`Patient says: ${message.transcription}`);

      // Update message as listened in localStorage
      const messages = localStorageService.getVoiceMessages();
      const updatedMessages = messages.map(m => 
        m.id === message.id ? { ...m, listened: true } : m
      );
      localStorage.setItem('voiceMessages', JSON.stringify(updatedMessages));

      loadPatients();
    }
  };

  const handleLogout = async () => {
    await voiceService.speak('Logging out. Goodbye.');
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-3xl text-slate-700">Loading patients...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Dr. {user?.full_name}'s Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-lg font-semibold active:scale-95 transition-all"
          >
            <LogOut size={24} />
            <span>Logout</span>
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="text-center text-2xl text-slate-600 mt-12">
            No patients assigned yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patients.map((patientData) => (
              <div
                key={patientData.patient.id}
                className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all cursor-pointer"
                onClick={() => setSelectedPatient(patientData)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                    <User size={32} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {patientData.patient.full_name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {patientData.patient.age} years, {patientData.patient.gender}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600">
                    <MessageSquare size={20} />
                    <span className="font-semibold">
                      {patientData.voiceMessages.filter((m) => !m.listened).length} New Messages
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle size={20} />
                    <span className="font-semibold">
                      {patientData.sosAlerts.filter((a) => a.status === 'active').length} Active Alerts
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-green-600">
                    <Pill size={20} />
                    <span className="font-semibold">
                      {patientData.medicines.length} Active Medicines
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedPatient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-900">
                  {selectedPatient.patient.full_name}
                </h2>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <MessageSquare size={24} />
                    Voice Messages
                  </h3>
                  {selectedPatient.voiceMessages.length === 0 ? (
                    <p className="text-slate-600">No voice messages yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.voiceMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-4 rounded-lg ${
                            message.listened ? 'bg-slate-100' : 'bg-blue-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm text-slate-600">
                              {new Date(message.created_at).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => handlePlayVoiceMessage(message)}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                            >
                              <Volume2 size={16} />
                              Play
                            </button>
                          </div>
                          <p className="text-slate-800">{message.transcription}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <AlertTriangle size={24} />
                    SOS Alerts
                  </h3>
                  {selectedPatient.sosAlerts.length === 0 ? (
                    <p className="text-slate-600">No SOS alerts.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.sosAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-lg ${
                            alert.status === 'active'
                              ? 'bg-red-50 border-2 border-red-500'
                              : 'bg-slate-100'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-semibold text-slate-900">
                                {alert.alert_type === 'double' ? 'Double Press (Hospital)' : 'Single Press'}
                              </span>
                              <p className="text-sm text-slate-600">
                                {new Date(alert.created_at).toLocaleString()}
                              </p>
                              {alert.latitude && alert.longitude && (
                                <p className="text-sm text-slate-600 mt-1">
                                  Location: {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                alert.status === 'active'
                                  ? 'bg-red-500 text-white'
                                  : alert.status === 'cancelled'
                                  ? 'bg-yellow-500 text-white'
                                  : 'bg-green-500 text-white'
                              }`}
                            >
                              {alert.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Pill size={24} />
                    Medicine Schedule
                  </h3>
                  {selectedPatient.medicines.length === 0 ? (
                    <p className="text-slate-600">No medicines scheduled.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.medicines.map((medicine) => (
                        <div key={medicine.id} className="p-4 bg-green-50 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-semibold text-slate-900 text-lg">
                                {medicine.medicine_name}
                              </span>
                              <p className="text-slate-700">{medicine.dosage}</p>
                              <p className="text-sm text-slate-600">
                                Time: {medicine.scheduled_time.substring(0, 5)} ({medicine.frequency})
                              </p>
                              {medicine.instructions && (
                                <p className="text-sm text-slate-600 mt-1">
                                  {medicine.instructions}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
