import React, { useState, useRef } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5002';
const SESSION_ID = 'session_' + Math.random().toString(36).slice(2, 9);

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'Mandarin', 'Kannada', 'Tamil', 'Telugu', 'Arabic'];

const ACCEPTED_FILES = '.pdf,.docx,.doc,.mp3,.mp4,.wav,.m4a';

function AudioPlayer({ base64Audio, label = "Listen" }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  if (!base64Audio) return null;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-3 mt-3">
      <audio
        ref={audioRef}
        src={`data:audio/wav;base64,${base64Audio}`}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className="flex items-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-800 text-sm font-semibold px-4 py-2 rounded-full transition"
      >
        <span>{playing ? '⏸' : '▶'}</span>
        <span>{playing ? 'Pause' : label}</span>
      </button>
    </div>
  );
}

function FileTypeIcon({ filename }) {
  if (!filename) return null;
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    pdf: { label: 'PDF', color: 'bg-red-100 text-red-700' },
    docx: { label: 'DOCX', color: 'bg-blue-100 text-blue-700' },
    doc: { label: 'DOC', color: 'bg-blue-100 text-blue-700' },
    mp3: { label: 'MP3', color: 'bg-purple-100 text-purple-700' },
    mp4: { label: 'MP4', color: 'bg-green-100 text-green-700' },
    wav: { label: 'WAV', color: 'bg-purple-100 text-purple-700' },
    m4a: { label: 'M4A', color: 'bg-purple-100 text-purple-700' },
  };
  const info = map[ext] || { label: ext.toUpperCase(), color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded ${info.color}`}>{info.label}</span>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('processing');
  const [globalLanguage, setGlobalLanguage] = useState('English');

  // Module 1
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [audioSummary, setAudioSummary] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Module 2
  const [chatLog, setChatLog] = useState([{ sender: 'AI', text: 'Hello! Upload a document or media file, then ask me anything about it.', audio: null }]);
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Module 3
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);
    setSummary('');
    setAudioSummary(null);

    try {
      const formData = new FormData();
      formData.append('document', uploadedFile);
      formData.append('session_id', SESSION_ID);
      formData.append('language', globalLanguage);

      const res = await axios.post(`${API_URL}/api/upload-material`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummary(res.data.summary);
      setAudioSummary(res.data.audio_summary || null);
    } catch (error) {
      setSummary(error.response?.data?.error || "An error occurred processing the file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      fileInputRef.current.files = e.dataTransfer.files;
      handleFileUpload({ target: { files: [droppedFile] } });
    }
  };

  const handleChat = async () => {
    if (!query.trim()) return;

    const newLog = [...chatLog, { sender: 'Student', text: query, audio: null }];
    setChatLog(newLog);
    setQuery('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        query,
        language: globalLanguage,
        session_id: SESSION_ID,
      });
      setChatLog([...newLog, {
        sender: 'AI',
        text: res.data.response,
        audio: res.data.audio_response || null
      }]);
    } catch (error) {
      setChatLog([...newLog, { sender: 'System', text: error.response?.data?.error || "Error connecting to AI Tutor.", audio: null }]);
    } finally {
      setIsTyping(false);
    }
  };

  const loadQuiz = async () => {
    setQuizLoading(true);
    setQuizStarted(true);
    setSelectedAnswer(null);
    setFeedback(null);

    try {
      const res = await axios.post(`${API_URL}/api/quiz`, { session_id: SESSION_ID });
      setQuizData(res.data.assessment);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to load quiz.");
      setQuizStarted(false);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizSubmit = () => {
    if (selectedAnswer === quizData.answer) {
      setFeedback({ correct: true, text: "Correct! Well done." });
    } else {
      setFeedback({ correct: false, text: `Incorrect. The correct answer was: ${quizData.options[quizData.answer]}` });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <header className="bg-white shadow-md border-b-4 border-orange-600 p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-orange-600 tracking-wide">AI Ed-Tech Platform</h1>
          <div className="flex items-center gap-4">
            {/* Global language selector — affects all 3 modules */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">Language:</span>
              <select
                value={globalLanguage}
                onChange={(e) => setGlobalLanguage(e.target.value)}
                className="border border-gray-300 py-1.5 px-3 rounded-lg text-sm"
              >
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="text-sm text-gray-500 font-medium">Capstone Project • Team 22BCE0549 & 22BCT0102</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-6">
        <div className="flex space-x-2 mb-8 border-b-2 border-gray-200 pb-2">
          {['processing', 'tutor', 'assessment'].map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold rounded-t-lg transition-colors capitalize ${activeTab === tab ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 text-gray-600 hover:bg-orange-100'}`}
            >
              0{idx + 1} {tab}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100 min-h-[500px]">

          {/* MODULE 1: Processing */}
          {activeTab === 'processing' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Content Ingestion & Analysis</h2>
              <p className="text-gray-500 mb-2 text-sm">Supports PDF, DOCX, MP3, MP4, WAV — summaries in any language with audio playback.</p>

              {/* Supported formats pill row */}
              <div className="flex gap-2 flex-wrap mb-6">
                {['PDF', 'DOCX', 'MP3', 'MP4', 'WAV', 'M4A'].map(f => (
                  <span key={f} className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded">{f}</span>
                ))}
              </div>

              <div
                className="border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl p-12 text-center cursor-pointer hover:bg-orange-100 transition"
                onClick={() => fileInputRef.current.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept={ACCEPTED_FILES} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileTypeIcon filename={file.name} />
                    <p className="text-gray-700 font-semibold">{file.name}</p>
                    <p className="text-xs text-gray-400">Click to change file</p>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-gray-700">Drag & Drop or Click to Upload</p>
                    <p className="text-sm text-gray-500 mt-2">PDF · DOCX · MP3 · MP4 · WAV · M4A</p>
                  </>
                )}
              </div>

              {isProcessing && (
                <div className="mt-8 text-center text-orange-600 font-medium animate-pulse">
                  {file?.name?.match(/\.(mp4|mp3|wav|m4a)$/i) ? 'Transcribing and analysing media...' : 'Processing document...'}
                </div>
              )}

              {summary && !isProcessing && (
                <div className="mt-8 p-6 bg-gray-50 border-l-4 border-orange-600 rounded-r-lg">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Automated Summary <span className="text-sm font-normal text-gray-500">({globalLanguage})</span></h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                  <AudioPlayer base64Audio={audioSummary} label="Listen to summary" />
                </div>
              )}
            </div>
          )}

          {/* MODULE 2: Tutor */}
          {activeTab === 'tutor' && (
            <div className="flex flex-col h-[520px]">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">AI Tutor</h2>
                  <p className="text-sm text-gray-500">Responding in: <span className="font-semibold text-orange-600">{globalLanguage}</span></p>
                </div>
              </div>

              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-y-auto mb-4">
                {chatLog.map((msg, idx) => (
                  <div key={idx} className={`mb-4 flex ${msg.sender === 'Student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-4 rounded-2xl ${msg.sender === 'Student' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'}`}>
                      <p className="text-xs font-bold mb-1 opacity-70">{msg.sender}</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                      {msg.sender === 'AI' && <AudioPlayer base64Audio={msg.audio} label="Listen" />}
                    </div>
                  </div>
                ))}
                {isTyping && <p className="text-gray-400 italic text-sm">AI is typing...</p>}
              </div>

              <div className="flex gap-2">
                <input
                  type="text" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder={`Ask a question in ${globalLanguage}...`}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm"
                />
                <button onClick={handleChat} disabled={isTyping} className="bg-orange-600 text-white px-8 py-3 rounded-lg font-bold text-sm">Send</button>
              </div>
            </div>
          )}

          {/* MODULE 3: Assessment */}
          {activeTab === 'assessment' && (
            <div className="text-center py-8">
              {!quizStarted || (!quizData && !quizLoading) ? (
                <>
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">Adaptive Knowledge Check</h2>
                  <p className="text-gray-600 mb-2">Quiz generated from your uploaded content.</p>
                  <p className="text-sm text-gray-400 mb-8">Upload a PDF, DOCX, MP3, or MP4 first.</p>
                  <button onClick={loadQuiz} className="bg-orange-600 text-white text-lg px-8 py-4 rounded-xl font-bold">Generate Quiz</button>
                </>
              ) : quizLoading ? (
                <p className="text-orange-600 animate-pulse text-xl font-bold mt-10">Crafting your question...</p>
              ) : (
                <div className="max-w-3xl mx-auto text-left">
                  <div className="flex justify-between items-center mb-6">
                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase">{quizData.topic}</span>
                    <span className="text-gray-500 font-medium text-sm">Difficulty: {quizData.difficulty}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">{quizData.question}</h3>

                  <div className="space-y-3">
                    {quizData.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => !feedback && setSelectedAnswer(i)}
                        disabled={!!feedback}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all text-sm
                          ${feedback
                            ? i === quizData.answer
                              ? 'border-green-500 bg-green-50 text-green-800 font-semibold'
                              : i === selectedAnswer
                                ? 'border-red-400 bg-red-50 text-red-700'
                                : 'border-gray-200 text-gray-500'
                            : selectedAnswer === i
                              ? 'border-orange-600 bg-orange-50 font-semibold'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                      </button>
                    ))}
                  </div>

                  {feedback && (
                    <div className={`mt-6 p-4 rounded-lg font-bold text-sm ${feedback.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {feedback.text}
                    </div>
                  )}

                  <div className="mt-8 flex gap-4">
                    {!feedback ? (
                      <button onClick={handleQuizSubmit} disabled={selectedAnswer === null} className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 text-sm">Submit Answer</button>
                    ) : (
                      <button onClick={loadQuiz} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold text-sm">Next Question</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}