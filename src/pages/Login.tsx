import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { voiceService } from '../services/voiceService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from '../hooks/useNavigate';

export default function Login() {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const navigate = useNavigate();
  const { signIn } = useAuth();

  useEffect(() => {
    voiceService
      .speak('Welcome to PRISM for Blind, a Platform for Remote Integrated Smart Monitoring. Please tap the microphone button to begin voice login.')
      .catch(() => {});
  }, []);

  const handleVoiceLogin = async () => {
    if (!isListening) {
      setIsListening(true);
      setStatus('Listening...');

      try {
        await voiceService.speak('Voice recognition started. Please say your unique name.');
        const transcript = await voiceService.startListening();
        const cleanedTranscript = transcript.replace(/\s+/g, '').toLowerCase();
        setVoiceName(cleanedTranscript);
        setStatus(`Heard: ${transcript} (cleaned: ${cleanedTranscript})`);
        await voiceService.speak(`Voice recognized. Logging you in.`);

        const success = await signIn(cleanedTranscript);

        if (!success) {
          await voiceService.speak('Voice name not recognized. Please try again.');
          setStatus('Voice name not found');
          setIsListening(false);
          setVoiceName('');
          return;
        }

        const user = await new Promise(resolve => {
          setTimeout(() => {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
            resolve(currentUser);
          }, 100);
        });

        await voiceService.speak(`You are successfully logged into the system. Welcome ${user?.full_name}.`);

        if (user?.role === 'patient') {
          navigate('/patient-dashboard');
        } else {
          navigate('/doctor-dashboard');
        }
      } catch (error) {
        console.error('Voice login error:', error);
        await voiceService.speak('An error occurred. Please try again.');
        setStatus('Error occurred');
        setIsListening(false);
      }
    } else {
      voiceService.stopListening();
      setIsListening(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-6xl font-bold text-blue-900 mb-2">
          PRISM for Blind
        </h1>
        <p className="text-xl md:text-2xl text-slate-600">
          Platform for Remote Integrated Smart Monitoring
        </p>
        <p className="text-2xl md:text-3xl text-blue-700 mt-4">
          Tap the microphone to login with your voice
        </p>
      </div>

      <button
        onClick={handleVoiceLogin}
        className={`w-64 h-64 md:w-80 md:h-80 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white shadow-2xl active:scale-95`}
        aria-label="Voice login button"
      >
        <Mic size={120} strokeWidth={2} />
        <span className="text-2xl font-semibold mt-4">
          {isListening ? 'Listening...' : 'Tap to Speak'}
        </span>
      </button>

      {status && (
        <div className="mt-8 text-2xl text-blue-800 font-medium">
          {status}
        </div>
      )}

      {voiceName && (
        <div className="mt-4 text-xl text-blue-700">
          Voice: {voiceName}
        </div>
      )}

      <div className="mt-12">
        <button
          onClick={() => navigate('/create-account')}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-semibold rounded-lg shadow-lg active:scale-95 transition-all"
        >
          Create New Account (Helper)
        </button>
      </div>
    </div>
  );
}
