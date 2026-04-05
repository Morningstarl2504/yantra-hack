const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const AI_SERVICE_URL = 'http://localhost:5001';

// 1. Route for Content Processing
app.post('/api/upload-material', upload.single('document'), async (req, res) => {
    try {
        const form = new FormData();
        form.append('file', req.file.buffer, { filename: req.file.originalname });

        const response = await axios.post(`${AI_SERVICE_URL}/process-content`, form, {
            headers: form.getHeaders()
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to process content." });
    }
});

// 2. Route for Multilingual Tutor
app.post('/api/chat', async (req, res) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/tutor-chat`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Tutor is currently offline." });
    }
});

// 3. Route for Adaptive Assessment
app.post('/api/quiz', async (req, res) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/generate-assessment`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Could not generate assessment." });
    }
});

app.listen(5000, () => console.log('Ed-Tech Gateway running on port 5000'));