import React, { useState, useRef } from 'react'
import axios from 'axios'
import { useAuth } from './AuthContext'

const API_URL  = 'http://localhost:5002'
const LANGUAGES = ['English','Hindi','Spanish','French','Mandarin','Kannada','Tamil','Telugu','Arabic','German','Japanese']
const ACCEPTED_FILES = '.pdf,.docx,.doc,.mp3,.mp4,.wav,.m4a'
const SESSION_ID = 'session_' + Math.random().toString(36).slice(2, 9)

// ── Audio player ─────────────────────────────────────────────────────────────
function AudioPlayer({ base64Audio, label = 'Listen' }) {
  const [playing, setPlaying] = useState(false)
  const ref = useRef(null)
  if (!base64Audio) return null
  const toggle = () => {
    const a = ref.current
    if (playing) { a.pause(); setPlaying(false) }
    else         { a.play();  setPlaying(true)  }
  }
  return (
    <div className="flex items-center gap-2 mt-2">
      <audio ref={ref} src={`data:audio/wav;base64,${base64Audio}`} onEnded={() => setPlaying(false)} />
      <button onClick={toggle}
        className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-semibold px-3 py-1.5 rounded-full transition">
        {playing ? '⏸ Pause' : `▶ ${label}`}
      </button>
    </div>
  )
}

// ── File badge ────────────────────────────────────────────────────────────────
function FileBadge({ name }) {
  if (!name) return null
  const ext = name.split('.').pop().toLowerCase()
  const s = { pdf:'bg-red-100 text-red-700', docx:'bg-blue-100 text-blue-700', doc:'bg-blue-100 text-blue-700',
              mp3:'bg-purple-100 text-purple-700', mp4:'bg-green-100 text-green-700',
              wav:'bg-purple-100 text-purple-700', m4a:'bg-purple-100 text-purple-700' }
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${s[ext]||'bg-gray-100 text-gray-600'}`}>{ext.toUpperCase()}</span>
}

// ── Markdown summary renderer ─────────────────────────────────────────────────
function SummaryBlock({ text }) {
  if (!text) return null
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <h3 key={i} className="text-sm font-bold text-gray-800 mt-4 mb-1 border-b border-orange-200 pb-1">{line.replace('## ','')}</h3>
        if (line.match(/^[-*•]\s/))
          return <p key={i} className="text-sm text-gray-700 pl-3 flex gap-2"><span className="text-orange-500">▸</span><span>{line.replace(/^[-*•]\s/,'')}</span></p>
        if (line.trim())
          return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>
        return <div key={i} className="h-1" />
      })}
    </div>
  )
}

// ── Progress Tracker ──────────────────────────────────────────────────────────
function ProgressTracker({ user }) {
  const history = user?.quizHistory || []

  if (history.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📊</p>
        <p className="font-semibold text-gray-600">No quiz attempts yet</p>
        <p className="text-sm text-gray-400 mt-1">Complete a quiz to see your progress here.</p>
      </div>
    )
  }

  const total    = history.length
  const correct  = history.filter(h => h.score === 1).length
  const accuracy = Math.round((correct / total) * 100)

  // Group by topic
  const byTopic = {}
  history.forEach(h => {
    if (!byTopic[h.topic]) byTopic[h.topic] = { correct: 0, total: 0 }
    byTopic[h.topic].total++
    if (h.score === 1) byTopic[h.topic].correct++
  })

  // Group by difficulty
  const byDiff = { Beginner: { c:0, t:0 }, Intermediate: { c:0, t:0 }, Advanced: { c:0, t:0 } }
  history.forEach(h => {
    const d = h.difficulty || 'Intermediate'
    if (byDiff[d]) { byDiff[d].t++; if (h.score===1) byDiff[d].c++ }
  })

  // Recent 10 attempts for timeline
  const recent = [...history].reverse().slice(0, 10)

  const diffColor = { Beginner:'bg-green-100 text-green-700', Intermediate:'bg-yellow-100 text-yellow-700', Advanced:'bg-red-100 text-red-700' }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total questions', value: total, color: 'text-gray-800' },
          { label: 'Correct answers', value: correct, color: 'text-green-700' },
          { label: 'Accuracy',        value: `${accuracy}%`, color: accuracy>=70?'text-green-700':accuracy>=40?'text-yellow-600':'text-red-600' },
        ].map((c,i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Accuracy bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Overall accuracy</span><span>{accuracy}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${accuracy>=70?'bg-green-500':accuracy>=40?'bg-yellow-400':'bg-red-400'}`}
            style={{width:`${accuracy}%`}} />
        </div>
      </div>

      {/* By difficulty */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance by difficulty</h3>
        <div className="space-y-2">
          {Object.entries(byDiff).map(([diff, { c, t }]) => {
            if (t === 0) return null
            const pct = Math.round((c/t)*100)
            return (
              <div key={diff} className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded w-24 text-center ${diffColor[diff]}`}>{diff}</span>
                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${diff==='Beginner'?'bg-green-500':diff==='Intermediate'?'bg-yellow-400':'bg-red-400'}`}
                    style={{width:`${pct}%`}} />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{c}/{t} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* By topic */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance by topic</h3>
        <div className="space-y-2">
          {Object.entries(byTopic).map(([topic, { correct: c, total: t }]) => {
            const pct = Math.round((c/t)*100)
            return (
              <div key={topic} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-32 truncate" title={topic}>{topic}</span>
                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full" style={{width:`${pct}%`}} />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{c}/{t} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent attempts */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent attempts</h3>
        <div className="space-y-1.5">
          {recent.map((h, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${h.score===1?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                  {h.score===1?'✓':'✗'}
                </span>
                <span className="text-xs text-gray-700 truncate max-w-[160px]">{h.topic}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${diffColor[h.difficulty]||'bg-gray-100 text-gray-500'}`}>{h.difficulty}</span>
                <span className="text-xs text-gray-400">{new Date(h.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App_Main() {
  const { user, logout, saveQuizResults } = useAuth()
  const [activeTab, setActiveTab]           = useState('processing')
  const [globalLanguage, setGlobalLanguage] = useState('English')

  // Module 1
  const [inputMode,     setInputMode]     = useState('file')
  const [file,          setFile]          = useState(null)
  const [urlInput,      setUrlInput]      = useState('')
  const [contentTitle,  setContentTitle]  = useState('')
  const [summary,       setSummary]       = useState('')
  const [audioSummary,  setAudioSummary]  = useState(null)
  const [isProcessing,  setIsProcessing]  = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')

  // Module 2
  const [chatLog,  setChatLog]  = useState([{ sender:'AI', text:'Hello! Upload a document or paste a YouTube link, then ask me anything.', audio:null }])
  const [query,    setQuery]    = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Module 3 — 5-question quiz
  const [quizStarted,    setQuizStarted]    = useState(false)
  const [questions,      setQuestions]      = useState([])   // all 5 questions
  const [currentQ,       setCurrentQ]       = useState(0)    // index
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [quizLoading,    setQuizLoading]    = useState(false)
  const [feedback,       setFeedback]       = useState(null)
  const [answers,        setAnswers]        = useState([])   // submitted answers
  const [quizComplete,   setQuizComplete]   = useState(false)
  const [quizScore,      setQuizScore]      = useState(0)

  const fileInputRef = useRef(null)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleFileUpload = async (uploadedFile) => {
    if (!uploadedFile) return
    setFile(uploadedFile); setIsProcessing(true); setSummary(''); setAudioSummary(null)
    setProcessingMsg(uploadedFile.name.match(/\.(mp4|mp3|wav|m4a)$/i)
      ? 'Uploading and transcribing media — this may take up to 60s...'
      : 'Processing document...')
    try {
      const formData = new FormData()
      formData.append('document', uploadedFile)
      formData.append('session_id', SESSION_ID)
      formData.append('language', globalLanguage)
      const res = await axios.post(`${API_URL}/api/upload-material`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000
      })
      setSummary(res.data.summary)
      setAudioSummary(res.data.audio_summary || null)
      setContentTitle(res.data.title || uploadedFile.name)
    } catch (err) {
      setSummary(err.response?.data?.error || 'An error occurred processing the file.')
    } finally { setIsProcessing(false) }
  }

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return
    setIsProcessing(true); setSummary(''); setAudioSummary(null)
    setProcessingMsg('Downloading audio from URL — this may take 1-2 minutes...')
    try {
      const res = await axios.post(`${API_URL}/api/process-url`, {
        url: urlInput.trim(), session_id: SESSION_ID, language: globalLanguage,
      }, { timeout: 360000 })
      setSummary(res.data.summary)
      setAudioSummary(res.data.audio_summary || null)
      setContentTitle(res.data.title || urlInput)
    } catch (err) {
      setSummary(err.response?.data?.error || 'Failed to process URL.')
    } finally { setIsProcessing(false) }
  }

  const handleChat = async () => {
    if (!query.trim()) return
    const newLog = [...chatLog, { sender:'Student', text:query, audio:null }]
    setChatLog(newLog); setQuery(''); setIsTyping(true)
    try {
      const res = await axios.post(`${API_URL}/api/chat`, { query, language:globalLanguage, session_id:SESSION_ID })
      setChatLog([...newLog, { sender:'AI', text:res.data.response, audio:res.data.audio_response||null }])
    } catch (err) {
      setChatLog([...newLog, { sender:'System', text:err.response?.data?.error||'Error connecting to tutor.', audio:null }])
    } finally { setIsTyping(false) }
  }

  const startQuiz = async () => {
    setQuizLoading(true); setQuizStarted(true)
    setCurrentQ(0); setAnswers([]); setFeedback(null)
    setSelectedAnswer(null); setQuizComplete(false); setQuizScore(0)
    try {
      const res = await axios.post(`${API_URL}/api/quiz`, { session_id:SESSION_ID, count:5 })
      setQuestions(res.data.questions)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load quiz.')
      setQuizStarted(false)
    } finally { setQuizLoading(false) }
  }

  const submitAnswer = async () => {
    const q = questions[currentQ]
    const correct = selectedAnswer === q.answer
    const newAnswers = [...answers, { question:q.question, topic:q.topic, difficulty:q.difficulty,
                                      selected:selectedAnswer, correct:q.answer, isCorrect:correct }]
    setFeedback({ correct, text: correct
      ? `Correct! ${q.explanation||''}`
      : `Incorrect. Answer: ${q.options[q.answer]}. ${q.explanation||''}` })
    setAnswers(newAnswers)

    // If last question, calculate score and save
    if (currentQ === questions.length - 1) {
      const score = newAnswers.filter(a => a.isCorrect).length
      setQuizScore(score)
      setQuizComplete(true)
      // Save each question result to progress tracker
      if (user) {
        await saveQuizResults(newAnswers.map(a => ({
          topic: a.topic, score: a.isCorrect ? 1 : 0, difficulty: a.difficulty
        })))
      }
    }
  }

  const nextQuestion = () => {
    setCurrentQ(q => q + 1)
    setSelectedAnswer(null)
    setFeedback(null)
  }

  const diffColor = (d) => d==='Advanced'?'bg-red-100 text-red-700':d==='Intermediate'?'bg-yellow-100 text-yellow-700':'bg-green-100 text-green-700'

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* Header */}
      <header className="bg-white shadow-md border-b-4 border-orange-600 p-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-bold text-orange-600 tracking-wide">AI Ed-Tech Platform</h1>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500">Language:</label>
            <select value={globalLanguage} onChange={e => setGlobalLanguage(e.target.value)}
              className="border border-gray-300 py-1.5 px-3 rounded-lg text-sm">
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
            {user && (
              <div className="flex items-center gap-2 ml-2">
                <div className="w-7 h-7 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center text-orange-700 text-xs font-bold">
                  {user.name[0].toUpperCase()}
                </div>
                <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
                <button onClick={logout}
                  className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 px-2.5 py-1.5 rounded-lg ml-1">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-4">

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b-2 border-gray-200 pb-2">
          {[
            ['processing','01 Processing'],
            ['tutor','02 Tutor'],
            ['assessment','03 Assessment'],
            ['progress','04 Progress'],
          ].map(([key,label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 font-semibold rounded-t-lg text-sm transition-colors
                ${activeTab===key ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 text-gray-600 hover:bg-orange-100'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 min-h-[500px]">

          {/* ── MODULE 1: Processing ── */}
          {activeTab === 'processing' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">Content Ingestion & Analysis</h2>
              <p className="text-gray-500 text-sm mb-4">Upload a file or paste a YouTube URL for AI-powered key-point summaries.</p>

              <div className="flex gap-2 mb-4">
                {[['file','Upload file'],['url','YouTube / URL']].map(([mode,label]) => (
                  <button key={mode} onClick={() => setInputMode(mode)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg border transition
                      ${inputMode===mode ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-orange-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {inputMode === 'file' && (
                <div className="border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl p-10 text-center cursor-pointer hover:bg-orange-100 transition mb-4"
                  onClick={() => fileInputRef.current.click()}
                  onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]) }}
                  onDragOver={e => e.preventDefault()}>
                  <input type="file" className="hidden" ref={fileInputRef}
                    onChange={e => handleFileUpload(e.target.files[0])} accept={ACCEPTED_FILES} />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileBadge name={file.name} />
                      <p className="text-sm font-semibold text-gray-700">{file.name}</p>
                      <p className="text-xs text-gray-400">Click to change</p>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-700">Drag & drop or click to upload</p>
                      <p className="text-sm text-gray-400 mt-1">PDF · DOCX · MP3 · MP4 · WAV · M4A</p>
                    </>
                  )}
                </div>
              )}

              {inputMode === 'url' && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && handleUrlSubmit()}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    <button onClick={handleUrlSubmit} disabled={isProcessing||!urlInput.trim()}
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
                  {contentTitle && <p className="text-xs text-gray-400 mb-2">📄 {contentTitle}</p>}
                  <h3 className="text-sm font-bold text-gray-800 mb-3">
                    Summary <span className="text-xs font-normal text-gray-400">({globalLanguage})</span>
                  </h3>
                  <SummaryBlock text={summary} />
                  <AudioPlayer base64Audio={audioSummary} label="Listen to summary" />
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 2: Tutor ── */}
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
                  <div key={i} className={`mb-4 flex ${msg.sender==='Student'?'justify-end':'justify-start'}`}>
                    <div className={`max-w-[78%] p-3.5 rounded-2xl text-sm leading-relaxed
                      ${msg.sender==='Student'
                        ?'bg-orange-600 text-white rounded-br-none'
                        :'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'}`}>
                      <p className="text-xs font-bold mb-1 opacity-60">{msg.sender}</p>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.sender==='AI' && <AudioPlayer base64Audio={msg.audio} label="Listen" />}
                    </div>
                  </div>
                ))}
                {isTyping && <p className="text-gray-400 italic text-xs">AI is typing...</p>}
              </div>
              <div className="flex gap-2">
                <input type="text" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleChat()}
                  placeholder={`Ask a question in ${globalLanguage}...`}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm" />
                <button onClick={handleChat} disabled={isTyping}
                  className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">Send</button>
              </div>
            </div>
          )}

          {/* ── MODULE 3: Assessment (5 questions) ── */}
          {activeTab === 'assessment' && (
            <div>
              {!quizStarted ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-4">🧠</p>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Adaptive Knowledge Check</h2>
                  <p className="text-gray-500 text-sm mb-2">5 questions generated from your uploaded content.</p>
                  {!contentTitle && <p className="text-orange-500 text-xs mb-6">Upload content first in the Processing tab.</p>}
                  {contentTitle && <p className="text-gray-400 text-xs mb-6">Content: {contentTitle}</p>}
                  <button onClick={startQuiz} disabled={!contentTitle}
                    className="bg-orange-600 text-white text-base px-10 py-3 rounded-xl font-bold disabled:opacity-40">
                    Start Quiz
                  </button>
                </div>

              ) : quizLoading ? (
                <div className="text-center py-16">
                  <p className="text-orange-600 animate-pulse text-lg font-bold">Generating 5 questions...</p>
                  <p className="text-gray-400 text-sm mt-2">This may take a few seconds</p>
                </div>

              ) : quizComplete ? (
                // Results screen
                <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-6">
                    <p className="text-5xl mb-3">{quizScore >= 4 ? '🏆' : quizScore >= 3 ? '👍' : '📚'}</p>
                    <h2 className="text-2xl font-bold text-gray-800 mb-1">Quiz Complete!</h2>
                    <p className="text-4xl font-bold text-orange-600">{quizScore} / {questions.length}</p>
                    <p className="text-gray-400 text-sm mt-1">{Math.round((quizScore/questions.length)*100)}% correct</p>
                  </div>

                  {/* Answer review */}
                  <div className="space-y-3 mb-6">
                    {answers.map((a, i) => (
                      <div key={i} className={`p-4 rounded-xl border ${a.isCorrect?'border-green-200 bg-green-50':'border-red-200 bg-red-50'}`}>
                        <div className="flex items-start gap-2">
                          <span className={`font-bold text-sm ${a.isCorrect?'text-green-700':'text-red-600'}`}>{a.isCorrect?'✓':'✗'}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800 mb-1">Q{i+1}. {a.question}</p>
                            <p className="text-xs text-gray-500">
                              Your answer: <span className={a.isCorrect?'text-green-700 font-semibold':'text-red-600 font-semibold'}>
                                {questions[i].options[a.selected]}
                              </span>
                              {!a.isCorrect && <span className="ml-2">· Correct: <span className="text-green-700 font-semibold">{questions[i].options[a.correct]}</span></span>}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${diffColor(a.difficulty)}`}>{a.difficulty}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button onClick={startQuiz}
                      className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold text-sm">
                      Try Again
                    </button>
                    <button onClick={() => setActiveTab('progress')}
                      className="bg-gray-800 text-white px-8 py-3 rounded-xl font-bold text-sm">
                      View Progress →
                    </button>
                  </div>
                </div>

              ) : questions.length > 0 && (
                // Question screen
                <div className="max-w-2xl mx-auto">
                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-sm font-semibold text-gray-600">Question {currentQ+1} of {questions.length}</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full transition-all"
                        style={{width:`${((currentQ)/questions.length)*100}%`}} />
                    </div>
                    <span className="text-sm text-gray-400">{answers.filter(a=>a.isCorrect).length} correct</span>
                  </div>

                  {/* Question */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
                      {questions[currentQ].topic}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${diffColor(questions[currentQ].difficulty)}`}>
                      {questions[currentQ].difficulty}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mb-5 leading-snug">{questions[currentQ].question}</h3>

                  <div className="space-y-2.5 mb-5">
                    {questions[currentQ].options.map((opt, i) => (
                      <button key={i} onClick={() => !feedback && setSelectedAnswer(i)} disabled={!!feedback}
                        className={`w-full text-left p-3.5 rounded-lg border-2 transition-all text-sm
                          ${feedback
                            ? i===questions[currentQ].answer ? 'border-green-500 bg-green-50 text-green-800 font-semibold'
                              : i===selectedAnswer ? 'border-red-400 bg-red-50 text-red-700'
                              : 'border-gray-200 text-gray-400'
                            : selectedAnswer===i ? 'border-orange-600 bg-orange-50 font-semibold'
                            : 'border-gray-200 hover:bg-gray-50'}`}>
                        <span className="font-bold mr-2 text-gray-400">{String.fromCharCode(65+i)}.</span>{opt}
                      </button>
                    ))}
                  </div>

                  {feedback && (
                    <div className={`p-4 rounded-lg text-sm font-medium mb-4 ${feedback.correct?'bg-green-50 text-green-800 border border-green-200':'bg-red-50 text-red-800 border border-red-200'}`}>
                      {feedback.correct?'✓ ':'✗ '}{feedback.text}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {!feedback ? (
                      <button onClick={submitAnswer} disabled={selectedAnswer===null}
                        className="bg-orange-600 text-white px-8 py-2.5 rounded-lg font-bold text-sm disabled:opacity-40">
                        Submit Answer
                      </button>
                    ) : currentQ < questions.length - 1 ? (
                      <button onClick={nextQuestion}
                        className="bg-gray-800 text-white px-8 py-2.5 rounded-lg font-bold text-sm">
                        Next Question →
                      </button>
                    ) : (
                      <button onClick={submitAnswer}
                        className="bg-orange-600 text-white px-8 py-2.5 rounded-lg font-bold text-sm"
                        style={{display:'none'}} />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODULE 4: Progress Tracker ── */}
          {activeTab === 'progress' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Progress Tracker</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {user ? `${user.name}'s performance history` : 'Sign in to track your progress'}
                  </p>
                </div>
                {user && (
                  <div className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg font-medium">
                    {user.quizHistory?.length || 0} attempts
                  </div>
                )}
              </div>
              {user
                ? <ProgressTracker user={user} />
                : (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-3xl mb-3">🔒</p>
                    <p className="font-medium">Sign in to track your progress</p>
                    <p className="text-sm mt-1">Your quiz history is saved to your account.</p>
                  </div>
                )
              }
            </div>
          )}

        </div>
      </main>
    </div>
  )
}