const mongoose = require('mongoose')

const lectureSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  teacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Source — file or URL
  sourceType:  { type: String, enum: ['file', 'url'], required: true },
  fileUrl:     { type: String },   // path to uploaded file on server
  fileName:    { type: String },
  fileType:    { type: String },   // pdf | docx | mp3 | mp4 | ...
  externalUrl: { type: String },   // YouTube or other URL

  // AI-generated content (cached so students don't re-process)
  summary:     { type: String },
  geminiFileUri: { type: String }, // stored Gemini file URI for AV content
  geminiMimeType: { type: String },
  contentType: { type: String, enum: ['text', 'av'] },

  // Access control
  isPublic:    { type: Boolean, default: true },
  enrolledOnly: { type: Boolean, default: false },

  views:       { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now }
})

module.exports = mongoose.model('Lecture', lectureSchema)