const express = require('express')
const cors = require('cors')
const multer = require('multer')
const axios = require('axios')
const FormData = require('form-data')

const app = express()
app.use(cors())
app.use(express.json())

const SUPPORTED_MIMETYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4',
    'video/mp4', 'video/webm',
]

const SUPPORTED_EXTENSIONS = /\.(pdf|docx|doc|mp3|mp4|wav|m4a|webm)$/i

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB for video files
    fileFilter: (req, file, cb) => {
        if (SUPPORTED_EXTENSIONS.test(file.originalname)) {
            cb(null, true)
        } else {
            cb(new Error('Unsupported file type. Please upload PDF, DOCX, MP3, or MP4.'))
        }
    }
})

const AI_SERVICE_URL = 'http://localhost:5001'

// 1. Content Processing — supports PDF, DOCX, MP3, MP4
app.post('/api/upload-material', upload.single('document'), async (req, res) => {
    try {
        const form = new FormData()
        form.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        })
        // Pass session_id and language through to Flask
        form.append('session_id', req.body.session_id || 'default')
        form.append('language', req.body.language || 'English')

        const response = await axios.post(`${AI_SERVICE_URL}/process-content`, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        })
        res.json(response.data)
    } catch (error) {
        console.error('Upload error:', error.response?.data || error.message)
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || "Failed to process content."
        })
    }
})

// 2. Multilingual Tutor Chat
app.post('/api/chat', async (req, res) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/tutor-chat`, req.body)
        res.json(response.data)
    } catch (error) {
        console.error('Chat error:', error.response?.data || error.message)
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || "Tutor is currently offline."
        })
    }
})

// 3. Adaptive Quiz Generation
app.post('/api/quiz', async (req, res) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/generate-assessment`, req.body)
        res.json(response.data)
    } catch (error) {
        console.error('Quiz error:', error.response?.data || error.message)
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || "Could not generate assessment."
        })
    }
})

app.listen(5002, () => console.log('Ed-Tech AI Gateway running on port 5002'))