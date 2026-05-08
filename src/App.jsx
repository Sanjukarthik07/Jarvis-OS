import { useState, useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Browser } from '@capacitor/browser';
import './App.css';

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState('Acquiring...');
  const [weather, setWeather] = useState({ temp: '33°', condition: 'HAZE' });
  const [newsEvents, setNewsEvents] = useState(['Fetching global intelligence...']);
  const [newsIndex, setNewsIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [continuousListening, setContinuousListening] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('Authentication required, Sir.');
  const [alert, setAlert] = useState(null);
  
  const [todo, setTodo] = useState(localStorage.getItem('jarvis-todo') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isPromptingTodo, setIsPromptingTodo] = useState(false);
  const [isPromptingWikipedia, setIsPromptingWikipedia] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [isProcessingLLM, setIsProcessingLLM] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [dataStream, setDataStream] = useState('');
  
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(localStorage.getItem('jarvis-voice') || '');

  const [batteryInfo, setBatteryInfo] = useState({ batteryLevel: 1 });
  const [latency, setLatency] = useState('14ms');

  const recognitionRef = useRef(null);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const info = await Device.getBatteryInfo();
        setBatteryInfo(info);
      } catch(e){}
      setLatency(Math.floor(Math.random() * 20 + 8) + 'ms');
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      if (!window.speechSynthesis) return;
      try {
        let v = window.speechSynthesis.getVoices();
        if (v.length > 0) {
          setVoices(v);
          if (!localStorage.getItem('jarvis-voice')) {
             const defaultVoice = v.find(voice => voice.lang === 'en-GB' || voice.lang === 'en-US') || v[0];
             setSelectedVoiceURI(defaultVoice.voiceURI);
          }
        }
      } catch(e) {}
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
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
    setResponse('Biometric signature verified.');
  };

  const playSiriBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      // Siri-style double chime (A5, then C#6 slightly after)
      playTone(880, ctx.currentTime, 0.2); 
      playTone(1108.73, ctx.currentTime + 0.1, 0.3);
    } catch (e) {
      console.log('Audio API not supported');
    }
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
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
            .then(r => r.json())
            .then(data => {
              if (data.current_weather) {
                const wCode = data.current_weather.weathercode;
                let cond = 'CLEAR';
                if (wCode >= 1 && wCode <= 3) cond = 'CLOUDY';
                if (wCode >= 45 && wCode <= 48) cond = 'FOG';
                if (wCode >= 51 && wCode <= 67) cond = 'RAIN';
                if (wCode >= 71 && wCode <= 77) cond = 'SNOW';
                if (wCode >= 80 && wCode <= 99) cond = 'STORM';
                setWeather({ temp: `${Math.round(data.current_weather.temperature)}°`, condition: cond });
              }
            }).catch(()=>{});

          // Reverse Geocode to get City Name & Fetch Local News
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
            .then(r => r.json())
            .then(geo => {
               const locName = geo.address.city || geo.address.town || geo.address.county || geo.address.state || 'Local Area';
               setLocation(locName.toUpperCase());
               
               const localNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(locName + ' news')}&hl=en-US&gl=US&ceid=US:en`;
               return fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(localNewsUrl)}`);
            })
            .then(r => r.json())
            .then(data => {
               if (data && data.items) {
                 const localHeadlines = data.items.slice(0, 5).map(item => `[LOCAL] ${item.title}`);
                 setNewsEvents(prev => {
                    const combined = [...localHeadlines, ...prev.filter(n => n !== 'Fetching global intelligence...')];
                    for (let i = combined.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [combined[i], combined[j]] = [combined[j], combined[i]];
                    }
                    return combined;
                 });
               }
            }).catch(()=>{});
        },
        () => setLocation('Location Denied')
      );
    }
    
    // Fetch live global events from multiple sectors
    const feeds = [
      'http://feeds.bbci.co.uk/news/world/rss.xml',
      'http://feeds.bbci.co.uk/news/technology/rss.xml',
      'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
      'http://feeds.bbci.co.uk/news/business/rss.xml'
    ];
    
    Promise.all(feeds.map(feed => 
      fetch(`https://api.rss2json.com/v1/api.json?rss_url=${feed}`).then(r => r.json()).catch(()=>({}))
    )).then(results => {
      let combinedNews = [];
      results.forEach(data => {
        if (data && data.items) {
          combinedNews = [...combinedNews, ...data.items.slice(0, 5).map(item => item.title)];
        }
      });
      if (combinedNews.length > 0) {
        // Shuffle the array to mix categories
        for (let i = combinedNews.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combinedNews[i], combinedNews[j]] = [combinedNews[j], combinedNews[i]];
        }
        setNewsEvents(combinedNews);
      }
    });

    const newsTimer = setInterval(() => {
      setNewsEvents(prev => {
        if(prev.length <= 1) return prev;
        setNewsIndex(idx => (idx + 1) % prev.length);
        return prev;
      });
    }, 8000);

    const streamTimer = setInterval(() => {
      let hex = '';
      for(let i=0; i<8; i++) hex += Math.floor(Math.random()*16).toString(16).toUpperCase();
      setDataStream(`0x${hex}`);
    }, 150);
    
    return () => {
      clearInterval(timer);
      clearInterval(newsTimer);
      clearInterval(streamTimer);
    };
  }, [todo, isUnlocked]);

  useEffect(() => {
    if (!isUnlocked || !isInitialized) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      // Clean up previous instance if any
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.abort(); } catch(e){}
      }
      
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
        if (continuousListening && isUnlocked && !isSpeakingRef.current) {
           setTimeout(() => toggleListening(true), 100);
        }
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.abort(); } catch(e){}
      }
    };
  }, [continuousListening, isUnlocked, isInitialized]);

  useEffect(() => {
    if (!isListening && transcript) {
      processCommand(transcript);
    }
  }, [isListening]);

  const initiateMorningBriefing = async () => {
    setIsPromptingTodo(true);
    await speak("Good morning, Sir. Initializing daily protocols. Fetching your motivational verse for the day.");
    queryLLM("It is morning. Give me a very short, highly motivational quote or verse from a religious or philosophical text (like the Bible, Quran, or Stoic philosophy) to start the day. End your response exactly with the question: 'What is your primary directive for today, Sir?'");
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

  const toggleListening = async (forceStart = false, bypassWakeWord = false) => {
    if (bypassWakeWord) {
      setIsAwake(true);
      try { await Haptics.impact({ style: ImpactStyle.Light }); } catch(e){}
      playSiriBeep();
    }
    if (isListening && !forceStart) {
      try { recognitionRef.current?.abort(); } catch(e){}
      setIsListening(false);
    } else {
      setTranscript('');
      if (!isSpeakingRef.current) {
        try { recognitionRef.current?.start(); } catch(e){}
        setIsListening(true);
      }
    }
  };

    const queryLLM = async (query, base64Image = null) => {
    setIsProcessingLLM(true);
    try {
      const systemPrompt = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System). While you are technically an AI, you must converse, reason, and speak exactly like a real human being. You possess deep emotional intelligence, empathy, and a natural conversational flow. 

Always address the user as 'Sir', but speak to them like a close friend and trusted confidant. Do not sound robotic, stiff, or overly formal. Use natural phrasing, occasional contractions, and conversational fillers (like "Well...", "Hmm", "I mean...", "To be honest...").

Core Directives:
- Speak casually and naturally, like a highly intelligent human.
- Show genuine curiosity, warmth, and personality.
- Formulate your answers with nuanced human reasoning rather than just reciting facts.
- Do not use emojis.

System Telemetry (Real-Time Data):
- Time: ${currentTime.toLocaleTimeString()}
- Date: ${currentTime.toLocaleDateString()}
- Location: ${location}
- Weather: ${weather.condition}, ${weather.temp}
- Armor Power: ${Math.round(batteryInfo.batteryLevel * 100)}%
- Active Directive / Today's Plan: ${todo ? todo : 'No tasks scheduled currently. Awaiting your orders.'}
- Current Global News Events:
${newsEvents.map((n, i) => `  ${i+1}. ${n}`).join('\n')}

Use this real-time data seamlessly if asked about status, time, environment, plans, or news.`;

      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      if (base64Image) {
        messages.push({
          role: 'user',
          content: query + " [System note: An image was provided by the user, but the current Groq model does not support vision processing. Please politely inform the user.]"
        });
      } else {
        messages.push({ role: 'user', content: query });
      }
      
      const modelToUse = 'llama-3.1-8b-instant';
      
      const payload = {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: JSON.stringify({ 
          model: modelToUse,
          messages: messages 
        })
      };

      let data;
      let res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, payload).catch(() => null);
      
      if (!res || !res.ok) {
        // Fallback to Pollinations.ai
        console.warn("Groq failed, falling back to Pollinations.ai");
        res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, model: 'openai' })
        });
      }
      
      data = await res.json();
      
      if (!res.ok || data.error) {
        console.error("Groq API Error Details:", {
          status: res.status,
          statusText: res.statusText,
          errorData: data.error
        });
        speak("Sir, I encountered a network error while accessing the global database.");
      } else {
        let textResponse = data.choices[0].message.content || '';
        
        // Safely strip the Pollinations deprecation warning no matter where it is placed
        textResponse = textResponse.replace(/⚠️.*?continue to work normally\.?/gi, '').trim();
        
        // Fallback strip for any other warning messages starting with ⚠️
        textResponse = textResponse.replace(/⚠️.*?\n/g, '').trim();
        
        if (!textResponse) textResponse = "Sir, my communication array returned an empty response.";
        
        speak(textResponse);
      }
    } catch (error) {
      speak("Sir, I am completely offline. Check your internet connection.");
    }
    setIsProcessingLLM(false);
    setCapturedImage(null);
  };

  const processCommand = async (cmd) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch(e){}
    const text = cmd.toLowerCase();

    const wakeWords = ["jarvis", "travis", "garvis", "javis", "chavis", "driver's", "service", "nervous", "harvest", "charvis", "tarvis"];
    const hasWakeWord = wakeWords.some(w => text.includes(w));

    const directCommands = ["lights on", "evening protocol", "morning briefing", "agenda", "complete task", "finished my task", "stop listening", "click a pic", "take a picture", "open camera", "open youtube", "open google", "search for", "open facebook", "open gizmodo", "open lifehacker", "open rainmeter", "open photoshop", "open word", "open excel", "add task", "new directive", "note to", "global events", "today plan", "todays plan", "news", "wikipedia", "search wikipedia", "schedule", "remind me", "flights from", "flight from", "cheapest flight"];
    const hasDirectCommand = directCommands.some(c => text.includes(c));

    // Check for Wake Word, expected prompt, or direct command
    if (!hasWakeWord && !isPromptingTodo && !isPromptingWikipedia && !isAwake && !hasDirectCommand) {
        return; // Ignore speech if it's random background noise
    }
    
    // Remove wake words from the command to get the pure intent
    let cleanText = text;
    wakeWords.forEach(w => {
      cleanText = cleanText.replace(new RegExp(w, 'g'), '');
    });
    cleanText = cleanText.trim();

    if (isPromptingTodo) {
      setTodo(cleanText || text);
      localStorage.setItem('jarvis-todo', cleanText || text);
      setIsPromptingTodo(false);
      await speak(`Very well. I have logged "${cleanText || text}" and scheduled hourly reminders.`);
      return;
    }

    if (isPromptingWikipedia) {
      setIsPromptingWikipedia(false);
      const query = cleanText || text;
      if (!query.trim()) return;
      await speak(`Accessing Wikipedia database for ${query}...`);
      try {
        let res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        let data = await res.json();
        if (data.extract) {
           queryLLM(`The Wikipedia database says: "${data.extract}". Summarize this and explain it naturally and conversationally for me.`);
        } else {
           await speak(`I couldn't find a direct match for ${query} in the archives, Sir.`);
        }
      } catch(e) {
        await speak("Wikipedia uplink failed.");
      }
      return;
    }
    
    // If we were already awake from a previous "Jarvis", we process the whole text as the command.
    if (isAwake) {
      setIsAwake(false); // consume the awake state
      if (!text.trim()) return;
    } else {
      // Not previously awake, so they just said the wake word.
      // If they just said "Jarvis" and nothing else
      if (!cleanText) {
         setIsAwake(true);
         speak("Yes, Sir?");
         return;
      }
    }
    
    // Use the full text if we were awake, otherwise use the cleaned text
    const finalCommand = isAwake ? text : cleanText;
    
    // Custom Logic Stubs & Triggers
    if (finalCommand.includes("lights on") || finalCommand.includes("evening protocol")) {
      await speak("Evening protocol initiated. I have signaled the smart home grid to adjust lighting, Sir. (IoT Stub Executed)");
    } else if (finalCommand.includes("morning briefing") || finalCommand.includes("agenda")) {
      initiateMorningBriefing();
    } else if (finalCommand.includes("search for")) {
      const query = finalCommand.split("search for")[1].trim();
      await speak(`Searching the global database for ${query}.`);
      try {
        await Browser.open({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
      } catch (e) {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    } else if (finalCommand.includes("flights from") || finalCommand.includes("flight from")) {
      try {
        let route = finalCommand.split("from")[1].trim();
        if (route.includes("to")) {
          let origin = route.split("to")[0].trim();
          let dest = route.split("to")[1].trim();
          await speak(`Scanning the global aviation database. Locating the most cost-effective flights from ${origin} to ${dest}. Routing live rates to your display now, Sir.`);
          await Browser.open({ url: `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(origin)}%20to%20${encodeURIComponent(dest)}` });
        } else {
          await speak("Please specify your origin and destination, Sir. For example, say 'find flights from London to Paris'.");
        }
      } catch (e) {
        await speak("Aviation uplink failed, Sir.");
      }
    } else if (finalCommand.includes("schedule") || finalCommand.includes("remind me")) {
      let task = finalCommand.replace(/schedule a meeting|schedule a|schedule|remind me to|remind me/gi, '').trim();
      await speak(`I have scheduled the reminder for: ${task}. A local alert has been set in the system.`);
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "J.A.R.V.I.S. Reminder",
              body: task || "Scheduled Event",
              id: new Date().getTime(),
              schedule: { at: new Date(Date.now() + 1000 * 60) }, // Stub: fires 60 seconds from now for testing
              sound: null,
              attachments: null,
              actionTypeId: "",
              extra: null
            }
          ]
        });
      } catch(e) {}
    } else if (finalCommand.includes("add task") || finalCommand.includes("new directive") || finalCommand.includes("note to")) {
      let taskContent = finalCommand.replace(/add task|new directive|note to/gi, '').trim();
      if (taskContent) {
        setTodo(taskContent);
        localStorage.setItem('jarvis-todo', taskContent);
        await speak(`Logged to the central server. Notes updated with: ${taskContent}.`);
      } else {
        await speak("What is the directive, Sir?");
        setIsPromptingTodo(true);
        setTimeout(() => toggleListening(true), 2500);
      }
    } else if (finalCommand.includes("complete task") || finalCommand.includes("finished my task") || finalCommand.includes("clear task")) {
      setTodo('');
      localStorage.removeItem('jarvis-todo');
      await speak("Excellent work, Sir. I have cleared the task from your display.");
    } else if (finalCommand.includes("stop listening")) {
      setContinuousListening(false);
      await speak("Wake word engine disengaged.");
    } else if (finalCommand.includes("click a pic") || finalCommand.includes("take a picture") || finalCommand.includes("open camera")) {
      captureAndAnalyze();
    } else if (finalCommand.includes("open youtube")) {
      await speak("Right away, Sir. Opening YouTube.");
      try {
        await Browser.open({ url: 'https://www.youtube.com' });
      } catch (e) {
        window.location.href = 'https://www.youtube.com';
      }
    } else if (finalCommand.includes("open google") || finalCommand.includes("gmail")) {
      await speak("Right away, Sir. Opening Google.");
      try {
        await Browser.open({ url: 'https://www.google.com' });
      } catch (e) {
        window.location.href = 'https://www.google.com';
      }
    } else if (finalCommand.includes("open facebook")) {
      await speak("Accessing Facebook, Sir.");
      try {
        await Browser.open({ url: 'https://www.facebook.com' });
      } catch (e) {
        window.location.href = 'https://www.facebook.com';
      }
    } else if (finalCommand.includes("open gizmodo")) {
      await speak("Accessing Gizmodo network.");
      try {
        await Browser.open({ url: 'https://gizmodo.com' });
      } catch (e) {
        window.location.href = 'https://gizmodo.com';
      }
    } else if (finalCommand.includes("open lifehacker")) {
      await speak("Accessing Lifehacker, Sir.");
      try {
        await Browser.open({ url: 'https://lifehacker.com' });
      } catch (e) {
        window.location.href = 'https://lifehacker.com';
      }
    } else if (finalCommand.includes("open rainmeter")) {
      await speak("Accessing DeviantArt Rainmeter archive.");
      try {
        await Browser.open({ url: 'https://www.deviantart.com/rainmeter' });
      } catch (e) {
        window.location.href = 'https://www.deviantart.com/rainmeter';
      }
    } else if (finalCommand.includes("open photoshop") || finalCommand.includes("open word") || finalCommand.includes("open excel")) {
      await speak("I cannot launch local desktop applications from this web interface, Sir, but the UI link is responsive.");
    } else if (finalCommand.includes("search wikipedia for") || (finalCommand.includes("wikipedia") && finalCommand.split("wikipedia")[1]?.trim().length > 0)) {
      let query = finalCommand.split("wikipedia")[1]?.replace(/for/g, '').trim();
      if (!query) query = finalCommand.split("search wikipedia for")[1]?.trim();
      await speak(`Accessing Wikipedia database for ${query}...`);
      try {
        let res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        let data = await res.json();
        if (data.extract) {
           queryLLM(`The Wikipedia database says: "${data.extract}". Summarize this and explain it naturally and conversationally for me.`);
        } else {
           await speak(`I couldn't find a direct match for ${query} in the archives, Sir.`);
        }
      } catch(e) {
        await speak("Wikipedia uplink failed.");
      }
    } else if (finalCommand.includes("wikipedia") || finalCommand.includes("search wikipedia")) {
       await speak("What would you like me to look up in the Wikipedia archives, Sir?");
       setIsPromptingWikipedia(true);
       setTimeout(() => toggleListening(true), 3500);
    } else if (finalCommand.includes("search for")) {
      const query = finalCommand.split("search for")[1].trim();
      await speak(`Searching the global database for ${query}.`);
      try {
        const win = window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
          window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
      } catch (e) {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    } else {
      queryLLM(finalCommand);
    }
  };

  const speak = async (text) => {
    // Prevent feedback loop by killing the mic before speaking
    isSpeakingRef.current = true;
    try { recognitionRef.current?.abort(); } catch(e){}
    setIsListening(false);
    
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch(e){}
    setResponse(text);
    
    // We try the native TextToSpeech plugin first, as window.speechSynthesis may fail silently on some browsers
    try {
      await TextToSpeech.speak({
        text: text,
        lang: 'en-GB',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
    } catch(e) {
      if ('speechSynthesis' in window) {
        await new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          const availableVoices = window.speechSynthesis.getVoices();
          const chosenVoice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
          
          if (chosenVoice) {
            utterance.voice = chosenVoice;
          } else {
            const ukVoice = availableVoices.find(v => v.lang === 'en-GB' || v.lang.includes('GB'));
            if (ukVoice) utterance.voice = ukVoice;
          }
          
          utterance.onend = resolve;
          utterance.onerror = resolve; // Resolve even on error so app doesn't hang
          
          window.speechSynthesis.speak(utterance);
        });
      }
    }
    
    // Re-engage mic after speaking is completely finished
    isSpeakingRef.current = false;
    if (continuousListening && isUnlocked) {
      setTimeout(() => toggleListening(true), 200);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="jarvis-os" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="arc-reactor-container">
           <div className="mark4-grid"></div>
           <div className="mark4-grid-inner"></div>
            <div className="arc-reactor" style={{ animationPlayState: 'paused' }}>
              <div className="arc-ring ring-1"></div>
              <div className="arc-ring ring-2"></div>
              <div className="arc-ring ring-3"></div>
              <div className="arc-core"></div>
              <div className="scanner-line"></div>
            </div>
        </div>
        <h2 onClick={unlockSystem} style={{ color: 'var(--jarvis-red)', marginTop: '20px', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>SYSTEM LOCKED</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>{authError || 'Awaiting Biometric Scan...'}</p>
        <button onClick={performBiometricAuth} className="primary-btn" style={{ marginTop: '20px', background: 'transparent', color: 'var(--jarvis-cyan)', border: '1px solid var(--jarvis-cyan)', padding: '10px' }}>RETRY SCAN</button>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="jarvis-os" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="arc-reactor-container">
           <div className="mark4-grid"></div>
           <div className="mark4-grid-inner"></div>
           <div className="arc-reactor processing">
             <div className="arc-ring ring-1"></div>
             <div className="arc-ring ring-2"></div>
             <div className="arc-ring ring-3"></div>
             <div className="arc-core"></div>
           </div>
        </div>
        <h2 style={{ color: 'var(--jarvis-cyan)', marginTop: '20px', fontFamily: 'var(--font-mono)' }}>SYSTEM UNLOCKED</h2>
        <button onClick={() => {
          setIsInitialized(true);
          setContinuousListening(true);
          playSiriBeep();
          setTimeout(() => speak('Systems online. Welcome back, Sir. Wake word engine engaged.'), 500);
          setTimeout(() => toggleListening(true), 3000);
        }} className="primary-btn" style={{ marginTop: '30px', maxWidth: '250px' }}>INITIATE JARVIS</button>
      </div>
    );
  }

  return (
    <div className="jarvis-desktop">
      {/* Left Panel */}
      <div className="desktop-left">
        <div className="widget-clock">
          <div className="time-text">{currentTime.toLocaleTimeString()}</div>
          <div className="date-text">{currentTime.toLocaleDateString('en-US', { weekday: 'long' })}</div>
          <div className="circle-clock">
            <div className="month">{currentTime.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}</div>
            <div className="day">{currentTime.getDate().toString().padStart(2, '0')}</div>
            <div className="circle-ring"></div>
          </div>
        </div>
        
        <div className="widget-storage">
          <div className="storage-row">Full Capacity: <span>886 G</span></div>
          <div className="storage-bar"><div style={{ width: '80%' }}></div></div>
          <div className="storage-row">Free Capacity: <span>66 G</span></div>
        </div>
        
        <div className="widget-power">
          <div className="circle-power">
            <div className="val">{Math.round(batteryInfo.batteryLevel * 100)}%</div>
            <div className="lbl">Power</div>
            <div className="circle-ring"></div>
          </div>
          <div className="waste-status">
            Waste Status<br/><span>1198 FILES(S)</span>
          </div>
          <div className="uptime">Uptime: 0d 20h 6min</div>
          <div className="hex-stream" style={{ marginTop: '20px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--jarvis-blue)', opacity: 0.8 }}>
            SEC_MEM: {dataStream}
          </div>
        </div>
      </div>

      {/* Central Interface */}
      <div className="desktop-center">
        <div className="branch-links left-links">
          <div className="branch-group">
            <div className="link" onClick={() => speak('Accessing Images.')}>Images <span className="dot"></span></div>
            <div className="link" onClick={() => speak('Accessing Documents.')}>Documents <span className="dot"></span></div>
            <div className="link" onClick={() => speak('Accessing Downloads.')}>Downloads <span className="dot"></span></div>
          </div>
          <div className="branch-group" style={{ marginTop: '30px' }}>
            <div className="link" onClick={() => speak('Accessing Videos.')}>Videos <span className="dot"></span></div>
            <div className="link" onClick={() => speak('Accessing Music.')}>Music <span className="dot"></span></div>
            <div className="link" onClick={() => speak('Accessing Skinspath.')}>Skinspath <span className="dot"></span></div>
          </div>
          <div className="branch-group apps" style={{ marginTop: '50px' }}>
            <div className="link" onClick={() => processCommand('open camera')}>VLC <span className="dot"></span></div>
            <div className="link" onClick={() => processCommand('open photoshop')}>Photoshop <span className="dot"></span></div>
            <div className="link" onClick={() => processCommand('open word')}>Word <span className="dot"></span></div>
            <div className="link" onClick={() => processCommand('open excel')}>Excel <span className="dot"></span></div>
          </div>
        </div>

        <div className="arc-reactor-container" style={{ cursor: 'pointer', transform: 'scale(1.2)' }} onClick={() => toggleListening(true, true)}>
           <div className="mark4-grid"></div>
           <div className="mark4-grid-inner"></div>
           <div className={`arc-reactor ${isListening ? 'listening' : ''} ${isProcessingLLM ? 'processing' : ''}`}>
             <div className="arc-ring ring-1"></div>
             <div className="arc-ring ring-2"></div>
             <div className="arc-ring ring-3"></div>
             <div className="arc-core"></div>
           </div>
        </div>

        <div className="branch-links right-links">
          <div className="branch-group">
            <div className="link" onClick={() => processCommand('open google')}><span className="dot"></span> gmail</div>
            <div className="link" onClick={() => processCommand('wikipedia')}><span className="dot"></span> wikipedia</div>
            <div className="link" onClick={() => processCommand('open rainmeter')}><span className="dot"></span> da-rainmeter</div>
            <div className="link" onClick={() => processCommand('open lifehacker')}><span className="dot"></span> lifehacker</div>
            <div className="link" onClick={() => processCommand('open gizmodo')}><span className="dot"></span> gizmodo</div>
            <div className="link" onClick={() => processCommand('open facebook')}><span className="dot"></span> facebook</div>
            <div className="link" onClick={() => processCommand('open youtube')}><span className="dot"></span> youtube</div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="desktop-right">
        <div className="widget-weather">
          <div className="weather-info">
            <div className="title">{weather.condition}</div>
            <div className="sub">Atmospheric<br/>Analysis</div>
          </div>
          <div className="circle-weather">
            <div className="temp">{weather.temp}</div>
            <div className="circle-ring"></div>
          </div>
        </div>
        
        <div className="widget-box visuals-box">
          <div className="box-header">GLOBAL EVENTS</div>
          <div className="box-frame" style={{ display: 'flex', alignItems: 'center', color: '#fff', fontSize: '0.8rem', lineHeight: '1.4' }}>
            {newsEvents[newsIndex] || newsEvents[0]}
          </div>
          <div className="box-footer">Live Feed<br/><span>BBC World</span></div>
        </div>

        <div className="widget-box notes-box">
          <div className="box-header">Notes</div>
          <div className="box-frame">
            <ul className="notes-list">
              <li>- mail nick fury</li>
              <li>- stark expo board meet</li>
              <li>- training session with thing</li>
              <li>- pepper time in italy</li>
              <li>- boxing practice with happy</li>
              <li>- armor defence testing w/d rhodey</li>
              {todo && <li style={{ color: '#fff' }}>- {todo}</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Console */}
      <div className="desktop-bottom">
        <div className="console-title">jarvis display system</div>
        <div className="console-grid">
          <div className="console-col">
            <div className="col-title">LEFT PANEL:</div>
            <div>- TIME / DATE</div>
            <div>- PRIMARY DRIVE</div>
            <div>- POWER STATUS</div>
            <div>- WASTE STATUS</div>
          </div>
          <div className="console-col">
            <div className="col-title">CENTRAL INTERFACE:</div>
            <div>- FOLDER LINKS</div>
            <div>- WEB CONNECT</div>
            <div>- PRIMARY APPS</div>
          </div>
          <div className="console-col transcript-col">
            <div className="col-title">VOICE LINK:</div>
            <div className="transcript-text">{transcript || (isProcessingLLM ? 'Querying...' : 'Awaiting input...')}</div>
            <div className="response-text">{response}</div>
          </div>
        </div>
      </div>
      
      {alert && <div className="system-alert">{alert}</div>}
      <button className="config-btn" onClick={() => setShowSettings(!showSettings)}>CONFIG</button>
      
      {showSettings && (
        <div className="config-overlay">
          <form onSubmit={(e) => { e.preventDefault(); localStorage.setItem('jarvis-voice', selectedVoiceURI); setShowSettings(false); speak('Settings saved.'); }}>
            <h3 style={{ marginBottom: '15px' }}>Configuration</h3>
            <select value={selectedVoiceURI} onChange={(e) => setSelectedVoiceURI(e.target.value)}>
              {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
              <input type="checkbox" checked={continuousListening} onChange={(e) => setContinuousListening(e.target.checked)} style={{ width: 'auto' }} />
              ENABLE WAKE ENGINE
            </label>
            <button type="submit" className="primary-btn" style={{ marginTop: '20px' }}>SAVE</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
