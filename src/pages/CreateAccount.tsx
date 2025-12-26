import { useState, FormEvent } from 'react';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { localStorageService } from '../lib/localStorage';
import { voiceService } from '../services/voiceService';
import { useNavigate } from '../hooks/useNavigate';

interface EmergencyContactForm {
  contact_name: string;
  phone_number: string;
  relationship: string;
}

export default function CreateAccount() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [formData, setFormData] = useState({
    full_name: '',
    voice_login_name: '',
    age: '',
    gender: '',
    hospital_contact: '',
    specialization: '',
  });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactForm[]>([
    { contact_name: '', phone_number: '', relationship: '' },
  ]);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);

  const loadDoctors = () => {
    const doctorsList = localStorageService.getDoctors();
    setDoctors(doctorsList);
  };

  const handleAddEmergencyContact = () => {
    setEmergencyContacts([
      ...emergencyContacts,
      { contact_name: '', phone_number: '', relationship: '' },
    ]);
  };

  const handleRemoveEmergencyContact = (index: number) => {
    setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
  };

  const handleUpdateEmergencyContact = (
    index: number,
    field: keyof EmergencyContactForm,
    value: string
  ) => {
    const updated = [...emergencyContacts];
    updated[index][field] = value;
    setEmergencyContacts(updated);
  };

  const handleDoctorToggle = (doctorId: string) => {
    setSelectedDoctorIds((prev) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString();

      const newUser = {
        id: userId,
        role,
        full_name: formData.full_name,
        voice_login_name: formData.voice_login_name.toLowerCase(),
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender,
        hospital_contact: formData.hospital_contact,
        specialization: formData.specialization,
        created_at: now,
        updated_at: now,
      };

      localStorageService.saveUser(newUser);

      if (role === 'patient') {
        if (selectedDoctorIds.length > 0) {
          selectedDoctorIds.forEach((doctorId) => {
          localStorageService.saveDoctorPatientRelationship({
              doctor_id: doctorId,
            patient_id: userId,
          });
          });
        } 

        const validContacts = emergencyContacts.filter(
          (c) => c.contact_name && c.phone_number && c.relationship
        );
        validContacts.forEach(contact => {
          localStorageService.saveEmergencyContact({
            patient_id: userId,
            ...contact,
          });
        });
      }

      await voiceService.speak(
        `Account successfully created for ${formData.full_name}. Please proceed to login.`
      );

      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      console.error('Account creation error:', error);
      alert('An error occurred during account creation');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 mb-6 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg"
          >
            <ArrowLeft size={20} />
            Back to Login
          </button>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-8 flex items-center gap-4">
              <UserPlus size={40} />
              Create New Account
            </h1>

            <div className="space-y-6">
              <div>
                <label className="block text-xl font-semibold text-slate-700 mb-2">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    className={`p-6 rounded-xl text-xl font-semibold transition-all ${
                      role === 'patient'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('doctor')}
                    className={`p-6 rounded-xl text-xl font-semibold transition-all ${
                      role === 'doctor'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Doctor
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  if (role === 'patient') {
                    loadDoctors();
                  }
                  setStep(2);
                }}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-xl"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-2 mb-6 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-8">
            {role === 'patient' ? 'Patient' : 'Doctor'} Information
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-slate-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-lg font-semibold text-slate-700 mb-2">
                Unique Voice Login Name * (lowercase, no spaces)
              </label>
              <input
                type="text"
                required
                value={formData.voice_login_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    voice_login_name: e.target.value.toLowerCase().replace(/\s/g, ''),
                  })
                }
                className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-slate-700 mb-2">Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-lg font-semibold text-slate-700 mb-2">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {role === 'doctor' && (
              <div>
                <label className="block text-lg font-semibold text-slate-700 mb-2">
                  Specialization
                </label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Cardiologist"
                />
              </div>
            )}

            {role === 'patient' && (
              <>
                <div>
                  <label className="block text-lg font-semibold text-slate-700 mb-2">
                    Hospital Contact Number
                  </label>
                  <input
                    type="tel"
                    value={formData.hospital_contact}
                    onChange={(e) =>
                      setFormData({ ...formData, hospital_contact: e.target.value })
                    }
                    className="w-full px-4 py-3 text-lg border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-lg font-semibold text-slate-700 mb-2">
                    Doctor Email
                  </label>
                  <div className="border-2 border-slate-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-white">
                    {doctors.length === 0 ? (
                      <p className="text-slate-500">No doctors available</p>
                    ) : (
                      doctors.map((doctor) => (
                        <div key={doctor.id} className="flex items-center gap-3 mb-2 last:mb-0">
                          <input
                            type="checkbox"
                            id={`doctor-${doctor.id}`}
                            checked={selectedDoctorIds.includes(doctor.id)}
                            onChange={() => handleDoctorToggle(doctor.id)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`doctor-${doctor.id}`} className="text-slate-700 cursor-pointer select-none">
                            Dr. {doctor.full_name} ({doctor.voice_login_name})
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Select multiple doctors from the list</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-lg font-semibold text-slate-700">
                      Emergency Contacts
                    </label>
                    <button
                      type="button"
                      onClick={handleAddEmergencyContact}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      Add Contact
                    </button>
                  </div>
                  <div className="space-y-4">
                    {emergencyContacts.map((contact, index) => (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            placeholder="Name"
                            value={contact.contact_name}
                            onChange={(e) =>
                              handleUpdateEmergencyContact(index, 'contact_name', e.target.value)
                            }
                            className="px-3 py-2 border-2 border-slate-300 rounded-lg"
                          />
                          <input
                            type="tel"
                            placeholder="Phone Number"
                            value={contact.phone_number}
                            onChange={(e) =>
                              handleUpdateEmergencyContact(index, 'phone_number', e.target.value)
                            }
                            className="px-3 py-2 border-2 border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            placeholder="Relationship"
                            value={contact.relationship}
                            onChange={(e) =>
                              handleUpdateEmergencyContact(index, 'relationship', e.target.value)
                            }
                            className="px-3 py-2 border-2 border-slate-300 rounded-lg"
                          />
                        </div>
                        {emergencyContacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEmergencyContact(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white text-xl font-bold rounded-xl transition-all"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
