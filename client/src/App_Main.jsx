import React, { useState, useRef } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5002';
const SESSION_ID = 'session_' + Math.random().toString(36).slice(2, 9);
const LANGUAGES = ['English','Hindi','Spanish','French','Mandarin','Kannada','Tamil','Telugu','Arabic','German','Japanese'];
const ACCEPTED_FILES = '.pdf,.docx,.doc,.mp3,.mp4,.wav,.m4a';

function AudioPlayer({ base64Audio, label = 'Listen' }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  if (!base64Audio) return null;
  const toggle = () => {
    const a = audioRef.current;
    if (playing) { a.pause(); setPlaying(false); }
    else          { a.play();  setPlaying(true);  }
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      <audio ref={audioRef} src={`data:audio/wav;base64,${base64Audio}`} onEnded={() => setPlaying(false)} />
      <button onClick={toggle}
        className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-semibold px-3 py-1.5 rounded-full transition">
        <span>{playing ? '⏸' : '▶'}</span><span>{playing ? 'Pause' : label}</span>
      </button>
    </div>
  );
}

function FileBadge({ name }) {
  if (!name) return null;
  const ext = name.split('.').pop().toLowerCase();
  const styles = {
    pdf: 'bg-red-100 text-red-700', docx: 'bg-blue-100 text-blue-700',
    doc: 'bg-blue-100 text-blue-700', mp3: 'bg-purple-100 text-purple-700',
    mp4: 'bg-green-100 text-green-700', wav: 'bg-purple-100 text-purple-700',
    m4a: 'bg-purple-100 text-purple-700',
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${styles[ext] || 'bg-gray-100 text-gray-600'}`}>{ext.toUpperCase()}</span>;
}

function SummaryBlock({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <h3 key={i} className="text-base font-bold text-gray-800 mt-4 mb-1 border-b border-orange-200 pb-1">{line.replace('## ', '')}</h3>;
        if (line.match(/^[-*•]\s/))
          return <p key={i} className="text-sm text-gray-700 pl-3 flex gap-2"><span className="text-orange-500 mt-0.5">▸</span><span>{line.replace(/^[-*•]\s/, '')}</span></p>;
        if (line.trim())
          return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
        return <div key={i} className="h-1" />;
      })}
    </div>
  );
}

const SUGGESTIONS = [
  { icon: '📊', title: 'Progress tracker',       desc: 'Track quiz scores over time with a chart showing improvement per topic.',                          tag: 'Analytics'   },
  { icon: '🗂️', title: 'Flashcard generator',    desc: 'Auto-generate Anki-style flashcards from key points in the uploaded material.',                   tag: 'Study tools' },
  { icon: '🔗', title: 'Multi-document support', desc: 'Upload multiple files and let the tutor answer across all of them simultaneously.',               tag: 'Content'     },
  { icon: '🎯', title: 'Difficulty adaptive quiz',desc: "Quiz difficulty adjusts automatically based on the student's previous answers.",                  tag: 'Assessment'  },
  { icon: '📝', title: 'Note export',             desc: 'Export the summary and key points as a formatted PDF or DOCX for offline study.',                 tag: 'Export'      },
  { icon: '👥', title: 'Student dashboard',       desc: "Admin panel showing all students' quiz scores, sessions, and activity logs.",                     tag: 'Admin'       },
  { icon: '🔍', title: 'Semantic search',         desc: 'Search within the uploaded material by meaning, not just keywords.',                              tag: 'Search'      },
  { icon: '🌐', title: 'Subtitle download',       desc: 'For YouTube videos, fetch existing subtitles and use them as text context instead of audio.',     tag: 'YouTube'     },
];

export default function App_Main() {
  const [activeTab, setActiveTab]           = useState('processing');
  const [globalLanguage, setGlobalLanguage] = useState('English');

  // Module 1
  const [inputMode,     setInputMode]     = useState('file');
  const [file,          setFile]          = useState(null);
  const [urlInput,      setUrlInput]      = useState('');
  const [contentTitle,  setContentTitle]  = useState('');
  const [summary,       setSummary]       = useState('');
  const [audioSummary,  setAudioSummary]  = useState(null);
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  // Module 2
  const [chatLog,   setChatLog]   = useState([{ sender: 'AI', text: 'Hello! Upload a document or paste a YouTube link, then ask me anything about it.', audio: null }]);
  const [query,     setQuery]     = useState('');
  const [isTyping,  setIsTyping]  = useState(false);

  // Module 3
  const [quizStarted,     setQuizStarted]     = useState(false);
  const [quizData,        setQuizData]        = useState(null);
  const [selectedAnswer,  setSelectedAnswer]  = useState(null);
  const [quizLoading,     setQuizLoading]     = useState(false);
  const [feedback,        setFeedback]        = useState(null);

  const fileInputRef = useRef(null);

  const handleFileUpload = async (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setIsProcessing(true);
    setSummary(''); setAudioSummary(null);
    setProcessingMsg(uploadedFile.name.match(/\.(mp4|mp3|wav|m4a)$/i)
      ? 'Uploading and transcribing media — this may take up to 60s...'
      : 'Processing document...');
    try {
      const formData = new FormData();
      formData.append('document', uploadedFile);
      formData.append('session_id', SESSION_ID);
      formData.append('language', globalLanguage);
      const res = await axios.post(`${API_URL}/api/upload-material`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000
      });
      setSummary(res.data.summary);
      setAudioSummary(res.data.audio_summary || null);
      setContentTitle(res.data.title || uploadedFile.name);
    } catch (err) {
      setSummary(err.response?.data?.error || 'An error occurred processing the file.');
    } finally { setIsProcessing(false); }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setIsProcessing(true); setSummary(''); setAudioSummary(null);
    setProcessingMsg('Downloading audio from URL — this may take 1-2 minutes...');
    try {
      const res = await axios.post(`${API_URL}/api/process-url`, {
        url: urlInput.trim(), session_id: SESSION_ID, language: globalLanguage,
      }, { timeout: 360000 });
      setSummary(res.data.summary);
      setAudioSummary(res.data.audio_summary || null);
      setContentTitle(res.data.title || urlInput);
    } catch (err) {
      setSummary(err.response?.data?.error || 'Failed to process URL.');
    } finally { setIsProcessing(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileUpload(f);
  };

  const handleChat = async () => {
    if (!query.trim()) return;
    const newLog = [...chatLog, { sender: 'Student', text: query, audio: null }];
    setChatLog(newLog); setQuery(''); setIsTyping(true);
    try {
      const res = await axios.post(`${API_URL}/api/chat`, { query, language: globalLanguage, session_id: SESSION_ID });
      setChatLog([...newLog, { sender: 'AI', text: res.data.response, audio: res.data.audio_response || null }]);
    } catch (err) {
      setChatLog([...newLog, { sender: 'System', text: err.response?.data?.error || 'Error connecting to tutor.', audio: null }]);
    } finally { setIsTyping(false); }
  };

  const loadQuiz = async () => {
    setQuizLoading(true); setQuizStarted(true); setSelectedAnswer(null); setFeedback(null);
    try {
      const res = await axios.post(`${API_URL}/api/quiz`, { session_id: SESSION_ID });
      setQuizData(res.data.assessment);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load quiz.');
      setQuizStarted(false);
    } finally { setQuizLoading(false); }
  };

  const handleQuizSubmit = () => {
    const correct = selectedAnswer === quizData.answer;
    setFeedback({
      correct,
      text: correct
        ? `Correct! ${quizData.explanation || ''}`
        : `Incorrect. The correct answer is: ${quizData.options[quizData.answer]}. ${quizData.explanation || ''}`
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* Header */}
      <header className="bg-white shadow-md border-b-4 border-orange-600 p-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-bold text-orange-600 tracking-wide">AI Ed-Tech Platform</h1>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 font-medium">Language:</label>
            <select value={globalLanguage} onChange={e => setGlobalLanguage(e.target.value)}
              className="border border-gray-300 py-1.5 px-3 rounded-lg text-sm">
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
            <div className="text-xs text-gray-400 hidden sm:block">Team 22BCE0549 & 22BCT0102</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-4">

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b-2 border-gray-200 pb-2">
          {[['processing','01 Processing'],['tutor','02 Tutor'],['assessment','03 Assessment'],['suggestions','04 Suggestions']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 font-semibold rounded-t-lg text-sm transition-colors
                ${activeTab === key ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 text-gray-600 hover:bg-orange-100'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 min-h-[500px]">

          {/* MODULE 1 */}
          {activeTab === 'processing' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">Content Ingestion & Analysis</h2>
              <p className="text-gray-500 text-sm mb-4">Upload a file or paste a YouTube URL for AI-powered key-point summaries.</p>

              <div className="flex gap-2 mb-4">
                {[['file','Upload file'],['url','YouTube / URL']].map(([mode, label]) => (
                  <button key={mode} onClick={() => setInputMode(mode)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg border transition
                      ${inputMode === mode ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-orange-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {inputMode === 'file' && (
                <div className="border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl p-10 text-center cursor-pointer hover:bg-orange-100 transition mb-4"
                  onClick={() => fileInputRef.current.click()}
                  onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
                  <input type="file" className="hidden" ref={fileInputRef}
                    onChange={e => handleFileUpload(e.target.files[0])} accept={ACCEPTED_FILES} />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileBadge name={file.name} />
                      <p className="text-gray-700 font-semibold text-sm">{file.name}</p>
                      <p className="text-xs text-gray-400">Click to change</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-gray-700">Drag & drop or click to upload</p>
                      <p className="text-sm text-gray-400 mt-1">PDF · DOCX · MP3 · MP4 · WAV · M4A</p>
                    </>
                  )}
                </div>
              )}

              {inputMode === 'url' && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    <button onClick={handleUrlSubmit} disabled={isProcessing || !urlInput.trim()}
                      className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                      Analyse
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Supports YouTube, Vimeo, and 1000+ sites via yt-dlp. Requires ffmpeg.</p>
                </div>
              )}

              {isProcessing && <div className="text-center text-orange-600 font-medium animate-pulse text-sm py-4">{processingMsg}</div>}

              {summary && !isProcessing && (
                <div className="mt-4 p-5 bg-gray-50 border-l-4 border-orange-600 rounded-r-lg">
                  {contentTitle && <p className="text-xs text-gray-400 mb-2 font-medium">📄 {contentTitle}</p>}
                  <h3 className="text-base font-bold text-gray-800 mb-3">
                    Summary <span className="text-xs font-normal text-gray-400">({globalLanguage})</span>
                  </h3>
                  <SummaryBlock text={summary} />
                  <AudioPlayer base64Audio={audioSummary} label="Listen to summary" />
                </div>
              )}
            </div>
          )}

          {/* MODULE 2 */}
          {activeTab === 'tutor' && (
            <div className="flex flex-col h-[520px]">
              <div className="mb-3">
                <h2 className="text-xl font-bold text-gray-800">AI Tutor</h2>
                <p className="text-xs text-gray-400">
                  {contentTitle ? `Context: ${contentTitle}` : 'No content uploaded yet'} ·
                  Responding in <span className="text-orange-600 font-semibold">{globalLanguage}</span>
                </p>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-y-auto mb-3">
                {chatLog.map((msg, i) => (
                  <div key={i} className={`mb-4 flex ${msg.sender === 'Student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] p-3.5 rounded-2xl text-sm leading-relaxed
                      ${msg.sender === 'Student'
                        ? 'bg-orange-600 text-white rounded-br-none'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'}`}>
                      <p className="text-xs font-bold mb-1 opacity-60">{msg.sender}</p>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.sender === 'AI' && <AudioPlayer base64Audio={msg.audio} label="Listen" />}
                    </div>
                  </div>
                ))}
                {isTyping && <p className="text-gray-400 italic text-xs">AI is typing...</p>}
              </div>
              <div className="flex gap-2">
                <input type="text" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChat()}
                  placeholder={`Ask a question in ${globalLanguage}...`}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm" />
                <button onClick={handleChat} disabled={isTyping}
                  className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">Send</button>
              </div>
            </div>
          )}

          {/* MODULE 3 */}
          {activeTab === 'assessment' && (
            <div className="text-center py-6">
              {!quizStarted || (!quizData && !quizLoading) ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">Adaptive Knowledge Check</h2>
                  <p className="text-gray-500 text-sm mb-2">Quiz auto-generated from your uploaded content.</p>
                  {!contentTitle && <p className="text-orange-500 text-xs mb-6">Upload content first in the Processing tab.</p>}
                  {contentTitle && <p className="text-gray-400 text-xs mb-6">Content: {contentTitle}</p>}
                  <button onClick={loadQuiz}
                    className="bg-orange-600 text-white text-base px-8 py-3 rounded-xl font-bold">Generate Quiz</button>
                </>
              ) : quizLoading ? (
                <p className="text-orange-600 animate-pulse text-lg font-bold mt-10">Crafting your question...</p>
              ) : (
                <div className="max-w-2xl mx-auto text-left">
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase">{quizData.topic}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded
                      ${quizData.difficulty === 'Advanced' ? 'bg-red-100 text-red-700' :
                        quizData.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {quizData.difficulty}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-5 leading-snug">{quizData.question}</h3>
                  <div className="space-y-2.5 mb-5">
                    {quizData.options.map((opt, i) => (
                      <button key={i} onClick={() => !feedback && setSelectedAnswer(i)} disabled={!!feedback}
                        className={`w-full text-left p-3.5 rounded-lg border-2 transition-all text-sm
                          ${feedback
                            ? i === quizData.answer ? 'border-green-500 bg-green-50 text-green-800 font-semibold'
                              : i === selectedAnswer ? 'border-red-400 bg-red-50 text-red-700'
                              : 'border-gray-200 text-gray-400'
                            : selectedAnswer === i ? 'border-orange-600 bg-orange-50 font-semibold'
                            : 'border-gray-200 hover:bg-gray-50'}`}>
                        <span className="font-bold mr-2 text-gray-500">{String.fromCharCode(65 + i)}.</span>{opt}
                      </button>
                    ))}
                  </div>
                  {feedback && (
                    <div className={`p-4 rounded-lg text-sm font-medium mb-4 ${feedback.correct ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                      {feedback.correct ? '✓ ' : '✗ '}{feedback.text}
                    </div>
                  )}
                  <div className="flex gap-3">
                    {!feedback
                      ? <button onClick={handleQuizSubmit} disabled={selectedAnswer === null}
                          className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold text-sm disabled:opacity-40">Submit Answer</button>
                      : <button onClick={loadQuiz}
                          className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold text-sm">Next Question →</button>
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUGGESTIONS */}
          {activeTab === 'suggestions' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">Feature suggestions</h2>
              <p className="text-gray-500 text-sm mb-5">Ideas to expand this platform beyond the hackathon scope.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SUGGESTIONS.map((s, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:bg-orange-50 transition">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{s.icon}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-gray-800">{s.title}</p>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s.tag}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}