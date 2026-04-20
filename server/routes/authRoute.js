const express = require('express')
const router  = express.Router()
const { register, login, getMe, saveQuizResult } = require('../controllers/authController')
const { protect, studentOnly } = require('../middlewares/auth')

router.post('/register',     register)
router.post('/login',        login)
router.get('/me',            protect, getMe)
router.patch('/quiz-result', protect, studentOnly, saveQuizResult)

module.exports = router