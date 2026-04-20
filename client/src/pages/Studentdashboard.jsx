import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth, API } from '../AuthContext'

const AI_URL    = 'http://localhost:5002'
const LANGUAGES = ['English','Hindi','Spanish','French','Mandarin','Kannada','Tamil','Telugu','Arabic']
const SESSION_ID = 'student_' + Math.random().toString(36).slice(2,9)

function AudioPlayer({ base64Audio, label='Listen' }) {
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
        className="flex items-center gap-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-semibold px-3 py-1.5 rounded-full transition">
        {playing ? '⏸ Pause' : '▶ ' + label}
      </button>
    </div>
  )
}

function SummaryBlock({ text }) {
  if (!text) return null
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <h3 key={i} className="text-sm font-bold text-gray-800 mt-3 mb-1 border-b border-orange-200 pb-1">{line.replace('## ','')}</h3>
        if (line.match(/^[-*•]\s/))
          return <p key={i} className="text-xs text-gray-700 pl-3 flex gap-1.5"><span className="text-orange-400">▸</span><span>{line.replace(/^[-*•]\s/,'')}</span></p>
        if (line.trim())
          return <p key={i} className="text-xs text-gray-600 leading-relaxed">{line}</p>
        return <div key={i} className="h-1" />
      })}
    </div>
  )
}

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('lectures')
  const [language, setLanguage] = useState('English')

  // Lectures
  const [lectures,       setLectures]       = useState([])
  const [activeLecture,  setActiveLecture]  = useState(null)
  const [lectureLoading, setLectureLoading] = useState(false)

  // Tutor
  const [chatLog,   setChatLog]   = useState([{ sender:'AI', text:'Hello! Open a lecture, then ask me anything.', audio:null }])
  const [query,     setQuery]     = useState('')
  const [isTyping,  setIsTyping]  = useState(false)

  // Quiz
  const [quizData,        setQuizData]        = useState(null)
  const [selectedAnswer,  setSelectedAnswer]  = useState(null)
  const [quizLoading,     setQuizLoading]     = useState(false)
  const [feedback,        setFeedback]        = useState(null)
  const [quizStarted,     setQuizStarted]     = useState(false)

  useEffect(() => { fetchLectures() }, [])

  const fetchLectures = async () => {
    const r = await axios.get(`${API}/lectures`)
    setLectures(r.data)
  }

  const openLecture = async (lecture) => {
    setLectureLoading(true)
    setActiveLecture(lecture)
    try {
      // Load lecture context into AI session
      await axios.post(`${API}/lectures/${lecture._id}/load`, { session_id: SESSION_ID })
      setTab('tutor')
      setChatLog([{ sender:'AI', text:`Lecture "${lecture.title}" is now loaded. Ask me anything about it!`, audio:null }])
      setQuizStarted(false); setQuizData(null); setFeedback(null)
    } catch(e) {
      alert('Failed to load lecture context')
    } finally {
      setLectureLoading(false)
    }
  }

  const handleChat = async () => {
    if (!query.trim()) return
    const newLog = [...chatLog, { sender:'Student', text:query, audio:null }]
    setChatLog(newLog); setQuery(''); setIsTyping(true)
    try {
      const r = await axios.post(`${AI_URL}/api/chat`, { query, language, session_id: SESSION_ID })
      setChatLog([...newLog, { sender:'AI', text:r.data.response, audio:r.data.audio_response||null }])
    } catch(e) {
      setChatLog([...newLog, { sender:'System', text:e.response?.data?.error||'Error', audio:null }])
    } finally { setIsTyping(false) }
  }

  const loadQuiz = async () => {
    setQuizLoading(true); setQuizStarted(true); setSelectedAnswer(null); setFeedback(null)
    try {
      const r = await axios.post(`${AI_URL}/api/quiz`, { session_id: SESSION_ID })
      setQuizData(r.data.assessment)
    } catch(e) {
      alert(e.response?.data?.error || 'Failed to generate quiz')
      setQuizStarted(false)
    } finally { setQuizLoading(false) }
  }

  const submitQuiz = async () => {
    const correct = selectedAnswer === quizData.answer
    setFeedback({ correct, text: correct
      ? `Correct! ${quizData.explanation||''}`
      : `Incorrect. Answer: ${quizData.options[quizData.answer]}. ${quizData.explanation||''}`
    })
    // Save to history
    try {
      await axios.patch(`${API}/auth/quiz-result`, {
        topic: quizData.topic, score: correct ? 1 : 0, difficulty: quizData.difficulty
      })
    } catch(e) {}
  }

  const BADGE = { pdf:'bg-red-100 text-red-700', docx:'bg-blue-100 text-blue-700',
                  mp3:'bg-purple-100 text-purple-700', mp4:'bg-green-100 text-green-700',
                  url:'bg-orange-100 text-orange-700' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b-4 border-orange-600 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center text-orange-700 text-xs font-bold">
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">{user.name}</p>
            <p className="text-xs text-gray-400">Student</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Language:</span>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-600 border border-gray-200 px-3 py-1.5 rounded-lg">Sign out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-5">
        {/* Active lecture pill */}
        {activeLecture && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm">
            <span className="text-orange-500">📖</span>
            <span className="font-semibold text-orange-800">{activeLecture.title}</span>
            <span className="text-orange-400 text-xs">by {activeLecture.teacher?.name}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-5 border-b border-gray-200 pb-3">
          {[['lectures','📚 Lectures'],['tutor','🤖 AI Tutor'],['assessment','📝 Quiz']].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition
                ${tab===key ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-orange-50'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-100 p-5 min-h-[460px]">

          {/* LECTURES */}
          {tab === 'lectures' && (
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-4">Available lectures</h2>
              {lectures.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm">No lectures available yet</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {lectures.map(l => (
                    <div key={l._id}
                      className="border border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:bg-orange-50 transition cursor-pointer"
                      onClick={() => openLecture(l)}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${BADGE[l.fileType||l.sourceType]||'bg-gray-100 text-gray-600'}`}>
                            {(l.fileType||l.sourceType||'file').toUpperCase()}
                          </span>
                          <h3 className="font-semibold text-sm text-gray-800">{l.title}</h3>
                        </div>
                      </div>
                      {l.description && <p className="text-xs text-gray-400 mb-2">{l.description}</p>}
                      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                        <span>👤 {l.teacher?.name}</span>
                        <span className="text-orange-600 font-semibold">Open →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {lectureLoading && <p className="text-orange-600 text-sm animate-pulse text-center mt-4">Loading lecture context...</p>}
            </div>
          )}

          {/* TUTOR */}
          {tab === 'tutor' && (
            <div className="flex flex-col h-[440px]">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-y-auto mb-3">
                {chatLog.map((msg, i) => (
                  <div key={i} className={`mb-3 flex ${msg.sender==='Student'?'justify-end':'justify-start'}`}>
                    <div className={`max-w-[78%] p-3 rounded-2xl text-xs leading-relaxed
                      ${msg.sender==='Student'
                        ? 'bg-orange-600 text-white rounded-br-none'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'}`}>
                      <p className="font-bold mb-1 opacity-60 text-xs">{msg.sender}</p>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.sender==='AI' && <AudioPlayer base64Audio={msg.audio} label="Listen" />}
                    </div>
                  </div>
                ))}
                {isTyping && <p className="text-gray-400 italic text-xs">AI is thinking...</p>}
              </div>
              <div className="flex gap-2">
                <input type="text" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleChat()}
                  placeholder={!activeLecture ? 'Open a lecture first...' : `Ask in ${language}...`}
                  disabled={!activeLecture}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm disabled:bg-gray-50" />
                <button onClick={handleChat} disabled={isTyping || !activeLecture}
                  className="bg-orange-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-40">
                  Send
                </button>
              </div>
            </div>
          )}

          {/* QUIZ */}
          {tab === 'assessment' && (
            <div className="text-center py-4">
              {!quizStarted || (!quizData && !quizLoading) ? (
                <>
                  <p className="text-3xl mb-3">🧠</p>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">Adaptive Quiz</h2>
                  <p className="text-xs text-gray-400 mb-1">Questions generated from the open lecture.</p>
                  {!activeLecture && <p className="text-orange-500 text-xs mb-4">Open a lecture first from the Lectures tab.</p>}
                  {activeLecture  && <p className="text-gray-400 text-xs mb-4">Lecture: {activeLecture.title}</p>}
                  <button onClick={loadQuiz} disabled={!activeLecture}
                    className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-40">
                    Generate Quiz
                  </button>
                </>
              ) : quizLoading ? (
                <p className="text-orange-600 animate-pulse text-base font-bold mt-10">Crafting your question...</p>
              ) : (
                <div className="max-w-2xl mx-auto text-left">
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase">{quizData.topic}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded
                      ${quizData.difficulty==='Advanced'?'bg-red-100 text-red-700':
                        quizData.difficulty==='Intermediate'?'bg-yellow-100 text-yellow-700':'bg-green-100 text-green-700'}`}>
                      {quizData.difficulty}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-4">{quizData.question}</h3>
                  <div className="space-y-2 mb-4">
                    {quizData.options.map((opt, i) => (
                      <button key={i} onClick={() => !feedback && setSelectedAnswer(i)} disabled={!!feedback}
                        className={`w-full text-left p-3 rounded-lg border-2 text-sm transition
                          ${feedback
                            ? i===quizData.answer ? 'border-green-500 bg-green-50 text-green-800 font-semibold'
                              : i===selectedAnswer ? 'border-red-400 bg-red-50 text-red-700'
                              : 'border-gray-200 text-gray-400'
                            : selectedAnswer===i ? 'border-orange-600 bg-orange-50 font-semibold'
                            : 'border-gray-200 hover:bg-gray-50'}`}>
                        <span className="font-bold mr-2 text-gray-400">{String.fromCharCode(65+i)}.</span>{opt}
                      </button>
                    ))}
                  </div>
                  {feedback && (
                    <div className={`p-3 rounded-lg text-xs font-medium mb-4 ${feedback.correct?'bg-green-50 text-green-800 border border-green-200':'bg-red-50 text-red-800 border border-red-200'}`}>
                      {feedback.correct?'✓ ':'✗ '}{feedback.text}
                    </div>
                  )}
                  <div className="flex gap-3">
                    {!feedback
                      ? <button onClick={submitQuiz} disabled={selectedAnswer===null}
                          className="bg-orange-600 text-white px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-40">Submit</button>
                      : <button onClick={loadQuiz}
                          className="bg-gray-800 text-white px-5 py-2 rounded-lg font-bold text-sm">Next →</button>
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}