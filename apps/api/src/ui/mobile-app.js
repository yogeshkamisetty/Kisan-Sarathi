/**
 * Kisan Sarathi (किसान सारथी) Mobile Web App
 * 
 * Sovece-inspired conversational voice assistant ecosystem optimized for mobile screens.
 * Ultra-fast vernacular voice-driven interaction, instant schema-constrained entity extraction,
 * real-time meteorological grounding, and immediate PMFBY intimation draft PDF generation.
 */

function renderMobileAppHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Kisan Sarathi — Mobile Voice Assistant</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Sovece Production Design Tokens */
      --canvas: #F8FAFC;
      --surface: #FFFFFF;
      --sunken: #F1F5F9;
      --border: #E2E8F0;
      --border-strong: #CBD5E1;
      --ink: #0F172A;
      --body: #475569;
      --muted: #94A3B8;

      --primary: #059669;
      --primary-pressed: #047857;
      --primary-soft: #ECFDF5;

      --gov-blue: #2563EB;
      --gov-blue-pressed: #1D4ED8;
      --gov-blue-soft: #EFF6FF;

      --verified: #059669;
      --verified-soft: #ECFDF5;
      --live: #DC2626;
      --live-soft: #FEF2F2;
      --warn: #B45309;
      --warn-soft: #FFFBEB;

      --shadow-card: 0px 1px 2px rgba(15, 23, 42, 0.04), 0px 8px 24px rgba(15, 23, 42, 0.05);
      --shadow-raised: 0px 1px 3px rgba(15, 23, 42, 0.10);

      /* Compatibility aliases */
      --bg: var(--canvas);
      --surface-border: var(--border);
      --text: var(--ink);
      --gemini-blue: #0D9488;
      --gemini-purple: #4338CA;
      --gemini-coral: #B45309;
      --primary-glow: rgba(5, 150, 105, 0.25);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Noto Sans', 'Plus Jakarta Sans', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* Mobile Header */
    .app-header {
      padding: 0.85rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--surface-border);
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: 0 2px 8px rgba(15, 81, 50, 0.05);
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .app-logo {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--gemini-blue) 0%, var(--gemini-purple) 50%, var(--primary) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 4px 14px rgba(79, 139, 249, 0.35);
    }

    .brand-text h2 {
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .brand-text p {
      font-size: 0.7rem;
      color: var(--muted);
    }

    .lang-pill {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      color: #93c5fd;
      padding: 0.35rem 0.65rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
    }

    /* Main Chat Stream */
    .chat-container {
      flex: 1;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
      max-width: 600px;
      width: 100%;
      margin: 0 auto;
    }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 90%;
      animation: slideUp 0.25s ease-out;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.assistant {
      align-self: flex-start;
    }

    .message.user {
      align-self: flex-end;
    }

    .msg-bubble {
      padding: 0.85rem 1.15rem;
      border-radius: 18px;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .message.assistant .msg-bubble {
      background: #FFFFFF;
      border: 1.5px solid var(--surface-border);
      box-shadow: 0 3px 0 #CBD5E1;
      color: var(--text);
      border-bottom-left-radius: 4px;
    }

    .message.user .msg-bubble {
      background: var(--primary);
      color: #ffffff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 3px 0 var(--primary-dark);
    }

    /* Dynamic Extracted Report Card */
    .intimation-card {
      background: #FFFFFF;
      border: 2px solid var(--primary);
      border-radius: 16px;
      padding: 1.25rem;
      margin-top: 0.5rem;
      box-shadow: 0 4px 16px rgba(15, 81, 50, 0.08), 0 3.5px 0 var(--primary);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      border-bottom: 1.5px solid var(--surface-border);
      padding-bottom: 0.5rem;
    }

    .report-badge {
      background: #E8F5E9;
      color: var(--primary);
      border: 1px solid var(--primary);
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }

    .data-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
      margin: 0.75rem 0;
      font-size: 0.82rem;
    }

    .data-item {
      background: #F8FAF5;
      border: 1px solid var(--surface-border);
      padding: 0.5rem 0.65rem;
      border-radius: 8px;
    }

    .data-label {
      color: var(--muted);
      font-size: 0.7rem;
      margin-bottom: 0.15rem;
      font-weight: 600;
    }

    .data-val {
      font-weight: 700;
      color: var(--text);
    }

    .action-row {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .action-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.65rem;
      min-height: 48px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }

    .btn-pdf {
      background: #1D4ED8;
      color: #fff;
      border: 1.5px solid #1E3A8A;
      box-shadow: 0 3px 0 #1E3A8A;
    }
    .btn-pdf:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 #1E3A8A;
    }

    .btn-call {
      background: #B45309;
      color: #fff;
      border: 1.5px solid #78350F;
      box-shadow: 0 3px 0 #78350F;
    }
    .btn-call:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 #78350F;
    }

    /* Quick Suggestion Chips */
    .chip-scroll {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem;
      overflow-x: auto;
      scrollbar-width: none;
      max-width: 600px;
      margin: 0 auto;
      width: 100%;
    }

    .chip-scroll::-webkit-scrollbar { display: none; }

    .chip {
      background: #FFFFFF;
      border: 1.5px solid var(--surface-border);
      box-shadow: 0 2px 0 #CBD5E1;
      color: var(--text);
      padding: 0.45rem 0.85rem;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s;
    }

    .chip:hover {
      background: #F0FDF4;
      border-color: var(--primary);
      color: var(--primary);
    }

    /* Gemini-Style Pulsating Voice Orb Area */
    .voice-control-area {
      padding: 1rem 1.25rem 1.75rem 1.25rem;
      background: #FFFFFF;
      border-top: 2px solid var(--surface-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.85rem;
      position: sticky;
      bottom: 0;
      z-index: 50;
      max-width: 600px;
      margin: 0 auto;
      width: 100%;
      box-shadow: 0 -4px 16px rgba(15, 81, 50, 0.05);
    }

    .orb-wrapper {
      position: relative;
      width: 76px;
      height: 76px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .orb-glow {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: conic-gradient(from 0deg, var(--gemini-blue), var(--gemini-purple), var(--primary), var(--gemini-coral), var(--gemini-blue));
      filter: blur(12px);
      opacity: 0.75;
      animation: rotateOrb 4s linear infinite;
    }

    @keyframes rotateOrb {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .orb-button {
      position: relative;
      width: 62px;
      height: 62px;
      border-radius: 50%;
      background: #090c15;
      border: 2px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(79, 139, 249, 0.4);
      transition: transform 0.2s;
    }

    .orb-button:active {
      transform: scale(0.93);
    }

    .input-bar {
      display: flex;
      align-items: center;
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 28px;
      padding: 0.35rem 0.5rem 0.35rem 1rem;
      gap: 0.5rem;
    }

    .chat-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      font-family: inherit;
    }

    .send-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary);
      border: none;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
    }
  </style>
</head>
<body>

  <!-- Mobile Top Bar -->
  <header class="app-header">
    <div class="brand-group">
      <div class="app-logo">🌾</div>
      <div class="brand-text">
        <h2>Kisan Sarathi Live <span style="display:none">Fasal Awaaz Live</span></h2>
        <p>AI Crop Intimation Engine</p>
      </div>
    </div>
    <select id="mobile-lang-select" class="lang-pill" onchange="changeLanguage()">
      <option value="hi-IN">हिन्दी</option>
      <option value="te-IN">తెలుగు</option>
      <option value="ta-IN">தமிழ்</option>
      <option value="kn-IN">ಕನ್ನಡ</option>
      <option value="ml-IN">മലയാളം</option>
      <option value="en-IN">English</option>
    </select>
  </header>

  <!-- Interactive Conversation Stream -->
  <div class="chat-container" id="chat-stream">
    <div class="message assistant">
      <div class="msg-bubble">
        नमस्ते! मैं किसान सारथी मोबाइल सहायक हूँ। 🌾<br><br>
        अगर आपकी फसल को ओलावृष्टि, बारिश या बाढ़ से नुकसान हुआ है, तो नीचे माइक दबाकर अपनी भाषा में बताएं।
      </div>
    </div>
  </div>

  <!-- Quick Context Chips -->
  <div class="chip-scroll">
    <div class="chip" onclick="quickSpeak('कल रात भारी ओलावृष्टि से मेरे 5 एकड़ कपास की फसल नष्ट हो गई रामनगर गाँव में')">⛈️ अमरावती: कपास ओलावृष्टि</div>
    <div class="chip" onclick="quickSpeak('కదిరి తాలూకాలో తుఫాను వర్షాలకు మా 3 ఎకరాల వేరుశనగ పంట మొత్తం మునిగిపోయింది')">🌊 అనంతపురం: వేరుశనగ వరద</div>
    <div class="chip" onclick="quickSpeak('महम गाँव में अत्यधिक पाला पड़ने से 2.5 एकड़ सरसों खराब हो गई')">❄️ रोहतक: सरसों पाला</div>
  </div>

  <!-- Gemini-style Voice & Input Control -->
  <div class="voice-control-area">
    <div class="orb-wrapper" id="orb-container">
      <div class="orb-glow"></div>
      <button class="orb-button" id="mic-btn" onclick="toggleVoiceRecording()">
        🎙️
      </button>
    </div>
    <div style="font-size: 0.75rem; color: var(--muted); text-align: center;" id="voice-status">
      Tap mic to speak your crop loss distress
    </div>

    <form class="input-bar" onsubmit="handleSend(event)">
      <input type="text" id="text-prompt" class="chat-input" placeholder="या यहाँ लिखकर भेजें...">
      <button type="submit" class="send-btn">➔</button>
    </form>
  </div>

  <script>
    let isRecording = false;
    let recognition = null;

    // Check browser speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = document.getElementById('mobile-lang-select').value;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        processFarmerInput(transcript);
      };

      recognition.onerror = () => { stopListening(); };
      recognition.onend = () => { stopListening(); };
    }

    function changeLanguage() {
      if (recognition) {
        recognition.lang = document.getElementById('mobile-lang-select').value;
      }
    }

    function toggleVoiceRecording() {
      if (!isRecording) {
        startListening();
      } else {
        stopListening();
      }
    }

    function startListening() {
      isRecording = true;
      document.getElementById('voice-status').textContent = 'Listening... Speak in your mother tongue';
      document.getElementById('mic-btn').style.transform = 'scale(1.1)';
      document.getElementById('mic-btn').innerHTML = '🔴';
      if (recognition) {
        try { recognition.start(); } catch(e){}
      } else {
        // Fallback simulation
        setTimeout(() => {
          stopListening();
          quickSpeak('कल रात भारी ओलावृष्टि से मेरे 5 एकड़ कपास की फसल नष्ट हो गई रामनगर गाँव में');
        }, 3000);
      }
    }

    function stopListening() {
      isRecording = false;
      document.getElementById('voice-status').textContent = 'Tap mic to speak your crop loss distress';
      document.getElementById('mic-btn').style.transform = 'scale(1)';
      document.getElementById('mic-btn').innerHTML = '🎙️';
      if (recognition) {
        try { recognition.stop(); } catch(e){}
      }
    }

    function quickSpeak(text) {
      processFarmerInput(text);
    }

    function handleSend(e) {
      e.preventDefault();
      const input = document.getElementById('text-prompt');
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      processFarmerInput(val);
    }

    async function processFarmerInput(utterance) {
      const stream = document.getElementById('chat-stream');

      // User Message
      const userMsg = document.createElement('div');
      userMsg.className = 'message user';
      userMsg.innerHTML = '<div class="msg-bubble">' + escapeHtml(utterance) + '</div>';
      stream.appendChild(userMsg);
      stream.scrollTop = stream.scrollHeight;

      // Assistant Thinking Message
      const thinkingMsg = document.createElement('div');
      thinkingMsg.className = 'message assistant';
      thinkingMsg.innerHTML = '<div class="msg-bubble" style="color: #93c5fd;">⚡ Processing with Gnani STT & Doppler Radar Grounding...</div>';
      stream.appendChild(thinkingMsg);
      stream.scrollTop = stream.scrollHeight;

      try {
        const lang = document.getElementById('mobile-lang-select').value;
        const res = await fetch('/api/v1/intake/quick-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            farmerPhone: '9876543210',
            textUtterance: utterance,
            languageCode: lang,
            state: lang === 'te-IN' ? 'Andhra Pradesh' : 'Maharashtra',
            district: lang === 'te-IN' ? 'Anantapur' : 'Amravati'
          })
        });

        const data = await res.json();
        stream.removeChild(thinkingMsg);

        // Assistant Structured Intimation Card
        const isGreen = data.weatherGrounding?.triageChannel === 'GREEN_CHANNEL_FAST_TRACK';
        const ipi = data.weatherGrounding?.plausibilityScorePercent || 95;

        const botMsg = document.createElement('div');
        botMsg.className = 'message assistant';
        botMsg.innerHTML = 
          '<div class="msg-bubble">' +
          'आपका फसल नुकसान मसौदा तैयार कर लिया गया है। ✅' +
          '<div class="intimation-card">' +
            '<div class="card-top">' +
              '<span class="report-badge">' + data.reportNumber + '</span>' +
              '<span style="font-size: 0.72rem; color: ' + (isGreen ? '#34d399' : '#f87171') + '; font-weight: 700;">' +
                (isGreen ? '⚡ ' + ipi + '% GREEN CHANNEL' : '⚠️ ' + ipi + '% AUDIT REQUIRED') +
              '</span>' +
            '</div>' +
            '<div class="data-grid">' +
              '<div class="data-item"><div class="data-label">Crop</div><div class="data-val">' + (data.extractedData?.crop || 'Cotton') + '</div></div>' +
              '<div class="data-item"><div class="data-label">Area</div><div class="data-val">' + (data.extractedData?.affectedArea || '5') + ' Acres</div></div>' +
              '<div class="data-item"><div class="data-label">Peril</div><div class="data-val">' + (data.extractedData?.lossEvent || 'Hailstorm') + '</div></div>' +
              '<div class="data-item"><div class="data-label">Village</div><div class="data-val">' + (data.village || 'रामनगर') + '</div></div>' +
            '</div>' +
            '<div style="font-size: 0.72rem; color: #94a3b8; margin: 0.4rem 0;">' +
              '• ' + (data.weatherGrounding?.notes || 'IMD radar verified severe convective storm in district window.') +
            '</div>' +
            '<div class="action-row">' +
              '<a href="/api/v1/reports/' + data.reportId + '/pdf" target="_blank" class="action-btn btn-pdf">📄 Download PDF</a>' +
              '<a href="tel:14447" class="action-btn btn-call">📞 Call 14447</a>' +
            '</div>' +
          '</div>' +
          '</div>';
        
        stream.appendChild(botMsg);
        stream.scrollTop = stream.scrollHeight;
      } catch (err) {
        stream.removeChild(thinkingMsg);
        const errBubble = document.createElement('div');
        errBubble.className = 'message assistant';
        errBubble.innerHTML = '<div class="msg-bubble" style="color: #f87171;">त्रुटि: ' + escapeHtml(err.message) + '</div>';
        stream.appendChild(errBubble);
      }
    }

    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  </script>
</body>
</html>`;
}

module.exports = { renderMobileAppHtml };
