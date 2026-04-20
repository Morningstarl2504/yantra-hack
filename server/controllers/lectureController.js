const axios    = require('axios')
const FormData = require('form-data')
const fs       = require('fs')
const path     = require('path')
const Lecture  = require('../models/Lecture')

const AI_SERVICE_URL = 'http://localhost:5001'

// POST /api/lectures  — teacher uploads a lecture
const createLecture = async (req, res) => {
  try {
    const { title, description, externalUrl, language = 'English' } = req.body
    const teacherId = req.user._id

    let lectureData = { title, description, teacher: teacherId }
    let summaryResult = null

    if (req.file) {
      // File upload
      const ext = req.file.originalname.split('.').pop().toLowerCase()
      lectureData.sourceType = 'file'
      lectureData.fileUrl    = req.file.path
      lectureData.fileName   = req.file.originalname
      lectureData.fileType   = ext

      // Forward to Flask for AI processing
      const form = new FormData()
      form.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      })
      form.append('session_id', `lecture_${teacherId}`)
      form.append('language', language)

      const aiRes = await axios.post(`${AI_SERVICE_URL}/process-content`, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 180000
      })
      summaryResult = aiRes.data

    } else if (externalUrl) {
      // YouTube / URL
      lectureData.sourceType  = 'url'
      lectureData.externalUrl = externalUrl

      const aiRes = await axios.post(`${AI_SERVICE_URL}/process-url`, {
        url: externalUrl,
        session_id: `lecture_${teacherId}`,
        language
      }, { timeout: 360000 })
      summaryResult = aiRes.data

    } else {
      return res.status(400).json({ error: 'Provide a file or URL' })
    }

    if (summaryResult) {
      lectureData.summary        = summaryResult.summary
      lectureData.geminiFileUri  = summaryResult.file_uri  || null
      lectureData.geminiMimeType = summaryResult.mime_type || null
      lectureData.contentType    = summaryResult.content_type || 'text'
    }

    const lecture = await Lecture.create(lectureData)
    res.status(201).json({ status: 'success', lecture })

  } catch (err) {
    console.error('Lecture create error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.error || 'Failed to create lecture' })
  }
}

// GET /api/lectures  — list all public lectures
const getLectures = async (req, res) => {
  try {
    const filter = req.user?.role === 'teacher'
      ? { teacher: req.user._id }   // teacher sees only their own
      : { isPublic: true }           // students see all public

    const lectures = await Lecture.find(filter)
      .populate('teacher', 'name subject')
      .sort({ createdAt: -1 })
      .select('-geminiFileUri')
    res.json(lectures)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lectures' })
  }
}

// GET /api/lectures/:id
const getLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id).populate('teacher', 'name subject institution')
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' })
    await Lecture.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } })
    res.json(lecture)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lecture' })
  }
}

// DELETE /api/lectures/:id  — teacher only, own lecture
const deleteLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id)
    if (!lecture) return res.status(404).json({ error: 'Not found' })
    if (lecture.teacher.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your lecture' })
    if (lecture.fileUrl && fs.existsSync(lecture.fileUrl))
      fs.unlinkSync(lecture.fileUrl)
    await lecture.deleteOne()
    res.json({ status: 'deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' })
  }
}

// POST /api/lectures/:id/load-session  — load lecture into AI session for a student
const loadLectureSession = async (req, res) => {
  try {
    const lecture   = await Lecture.findById(req.params.id)
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' })

    const sessionId = req.body.session_id || `student_${req.user._id}`

    // Tell Flask to load this lecture into the session context
    await axios.post(`${AI_SERVICE_URL}/load-session`, {
      session_id:   sessionId,
      summary:      lecture.summary,
      file_uri:     lecture.geminiFileUri,
      mime_type:    lecture.geminiMimeType,
      content_type: lecture.contentType,
      title:        lecture.title
    })

    res.json({ status: 'loaded', session_id: sessionId, title: lecture.title })
  } catch (err) {
    console.error('Load session error:', err.response?.data || err.message)
    res.status(500).json({ error: 'Failed to load lecture into session' })
  }
}

module.exports = { createLecture, getLectures, getLecture, deleteLecture, loadLectureSession }