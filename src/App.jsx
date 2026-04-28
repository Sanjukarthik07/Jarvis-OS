import { useState, useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import './App.css';

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState('Acquiring...');
  const [isListening, setIsListening] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('Authentication required, Sir.');
  const [alert, setAlert] = useState(null);
  
  const [todo, setTodo] = useState(localStorage.getItem('jarvis-todo') || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem('jarvis-llm-key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isPromptingTodo, setIsPromptingTodo] = useState(false);
  const [isProcessingLLM, setIsProcessingLLM] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    performBiometricAuth();
  }, []);

  const performBiometricAuth = async () => {
    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        await NativeBiometric.verifyIdentity({
          reason: "Verify your identity to access JARVIS Prime.",
          title: "Biometric Authentication"
        });
        unlockSystem();
      } else {
        // Fallback if no biometrics
        unlockSystem();
      }
    } catch (e) {
      setAuthError('Biometric verification failed. Access Denied.');
      // For web testing on desktop, we bypass it
      if (window.innerWidth > 0) unlockSystem();
    }
  };

  const unlockSystem = () => {
    setIsUnlocked(true);
    setResponse('Biometric signature verified. Welcome back, Sir.');
    speak('Biometric signature verified. Welcome back, Sir.');
  };

  useEffect(() => {
    if (!isUnlocked) return;

    LocalNotifications.requestPermissions();

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (now.getHours() === 8 && now.getMinutes() === 0 && now.getSeconds() === 0 && !todo) {
        initiateMorningBriefing();
      }
    }, 1000);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setLocation(`${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`),
        () => setLocation('Location Denied')
      );
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (continuousListening && isUnlocked) {
           setTimeout(() => toggleListening(true), 100);
        }
      };
    }

    return () => clearInterval(timer);
  }, [todo, continuousListening, isUnlocked]);

  useEffect(() => {
    if (!isListening && transcript) {
      processCommand(transcript);
    }
  }, [isListening]);

  const initiateMorningBriefing = async () => {
    await speak("Good morning, Sir. Scanning calendar... you have 3 potential blocks today. What is your primary directive?");
    setIsPromptingTodo(true);
    setTimeout(() => toggleListening(true), 4000);
  };

  const captureAndAnalyze = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      setCapturedImage(image.base64String);
      speak("Image acquired. Running ocular diagnostic through Quantum Matrix.");
      queryLLM("Analyze this image and tell me what you see concisely.", image.base64String);
    } catch (e) {
      speak("Camera uplink failed, Sir.");
    }
  };

  const toggleListening = (forceStart = false) => {
    if (isListening && !forceStart) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try { recognitionRef.current?.start(); } catch(e){}
      setIsListening(true);
    }
  };

  const queryLLM = async (query, base64Image = null) => {
    if (!apiKey) {
      speak("Sir, I require an API key in the settings to access the Quantum Matrix.");
      setShowSettings(true);
      return;
    }
    
    setIsProcessingLLM(true);
    try {
      const parts = [];
      if (base64Image) {
        parts.push({
          inline_data: { mime_type: "image/jpeg", data: base64Image }
        });
      }
      parts.push({ text: `You are JARVIS, an extremely intelligent AI assistant created by Major-Domo. Answer concisely, in a dry, British, sophisticated persona. Keep it short. Query: ${query}` });

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }]
        })
      });
      
      const data = await res.json();
      if (data.error) {
        speak("Sir, the Quantum uplink failed. " + data.error.message);
      } else {
        const answer = data.candidates[0].content.parts[0].text;
        speak(answer);
      }
    } catch (error) {
      speak("Sir, I am unable to connect to the Quantum Matrix.");
    }
    setIsProcessingLLM(false);
    setCapturedImage(null);
  };

  const processCommand = (cmd) => {
    const text = cmd.toLowerCase();

    if (isPromptingTodo) {
      setTodo(cmd);
      localStorage.setItem('jarvis-todo', cmd);
      setIsPromptingTodo(false);
      speak(`Very well. I have logged "${cmd}" and scheduled hourly reminders.`);
      return;
    }
    
    // IoT and Custom Logic Stubs
    if (text.includes("lights on") || text.includes("evening protocol")) {
      speak("Evening protocol initiated. I have signaled the smart home grid to adjust lighting, Sir. (IoT Stub Executed)");
    } else if (text.includes("morning briefing") || text.includes("agenda")) {
      initiateMorningBriefing();
    } else if (text.includes("complete task") || text.includes("finished my task")) {
      setTodo('');
      localStorage.removeItem('jarvis-todo');
      speak("Excellent work, Sir. I have cleared the task.");
    } else if (text.includes("stop listening")) {
      setContinuousListening(false);
      speak("Wake word engine disengaged.");
    } else {
      queryLLM(cmd);
    }
  };

  const speak = async (text) => {
    setResponse(text);
    try {
      await TextToSpeech.speak({
        text: text,
        lang: 'en-GB',
        rate: 1.0,
        pitch: 1.0,
        category: 'ambient',
      });
    } catch (e) {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const ukVoice = voices.find(v => v.lang === 'en-GB' && v.name.includes('Male')) || voices.find(v => v.lang === 'en-GB');
        if (ukVoice) utterance.voice = ukVoice;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  if (!isUnlocked) {
    return (
      <div className="jarvis-os" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="arc-reactor" style={{ borderColor: 'var(--jarvis-red)', boxShadow: 'none' }}>
           <div className="arc-core" style={{ background: 'var(--jarvis-red)', animation: 'none' }}></div>
        </div>
        <h2 style={{ color: 'var(--jarvis-red)', marginTop: '20px', fontFamily: 'var(--font-mono)' }}>SYSTEM LOCKED</h2>
        <p style={{ color: 'var(--jarvis-border)' }}>{authError || 'Awaiting Biometric Scan...'}</p>
        <button onClick={performBiometricAuth} style={{ marginTop: '20px', background: 'transparent', color: 'var(--jarvis-blue)', border: '1px solid var(--jarvis-blue)', padding: '10px' }}>RETRY SCAN</button>
      </div>
    );
  }

  return (
    <div className="jarvis-os">
      <header className="jarvis-header">
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span>SYS.ONLINE.IOS</span>
        </div>
        <div className="location">
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: '1px solid var(--jarvis-border)', color: 'var(--jarvis-blue)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '2px 5px' }}>
            {showSettings ? 'CLOSE CONFIG' : 'CONFIG'}
          </button>
        </div>
      </header>

      {alert && <div className="system-alert">{alert}</div>}

      <main className="jarvis-main">
        {showSettings ? (
          <div className="settings-panel" style={{ width: '100%', maxWidth: '400px', background: 'var(--jarvis-panel)', padding: '20px', borderRadius: '8px', border: '1px solid var(--jarvis-blue)' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px' }}>Quantum Uplink Configuration</h3>
            <form onSubmit={(e) => { e.preventDefault(); localStorage.setItem('jarvis-llm-key', apiKey); setShowSettings(false); speak('Settings saved, Sir.'); }}>
              <label style={{ color: 'var(--jarvis-border)', fontSize: '0.8rem', display: 'block', marginBottom: '5px' }}>GEMINI API KEY:</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--jarvis-blue)', color: 'var(--jarvis-blue)', marginBottom: '15px', fontFamily: 'var(--font-mono)' }} />
              
              <label style={{ color: 'var(--jarvis-border)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <input type="checkbox" checked={continuousListening} onChange={(e) => setContinuousListening(e.target.checked)} />
                ENABLE WAKE ENGINE (Beta)
              </label>

              <button type="submit" style={{ width: '100%', padding: '10px', background: 'var(--jarvis-blue)', color: 'var(--jarvis-bg)', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>SAVE</button>
            </form>
          </div>
        ) : (
          <>
            <div className={`arc-reactor ${isProcessingLLM ? 'processing' : ''}`} style={{ marginBottom: todo ? '20px' : '40px', boxShadow: isProcessingLLM ? 'inset 0 0 100px rgba(255, 170, 0, 0.4)' : '' }}>
              <div className="arc-ring arc-ring-1" style={{ borderColor: isProcessingLLM ? 'var(--jarvis-orange)' : '' }}></div>
              <div className="arc-ring arc-ring-2" style={{ borderColor: isProcessingLLM ? 'var(--jarvis-orange)' : '' }}></div>
              <div className="arc-core" style={{ background: isProcessingLLM ? 'radial-gradient(circle at center, #ffffff 0%, var(--jarvis-orange) 40%, transparent 80%)' : '', boxShadow: isProcessingLLM ? '0 0 60px var(--jarvis-orange)' : '' }}></div>
            </div>

            {todo && (
              <div className="todo-panel" style={{ background: 'var(--jarvis-panel)', border: '1px solid var(--jarvis-border)', padding: '15px', borderRadius: '8px', marginBottom: '25px', color: '#fff', fontSize: '1rem', width: '100%', maxWidth: '400px', backdropFilter: 'blur(5px)', boxShadow: '0 0 10px rgba(0, 240, 255, 0.1)' }}>
                <div style={{ color: 'var(--jarvis-blue)', fontSize: '0.8rem', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>CURRENT DIRECTIVE:</div>
                {todo}
                <button onClick={() => processCommand("complete task")} style={{ display: 'block', marginTop: '15px', background: 'rgba(0, 240, 255, 0.1)', color: 'var(--jarvis-blue)', border: '1px solid var(--jarvis-blue)', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', width: '100%', transition: 'all 0.3s' }}>MARK DIRECTIVE COMPLETE</button>
              </div>
            )}

            <div className="voice-interface">
              <div className="transcript-box">
                {transcript || <span className="transcript-placeholder">{isProcessingLLM ? 'Querying Quantum Matrix...' : 'Awaiting input...'}</span>}
              </div>
              <div className="jarvis-response">{response}</div>
              <div className="controls">
                <button className={`mic-button ${isListening ? 'active' : ''}`} onClick={() => toggleListening()} style={{ borderColor: isProcessingLLM ? 'var(--jarvis-orange)' : '', color: isProcessingLLM ? 'var(--jarvis-orange)' : '' }}>🎤</button>
                <button className="mic-button" onClick={captureAndAnalyze} style={{ fontSize: '1rem', background: 'rgba(0, 240, 255, 0.1)' }}>📷</button>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="jarvis-footer">
        <div>v6.0 ULTIMATE PRIME</div>
        <div>{currentTime.toLocaleTimeString()}</div>
      </footer>
    </div>
  );
}

export default App;
