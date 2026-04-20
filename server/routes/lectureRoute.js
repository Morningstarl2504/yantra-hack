const express = require('express')
const multer  = require('multer')
const path    = require('path')
const router  = express.Router()
const { protect, teacherOnly } = require('../middlewares/auth')
const {
  createLecture, getLectures, getLecture,
  deleteLecture, loadLectureSession
} = require('../controllers/lectureController')

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|docx|doc|mp3|mp4|wav|m4a)$/i
    allowed.test(file.originalname) ? cb(null, true) : cb(new Error('Unsupported file type'))
  }
})

router.get('/',          protect, getLectures)
router.get('/:id',       protect, getLecture)
router.post('/',         protect, teacherOnly, upload.single('file'), createLecture)
router.delete('/:id',    protect, teacherOnly, deleteLecture)
router.post('/:id/load', protect, loadLectureSession)

module.exports = router