import { useState, useEffect, useRef } from 'react';
import { MessageSquare, AlertCircle, Pill, Camera, LogOut, XCircle, Users, Clock, Save, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { voiceService } from '../services/voiceService';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { useAuth } from '../contexts/AuthContext';
import { localStorageService } from '../lib/localStorage';
import { MedicineSchedule, SOSAlert, EmergencyContact } from '../types';

export default function PatientDashboard() {
  const { user, signOut } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const sosTimeoutRef = useRef<any>(null);
  const detectionLoopRef = useRef<boolean>(true);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSosPressRef = useRef<number>(0);
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'health_card' | 'contacts' | 'medicine'>('health_card');
  const [healthCard, setHealthCard] = useState({
    fullName: '',
    age: '',
    gender: '',
    bloodGroup: '',
    height: '',
    weight: '',
    knownDiseases: '',
    allergies: '',
    currentSymptoms: '',
    currentMedications: '',
    pastMedicalHistory: '',
    diagnosisSummary: '',
    specialInstructions: ''
  });
  const [isEditingHealthCard, setIsEditingHealthCard] = useState(true);
  const [contactForm, setContactForm] = useState({
    contact_name: '',
    phone_number: '',
    relationship: ''
  });
  const [medicineForm, setMedicineForm] = useState({
    medicine_name: '',
    dosage: '',
    frequency: 'once',
    times: ['09:00'],
    timing: 'after_food'
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [medicines, setMedicines] = useState<MedicineSchedule[]>([]);
  const [isNavVisible, setIsNavVisible] = useState(false);

  useEffect(() => {
    const welcomeMessage = `Welcome to your patient dashboard. Top left button for voice health message. Top right button for S O S emergency. Bottom left button for medicine assistant. Bottom right button for object detection.`;
    voiceService.speak(welcomeMessage);
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadData();
      const savedCard = localStorage.getItem(`healthCard_${user.id}`);
      if (savedCard) {
        setHealthCard(JSON.parse(savedCard));
        setIsEditingHealthCard(false);
      } else {
        setHealthCard(prev => ({
          ...prev,
          fullName: user.full_name || '',
          age: user.age?.toString() || '',
          gender: user.gender || ''
        }));
        setIsEditingHealthCard(true);
      }
    }
  }, [user?.id]);

  const loadData = () => {
    if (user?.id) {
      setContacts(localStorageService.getEmergencyContactsByPatientId(user.id));
      setMedicines(localStorageService.getMedicineSchedulesByPatientId(user.id));
    }
  };

  const handleVoiceMessage = async () => {
    if (!isRecording) {
      setIsRecording(true);
      await voiceService.speak('Voice recording started. Please describe how you feel today.');

      try {
        const transcript = await voiceService.startListening();

        const doctorId = localStorageService.getDoctorIdByPatientId(user?.id || '');

        if (doctorId) {
          localStorageService.saveVoiceMessage({
            patient_id: user?.id || '',
            doctor_id: doctorId,
            transcription: transcript,
            message_date: new Date().toISOString().split('T')[0],
            listened: false,
          });

          await voiceService.speak('Voice recorded successfully and sent to your doctor.');
        } else {
          await voiceService.speak('No doctor assigned. Please contact support.');
        }
      } catch (error) {
        console.error('Voice message error:', error);
        await voiceService.speak('Recording failed. Please try again.');
      } finally {
        setIsRecording(false);
      }
    }
  };

  const handleSOS = async () => {
    const now = Date.now();
    const timeDiff = now - lastSosPressRef.current;

    if (timeDiff < 1000) {
      if (sosTimeoutRef.current) {
        clearTimeout(sosTimeoutRef.current);
        sosTimeoutRef.current = null;
      }
      lastSosPressRef.current = 0;
      await handleDoubleSOS();
    } else {
      lastSosPressRef.current = now;
      sosTimeoutRef.current = setTimeout(async () => {
        await handleSingleSOS();
        lastSosPressRef.current = 0;
        sosTimeoutRef.current = null;
      }, 1000);
    }
  };

  const handleSingleSOS = async () => {
    const contacts = localStorageService.getEmergencyContactsByPatientId(user?.id || '');
    let voiceMessage = 'Emergency alert sent to your contacts.';
    if (contacts.length > 0) {
      const contactNames = contacts.map(c => c.contact_name).join(', and ');
      voiceMessage = `Emergency alert sent to your contacts: ${contactNames}.`;
    }
    voiceMessage += ' Sharing your current location.';
    await voiceService.speak(voiceMessage);

    const position = await getCurrentPosition();

    const alert = localStorageService.saveSOSAlert({
      patient_id: user?.id || '',
      alert_type: 'single',
      latitude: position?.latitude,
      longitude: position?.longitude,
      status: 'active',
    });

    setActiveAlert(alert);
    console.log('SOS Alert sent to contacts:', contacts);
  };

  const handleDoubleSOS = async () => {
    const contacts = localStorageService.getEmergencyContactsByPatientId(user?.id || '');
    let voiceMessage = 'Emergency alert sent to your doctor and contacts.';
    if (contacts.length > 0) {
      const contactNames = contacts.map(c => c.contact_name).join(', and ');
      voiceMessage = `Emergency alert sent to your doctor and contacts: ${contactNames}.`;
    }
    voiceMessage += ' Sharing your current location.';
    await voiceService.speak(voiceMessage);

    const position = await getCurrentPosition();

    const alert = localStorageService.saveSOSAlert({
      patient_id: user?.id || '',
      alert_type: 'double',
      latitude: position?.latitude,
      longitude: position?.longitude,
      status: 'active',
    });

    setActiveAlert(alert);
    console.log('SOS Alert sent to hospital and contacts:', contacts);
  };

  const handleCancelSOS = async () => {
    if (activeAlert) {
      localStorageService.updateSOSAlert(activeAlert.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

      setActiveAlert(null);
      await voiceService.speak('Emergency alert cancelled successfully.');
    } else {
      await voiceService.speak('No active emergency alert to cancel.');
    }
  };

  const getCurrentPosition = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          () => {
            resolve(null);
          }
        );
      } else {
        resolve(null);
      }
    });
  };

  const handleMedicineAssistant = async () => {
    await voiceService.speak('Loading your medicine schedule.');

    const medicines = localStorageService.getMedicineSchedulesByPatientId(user?.id || '');

    if (!medicines || medicines.length === 0) {
      await voiceService.speak('No medicines scheduled. Please contact your doctor.');
      return;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

    const sortedMedicines = medicines.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
    const upcomingMedicine = sortedMedicines.find((med: MedicineSchedule) => med.scheduled_time > currentTime);

    if (upcomingMedicine) {
      const scheduledTime = upcomingMedicine.scheduled_time.substring(0, 5);
      const timeRemaining = calculateTimeRemaining(currentTime, upcomingMedicine.scheduled_time);

      const message = `Current time is ${now.getHours()} ${now.getMinutes()} ${now.getHours() >= 12 ? 'PM' : 'AM'}. You need to take ${upcomingMedicine.medicine_name}, ${upcomingMedicine.dosage}, at ${scheduledTime}. You have ${timeRemaining} remaining.`;

      await voiceService.speak(message);
    } else {
      await voiceService.speak('No upcoming medicines for today.');
    }
  };

  const calculateTimeRemaining = (currentTime: string, scheduledTime: string): string => {
    const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
    const [scheduledHours, scheduledMinutes] = scheduledTime.split(':').map(Number);

    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const scheduledTotalMinutes = scheduledHours * 60 + scheduledMinutes;

    const diffMinutes = scheduledTotalMinutes - currentTotalMinutes;

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minutes`;
    }
  };

  const stopObjectDetection = () => {
    detectionLoopRef.current = false;
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsCameraActive(false);
    voiceService.speak('Object detection stopped.');
  };

  const handleObjectDetection = async () => {
    if (isCameraActive) {
      stopObjectDetection();
      return;
    }

    setIsCameraActive(true);
    detectionLoopRef.current = true;
    await voiceService.speak('Object detection started. Please wait while the model loads.');

    try {
      // Ensure TensorFlow.js is ready
      await tf.ready();
      
      // Load the COCO-SSD model. This is a pre-trained general object detector.
      // For your custom model in 'public/object detection', you would use:
      // const model = await tf.loadGraphModel('/object detection/model.json');
      // You would also need to write custom code to process the model's output tensors.
      const model = await cocoSsd.load();
      await voiceService.speak('Model loaded. Starting camera.');

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      videoStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }

      await voiceService.speak('Camera is ready. Detecting objects. Tap the button again to stop.');

      let lastAnnouncedTime = 0;
      const ANNOUNCEMENT_DELAY = 2000; // 2 seconds

      const detectFrame = async () => {
        if (!detectionLoopRef.current || !videoRef.current) {
          return;
        }

        if (videoRef.current.readyState === 4) {
          const video = videoRef.current;
          const predictions = await model.detect(video);

          // Draw on canvas
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }

            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              predictions.forEach(prediction => {
                const [x, y, width, height] = prediction.bbox;
                const maxSize = Math.max(width, height);
                const estimatedMeters = (300 / maxSize).toFixed(1);

                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);
                ctx.fillStyle = '#00FF00';
                ctx.font = '18px Arial';
                ctx.fillText(`${prediction.class} (${estimatedMeters}m) ${Math.round(prediction.score * 100)}%`, x, y > 10 ? y - 5 : 10);
              });
            }
          }

          const now = Date.now();
          if (now - lastAnnouncedTime > ANNOUNCEMENT_DELAY) {
            const highConfidencePredictions = predictions.filter(p => p.score > 0.66);
            
            if (highConfidencePredictions.length > 0) {
              // Sort by area (largest first -> closest)
              highConfidencePredictions.sort((a, b) => (b.bbox[2] * b.bbox[3]) - (a.bbox[2] * a.bbox[3]));
              
              const primary = highConfidencePredictions[0];
              const [_, __, width, height] = primary.bbox;
              
              // Heuristic: Distance ~ Constant / Size. Assuming 300px is roughly 1 meter for average object.
              const maxSize = Math.max(width, height);
              const estimatedMeters = (300 / maxSize).toFixed(1);
              
              const message = `${primary.class} is ${estimatedMeters} meters away`;
              voiceService.speak(message);
              lastAnnouncedTime = now;
            }
          }
        }

        requestAnimationFrame(detectFrame);
      };

      detectFrame();
    } catch (error) {
      console.error('Object detection error:', error);
      let errorMessage = 'An error occurred during object detection.';
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.message.includes('Permission denied'))) {
        errorMessage = 'Camera access denied. Please enable camera permissions in your browser settings.';
      }
      await voiceService.speak(errorMessage);
      stopObjectDetection();
    }
  };

  const handleLogout = async () => {
    await voiceService.speak('Logging out. Goodbye.');
    await signOut();
  };

  const handleSaveHealthCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.id) {
      localStorage.setItem(`healthCard_${user.id}`, JSON.stringify(healthCard));
      setIsEditingHealthCard(false);
      voiceService.speak('Health card saved successfully.');
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.id) {
      localStorageService.saveEmergencyContact({
        patient_id: user.id,
        ...contactForm
      });
      setContactForm({ contact_name: '', phone_number: '', relationship: '' });
      loadData();
      await voiceService.speak('Emergency contact saved successfully.');
    }
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.id) {
      medicineForm.times.forEach((time) => {
        localStorageService.saveMedicineSchedule({
          patient_id: user.id,
          active: true,
          medicine_name: medicineForm.medicine_name,
          dosage: medicineForm.dosage,
          scheduled_time: time,
          frequency: 'Daily',
          instructions: medicineForm.timing === 'before_food' ? 'Before Food' : 'After Food'
        });
      });
      setMedicineForm({ medicine_name: '', dosage: '', frequency: 'once', times: ['09:00'], timing: 'after_food' });
      loadData();
      await voiceService.speak('Medicine schedule saved successfully.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            {user?.full_name}'s Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-lg font-semibold active:scale-95 transition-all"
          >
            <LogOut size={24} />
            <span>Logout</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="flex flex-row md:flex-col gap-4 md:gap-32">
            <button
              onClick={handleVoiceMessage}
              className={`w-full aspect-square rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
                isRecording
                  ? 'bg-blue-600 hover:bg-blue-700 scale-105 animate-pulse'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white shadow-2xl active:scale-95 p-4`}
              aria-label="Voice health message"
            >
              <MessageSquare size={80} strokeWidth={2} />
              <span className="text-2xl md:text-3xl font-bold mt-4 text-center px-2">Voice Message</span>
              <span className="text-lg md:text-xl mt-2 text-center px-2">Health Report</span>
            </button>

            <button
              onClick={handleSOS}
              className="w-full aspect-square rounded-full bg-red-500 hover:bg-red-600 text-white shadow-2xl flex flex-col items-center justify-center transition-all active:scale-95 p-4"
              aria-label="SOS emergency button"
            >
              <AlertCircle size={80} strokeWidth={2} />
              <span className="text-2xl md:text-3xl font-bold mt-4 text-center px-2">SOS</span>
              <span className="text-lg md:text-xl mt-2 text-center px-2">Emergency</span>
            </button>
          </div>

          <div className={`transition-all duration-300 ${isNavVisible ? 'bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-full min-h-[400px]' : 'h-auto flex justify-center'}`}>
            {isNavVisible ? (
              <>
                <div className="flex border-b relative pr-12">
                  <button
                    onClick={() => setActiveTab('health_card')} className={`flex-1 py-4 text-lg font-semibold transition-colors ${
                      activeTab === 'health_card' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Health Card
                  </button>
                  <button
                    onClick={() => setActiveTab('contacts')} className={`flex-1 py-4 text-lg font-semibold transition-colors ${
                      activeTab === 'contacts' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Contacts
                  </button>
                  <button
                    onClick={() => setActiveTab('medicine')} className={`flex-1 py-4 text-lg font-semibold transition-colors ${
                      activeTab === 'medicine' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Medicine
                  </button>
                  <button
                    onClick={() => setIsNavVisible(false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    title="Hide Panel"
                  >
                    <ChevronUp size={20} />
                  </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
              {activeTab === 'health_card' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">Health Card</h3>
                    {!isEditingHealthCard && (
                      <button
                        onClick={() => setIsEditingHealthCard(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
                      >
                        Update
                      </button>
                    )}
                  </div>

                  {isEditingHealthCard ? (
                    <form onSubmit={handleSaveHealthCard} className="space-y-6">
                      <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                        <h4 className="font-semibold text-slate-700 border-b pb-2">Patient Basic Info</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <input type="text" value={healthCard.fullName} onChange={e => setHealthCard({...healthCard, fullName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                            <input type="number" value={healthCard.age} onChange={e => setHealthCard({...healthCard, age: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                            <select value={healthCard.gender} onChange={e => setHealthCard({...healthCard, gender: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                            <select value={healthCard.bloodGroup} onChange={e => setHealthCard({...healthCard, bloodGroup: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                              <option value="">Select</option>
                              <option value="A+">A+</option>
                              <option value="A-">A-</option>
                              <option value="B+">B+</option>
                              <option value="B-">B-</option>
                              <option value="AB+">AB+</option>
                              <option value="AB-">AB-</option>
                              <option value="O+">O+</option>
                              <option value="O-">O-</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Height (cm)</label>
                            <input type="number" value={healthCard.height} onChange={e => setHealthCard({...healthCard, height: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
                            <input type="number" value={healthCard.weight} onChange={e => setHealthCard({...healthCard, weight: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                        <h4 className="font-semibold text-slate-700 border-b pb-2">Medical Information</h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Known Diseases / Conditions', key: 'knownDiseases' },
                            { label: 'Allergies', key: 'allergies' },
                            { label: 'Current Symptoms', key: 'currentSymptoms' },
                            { label: 'Current Medications', key: 'currentMedications' },
                            { label: 'Past Medical History', key: 'pastMedicalHistory' }
                          ].map(field => (
                            <div key={field.key}>
                              <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                              <textarea
                                value={healthCard[field.key as keyof typeof healthCard]}
                                onChange={e => setHealthCard({...healthCard, [field.key]: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-20"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                        <h4 className="font-semibold text-slate-700 border-b pb-2">Doctor Notes</h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Diagnosis Summary', key: 'diagnosisSummary' },
                            { label: 'Special Instructions / Precautions', key: 'specialInstructions' }
                          ].map(field => (
                            <div key={field.key}>
                              <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                              <textarea
                                value={healthCard[field.key as keyof typeof healthCard]}
                                onChange={e => setHealthCard({...healthCard, [field.key]: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg h-20"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
                        <Save size={20} />
                        Save Health Card
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h4 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Patient Info</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                          <div><span className="text-sm text-slate-500 block">Name</span> <span className="font-medium">{healthCard.fullName}</span></div>
                          <div><span className="text-sm text-slate-500 block">Age/Gender</span> <span className="font-medium">{healthCard.age} / {healthCard.gender}</span></div>
                          <div><span className="text-sm text-slate-500 block">Blood Group</span> <span className="font-medium">{healthCard.bloodGroup || '-'}</span></div>
                          <div><span className="text-sm text-slate-500 block">Height</span> <span className="font-medium">{healthCard.height ? `${healthCard.height} cm` : '-'}</span></div>
                          <div><span className="text-sm text-slate-500 block">Weight</span> <span className="font-medium">{healthCard.weight ? `${healthCard.weight} kg` : '-'}</span></div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h4 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Medical Details</h4>
                        <div className="space-y-4">
                          {['knownDiseases', 'allergies', 'currentSymptoms', 'currentMedications', 'pastMedicalHistory'].map(key => (
                            <div key={key}>
                              <span className="text-sm text-slate-500 block capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <p className="text-slate-800 whitespace-pre-wrap">{healthCard[key as keyof typeof healthCard] || 'None'}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h4 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Doctor Notes</h4>
                        <div className="space-y-4">
                          {['diagnosisSummary', 'specialInstructions'].map(key => (
                            <div key={key}>
                              <span className="text-sm text-slate-500 block capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <p className="text-slate-800 whitespace-pre-wrap">{healthCard[key as keyof typeof healthCard] || 'None'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'contacts' ? (
                <form onSubmit={handleSaveContact} className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Add Emergency Contact</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={contactForm.contact_name}
                      onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={contactForm.phone_number}
                      onChange={(e) => setContactForm({ ...contactForm, phone_number: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
                    <input
                      type="text"
                      required
                      value={contactForm.relationship}
                      onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 mt-4">
                    <Save size={20} />
                    Save Contact
                  </button>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Saved Contacts</h4>
                    <div className="space-y-2">
                      {contacts.map((contact) => (
                        <div key={contact.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-800">{contact.contact_name}</div>
                          <div className="text-sm text-slate-500">{contact.phone_number}</div>
                        </div>
                      ))}
                      {contacts.length === 0 && <p className="text-sm text-slate-400 italic">No contacts saved</p>}
                    </div>
                  </div>
                </form>
              ) : activeTab === 'medicine' ? (
                <form onSubmit={handleSaveMedicine} className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Add Medicine Schedule</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Medicine Name</label>
                    <input
                      type="text"
                      required
                      value={medicineForm.medicine_name}
                      onChange={(e) => setMedicineForm({ ...medicineForm, medicine_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dosage</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1 pill"
                      value={medicineForm.dosage}
                      onChange={(e) => setMedicineForm({ ...medicineForm, dosage: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                    <select
                      value={medicineForm.frequency}
                      onChange={(e) => {
                        const freq = e.target.value;
                        let newTimes = [...medicineForm.times];
                        if (freq === 'once') newTimes = [newTimes[0] || '09:00'];
                        else if (freq === 'twice') newTimes = [newTimes[0] || '09:00', newTimes[1] || '21:00'];
                        else if (freq === 'thrice') newTimes = [newTimes[0] || '09:00', newTimes[1] || '14:00', newTimes[2] || '21:00'];
                        setMedicineForm({ ...medicineForm, frequency: freq, times: newTimes });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="once">Once Daily</option>
                      <option value="twice">Twice Daily</option>
                      <option value="thrice">Thrice Daily</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {medicineForm.times.map((time, index) => (
                      <div key={index}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Time {index + 1}</label>
                        <input
                          type="time"
                          required
                          value={time}
                          onChange={(e) => {
                            const newTimes = [...medicineForm.times];
                            newTimes[index] = e.target.value;
                            setMedicineForm({ ...medicineForm, times: newTimes });
                          }}
                          className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Timing</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="timing"
                          value="before_food"
                          checked={medicineForm.timing === 'before_food'}
                          onChange={(e) => setMedicineForm({ ...medicineForm, timing: e.target.value })}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-slate-700">Before Food</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="timing"
                          value="after_food"
                          checked={medicineForm.timing === 'after_food'}
                          onChange={(e) => setMedicineForm({ ...medicineForm, timing: e.target.value })}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-slate-700">After Food</span>
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 mt-4">
                    <Save size={20} />
                    Save Schedule
                  </button>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Scheduled Medicines</h4>
                    <div className="space-y-2">
                      {medicines.map((med) => (
                        <div key={med.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="font-semibold text-slate-800">{med.medicine_name}</div>
                          <div className="text-sm text-slate-500">{med.scheduled_time} - {med.instructions}</div>
                        </div>
                      ))}
                      {medicines.length === 0 && <p className="text-sm text-slate-400 italic">No medicines scheduled</p>}
                    </div>
                  </div>
                </form>
              ) : null}
            </div>
              </>
            ) : (
              <button
                onClick={() => setIsNavVisible(true)}
                className="px-6 py-3 bg-white rounded-full shadow-lg text-slate-600 hover:bg-slate-50 hover:scale-105 transition-all flex items-center gap-2"
                aria-label="Show Dashboard Panel"
              >
                <ChevronDown size={24} />
                <span className="font-semibold">Click to view patient health card</span>
              </button>
            )}
          </div>

          <div className="flex flex-row md:flex-col gap-4 md:gap-32">
            <button
              onClick={handleMedicineAssistant}
              className="w-full aspect-square rounded-full bg-green-500 hover:bg-green-600 text-white shadow-2xl flex flex-col items-center justify-center transition-all active:scale-95 p-4"
              aria-label="Medicine assistant"
            >
              <Pill size={80} strokeWidth={2} />
              <span className="text-2xl md:text-3xl font-bold mt-4 text-center px-2">Medicine</span>
              <span className="text-lg md:text-xl mt-2 text-center px-2">Assistant</span>
            </button>

            <button
              onClick={handleObjectDetection}
              className={`w-full aspect-square rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
                isCameraActive
                  ? 'bg-orange-600 hover:bg-orange-700 scale-105'
                  : 'bg-orange-500 hover:bg-orange-600'
              } text-white shadow-2xl active:scale-95 p-4`}
              aria-label="Object detection"
            >
              <Camera size={80} strokeWidth={2} />
              <span className="text-2xl md:text-3xl font-bold mt-4 text-center px-2">Object</span>
              <span className="text-lg md:text-xl mt-2 text-center px-2">Detection</span>
            </button>
          </div>
        </div>

        {activeAlert && (
          <div className="text-center space-y-4">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
              <p className="font-bold">SOS Alert Sent!</p>
              <p>
                {activeAlert.alert_type === 'single'
                  ? 'Your emergency contacts have been notified.'
                  : 'Your doctor and emergency contacts have been notified with your location.'}
              </p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleCancelSOS}
                className="w-full md:w-96 h-24 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-95"
                aria-label="Cancel SOS"
              >
                <XCircle size={48} strokeWidth={2} />
                <span className="text-3xl font-bold">Cancel SOS</span>
              </button>
            </div>
          </div>
        )}

        {isCameraActive && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-700">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <button
              onClick={stopObjectDetection}
              className="mt-8 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full text-xl font-bold flex items-center gap-3 transition-all active:scale-95 shadow-lg"
            >
              <XCircle size={32} />
              Stop Detection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
