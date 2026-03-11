const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer(); // Store file in memory for relaying

app.use(cors());
app.use(express.json());

// Relay route to AI Engine
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No image provided');

        // Prepare data to send to Python Flask
        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: req.file.originalname });

        const response = await axios.post('http://localhost:5001/predict', formData, {
            headers: formData.getHeaders()
        });

        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'AI Service Unavailable' });
    }
});

app.listen(5000, () => console.log('Gateway running on port 5000'));