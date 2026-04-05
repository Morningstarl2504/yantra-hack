import React, { useState, useRef } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5001';

export default function App() {
  const [activeTab, setActiveTab] = useState('processing'); 
  
  // Module 1 State
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Module 2 State
  const [chatLog, setChatLog] = useState([{ sender: 'AI', text: 'Hello! Upload a document, then ask me anything about it.' }]);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('English');
  const [isTyping, setIsTyping] = useState(false);

  // Module 3 State
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fileInputRef = useRef(null);

  // --- API Calls ---

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);
    setSummary('');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile); 

      const res = await axios.post(`${API_URL}/process-content`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummary(res.data.summary);
    } catch (error) {
      setSummary(error.response?.data?.error || "An error occurred analyzing the document.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChat = async () => {
    if (!query.trim()) return;
    
    const newLog = [...chatLog, { sender: 'Student', text: query }];
    setChatLog(newLog);
    setQuery('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_URL}/tutor-chat`, {
        query: query,
        language: language
      });
      setChatLog([...newLog, { sender: 'AI', text: res.data.response }]);
    } catch (error) {
      setChatLog([...newLog, { sender: 'System', text: error.response?.data?.error || "Error connecting to AI Tutor." }]);
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
      const res = await axios.post(`${API_URL}/generate-assessment`);
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
          <div className="text-sm text-gray-500 font-medium">Capstone Project • Team 22BCE0549 & 22BCT0102</div>
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
              0{idx + 1} {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100 min-h-[500px]">
          
          {/* Module 1: Processing */}
          {activeTab === 'processing' && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Lecture Ingestion & NLP Analysis</h2>
              <p className="text-gray-500 mb-8">Upload PDFs to extract content and generate concise summaries using advanced NLP.</p>
              
              <div 
                className="border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl p-12 text-center cursor-pointer hover:bg-orange-100 transition"
                onClick={() => fileInputRef.current.click()}
              >
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" />
                <p className="text-lg font-semibold text-gray-700">Drag & Drop Lecture Files Here</p>
                <p className="text-sm text-gray-500 mt-2">Currently supporting .PDF</p>
              </div>

              {isProcessing && <div className="mt-8 text-center text-orange-600 font-medium animate-pulse">Processing document...</div>}

              {summary && !isProcessing && (
                <div className="mt-8 p-6 bg-gray-50 border-l-4 border-orange-600 rounded-r-lg">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Automated Course Summary</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Module 2: Tutor */}
          {activeTab === 'tutor' && (
            <div className="animate-fade-in flex flex-col h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Context-Aware RAG Support</h2>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="border border-gray-300 py-2 px-4 rounded-lg">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>Hindi</option>
                  <option>Mandarin</option>
                </select>
              </div>
              
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-y-auto mb-4">
                {chatLog.map((msg, idx) => (
                  <div key={idx} className={`mb-4 flex ${msg.sender === 'Student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-4 rounded-2xl ${msg.sender === 'Student' ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'}`}>
                      <p className="text-sm font-bold mb-1">{msg.sender}</p>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isTyping && <p className="text-gray-400 italic">AI is typing...</p>}
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder={`Ask a doubt in ${language}...`} className="flex-1 border border-gray-300 rounded-lg px-4 py-3"
                />
                <button onClick={handleChat} disabled={isTyping} className="bg-orange-600 text-white px-8 py-3 rounded-lg font-bold">Send</button>
              </div>
            </div>
          )}

          {/* Module 3: Assessment */}
          {activeTab === 'assessment' && (
            <div className="animate-fade-in text-center py-8">
              {!quizStarted || (!quizData && !quizLoading) ? (
                <>
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">Adaptive Knowledge Check</h2>
                  <p className="text-gray-600 mb-8">Dynamically generated quizzes based on your uploaded document.</p>
                  <button onClick={loadQuiz} className="bg-orange-600 text-white text-lg px-8 py-4 rounded-xl font-bold">Generate Quiz</button>
                </>
              ) : quizLoading ? (
                 <p className="text-orange-600 animate-pulse text-xl font-bold mt-10">Crafting your question...</p>
              ) : (
                <div className="max-w-3xl mx-auto text-left">
                  <div className="flex justify-between items-center mb-6">
                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full uppercase">{quizData.topic}</span>
                    <span className="text-gray-500 font-medium">Difficulty: {quizData.difficulty}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">{quizData.question}</h3>
                  
                  <div className="space-y-3">
                    {quizData.options.map((opt, i) => (
                      <button 
                        key={i} onClick={() => !feedback && setSelectedAnswer(i)} disabled={!!feedback}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selectedAnswer === i ? 'border-orange-600 bg-orange-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  
                  {feedback && (
                    <div className={`mt-6 p-4 rounded-lg font-bold ${feedback.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {feedback.text}
                    </div>
                  )}

                  <div className="mt-8 flex justify-between">
                     {!feedback ? (
                       <button onClick={handleQuizSubmit} disabled={selectedAnswer === null} className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50">Submit Answer</button>
                     ) : (
                       <button onClick={loadQuiz} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold">Next Question</button>
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