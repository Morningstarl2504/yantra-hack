import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth, API } from '../AuthContext'

const LANGUAGES = ['English','Hindi','Spanish','French','Mandarin','Kannada','Tamil','Telugu']

export default function TeacherDashboard() {
  const { user, logout }   = useAuth()
  const [lectures, setLectures] = useState([])
  const [tab,      setTab]      = useState('lectures')  // 'lectures' | 'upload'
  const [inputMode, setInputMode] = useState('file')
  const [language, setLanguage] = useState('English')
  const [form, setForm] = useState({ title:'', description:'', externalUrl:'' })
  const [file, setFile]         = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [error,    setError]    = useState('')
  const fileRef = useRef(null)

  useEffect(() => { fetchLectures() }, [])

  const fetchLectures = async () => {
    try {
      const r = await axios.get(`${API}/lectures`)
      setLectures(r.data)
    } catch(e) { console.error(e) }
  }

  const handleUpload = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setError(''); setUploading(true)
    setUploadMsg(inputMode === 'file' ? 'Processing file — may take up to 60s...' : 'Downloading and analysing URL — may take 1-2 min...')
    try {
      const formData = new FormData()
      formData.append('title',       form.title)
      formData.append('description', form.description)
      formData.append('language',    language)
      if (inputMode === 'file' && file) {
        formData.append('file', file)
      } else {
        formData.append('externalUrl', form.externalUrl)
      }
      await axios.post(`${API}/lectures`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 400000
      })
      setForm({ title:'', description:'', externalUrl:'' })
      setFile(null)
      setUploadMsg('')
      setTab('lectures')
      fetchLectures()
    } catch(e) {
      setError(e.response?.data?.error || 'Upload failed')
      setUploadMsg('')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this lecture?')) return
    await axios.delete(`${API}/lectures/${id}`)
    fetchLectures()
  }

  const BADGE = { pdf:'bg-red-100 text-red-700', docx:'bg-blue-100 text-blue-700',
                  mp3:'bg-purple-100 text-purple-700', mp4:'bg-green-100 text-green-700',
                  url:'bg-orange-100 text-orange-700' }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b-4 border-orange-600 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold">
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">{user.name}</p>
            <p className="text-xs text-gray-400">Teacher · {user.subject || 'All subjects'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">AI Ed-Tech Platform</span>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-600 border border-gray-200 px-3 py-1.5 rounded-lg">Sign out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-5">
        {/* Tabs */}
        <div className="flex gap-2 mb-5 border-b border-gray-200 pb-3">
          {[['lectures','My Lectures'],['upload','+ Upload Lecture']].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition
                ${tab===key ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-orange-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* My Lectures */}
        {tab === 'lectures' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Your lectures ({lectures.length})</h2>
            </div>
            {lectures.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📚</p>
                <p className="font-medium">No lectures yet</p>
                <p className="text-sm mt-1">Click "+ Upload Lecture" to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lectures.map(l => (
                  <div key={l._id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${BADGE[l.fileType || l.sourceType] || 'bg-gray-100 text-gray-600'}`}>
                          {(l.fileType || l.sourceType || 'file').toUpperCase()}
                        </span>
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{l.title}</h3>
                      </div>
                      {l.description && <p className="text-xs text-gray-400 mb-2">{l.description}</p>}
                      {l.summary && (
                        <p className="text-xs text-gray-500 line-clamp-2">{l.summary.slice(0,180)}...</p>
                      )}
                      <p className="text-xs text-gray-300 mt-2">{new Date(l.createdAt).toLocaleDateString()} · {l.views} views</p>
                    </div>
                    <button onClick={() => handleDelete(l._id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-3 py-1.5 rounded-lg flex-shrink-0">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload Form */}
        {tab === 'upload' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Upload a lecture</h2>

            <div className="space-y-3">
              <input placeholder="Lecture title *" value={form.title}
                onChange={e => setForm(f=>({...f,title:e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              <textarea placeholder="Description (optional)" value={form.description}
                onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none" />

              {/* Language */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500 whitespace-nowrap">Summary language:</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>

              {/* File / URL toggle */}
              <div className="flex gap-2">
                {[['file','Upload file'],['url','YouTube / URL']].map(([m,label]) => (
                  <button key={m} onClick={() => setInputMode(m)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg border transition
                      ${inputMode===m ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-orange-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {inputMode === 'file' && (
                <div className="border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl p-8 text-center cursor-pointer hover:bg-orange-100 transition"
                  onClick={() => fileRef.current.click()}>
                  <input type="file" className="hidden" ref={fileRef}
                    accept=".pdf,.docx,.doc,.mp3,.mp4,.wav,.m4a"
                    onChange={e => setFile(e.target.files[0])} />
                  {file
                    ? <p className="text-sm font-semibold text-gray-700">{file.name}</p>
                    : <>
                        <p className="font-semibold text-gray-600 text-sm">Click to select file</p>
                        <p className="text-xs text-gray-400 mt-1">PDF · DOCX · MP3 · MP4 · WAV</p>
                      </>
                  }
                </div>
              )}

              {inputMode === 'url' && (
                <input placeholder="https://www.youtube.com/watch?v=..."
                  value={form.externalUrl}
                  onChange={e => setForm(f=>({...f,externalUrl:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              )}
            </div>

            {error   && <p className="text-red-600 text-xs mt-3 bg-red-50 p-2.5 rounded-lg">{error}</p>}
            {uploadMsg && <p className="text-orange-600 text-xs mt-3 animate-pulse">{uploadMsg}</p>}

            <button onClick={handleUpload} disabled={uploading}
              className="mt-5 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg text-sm disabled:opacity-50">
              {uploading ? 'Processing...' : 'Upload & Analyse'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}