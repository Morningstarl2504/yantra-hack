const express = require('express')
const cors = require('cors')
const multer = require('multer')
const axios = require('axios')
const FormData = require('form-data')

const app = express()
app.use(cors())
app.use(express.json())

// Fixed: added file type and size validation
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true)
        } else {
            cb(new Error('Only PDF files are allowed'))
        }
    }
})

const AI_SERVICE_URL = 'http://localhost:5001'

// 1. Route for Content Processing
app.post('/api/upload-material', upload.single('document'), async (req, res) => {
    try {
        const form = new FormData()
        form.append('file', req.file.buffer, { filename: req.file.originalname })

        const response = await axios.post(`${AI_SERVICE_URL}/process-content`, form, {
            headers: form.getHeaders()
        })
        res.json(response.data)
    } catch (error) {
        // Fixed: log and forward real error details instead of swallowing them
        console.error('Upload error:', error.response?.data || error.message)
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || "Failed to process content."
        })
    }
})

// 2. Route for Multilingual Tutor
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

// 3. Route for Adaptive Assessment
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

// Fixed: changed port to 5002 to avoid conflict with server/app.js on 5000
app.listen(5002, () => console.log('Ed-Tech AI Gateway running on port 5002'))