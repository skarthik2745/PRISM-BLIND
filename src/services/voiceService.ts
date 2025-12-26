export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.synthesis = window.speechSynthesis;

    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
    } else if ('SpeechRecognition' in window) {
      this.recognition = new (window as any).SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
    }
  }

  speak(text: string, rate: number = 0.9, pitch: number = 1.0, volume: number = 1.0): Promise<void> {
    return new Promise((resolve, reject) => {
      this.synthesis.cancel();

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.rate = rate;
      this.currentUtterance.pitch = pitch;
      this.currentUtterance.volume = volume;
      this.currentUtterance.lang = 'en-US';

      this.currentUtterance.onend = () => {
        resolve();
      };

      this.currentUtterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve();
        } else {
          reject(event);
        }
      };

      this.synthesis.speak(this.currentUtterance);
    });
  }

  stopSpeaking(): void {
    this.synthesis.cancel();
  }

  startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript.toLowerCase().trim());
      };

      this.recognition.onerror = (event) => {
        reject(event.error);
      };

      this.recognition.onend = () => {
        this.recognition?.stop();
      };

      try {
        this.recognition.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  isSupported(): boolean {
    return this.recognition !== null && 'speechSynthesis' in window;
  }
}

export const voiceService = new VoiceService();
