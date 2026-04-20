const jwt  = require('jsonwebtoken')
const User = require('../models/User')

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, role, subject, institution } = req.body

    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'All fields are required' })

    if (!['student', 'teacher'].includes(role))
      return res.status(400).json({ error: 'Role must be student or teacher' })

    const existing = await User.findOne({ email })
    if (existing)
      return res.status(409).json({ error: 'Email already registered' })

    const user = await User.create({ name, email, password, role, subject, institution })
    const token = signToken(user._id)

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
}

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' })

    const user = await User.findOne({ email })
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid email or password' })

    const token = signToken(user._id)
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
}

// GET /api/auth/me
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('enrolledCourses', 'title')
    .select('-password')
  res.json(user)
}

// PATCH /api/auth/quiz-result  — student saves quiz result
const saveQuizResult = async (req, res) => {
  try {
    const { topic, score, difficulty } = req.body
    await User.findByIdAndUpdate(req.user._id, {
      $push: { quizHistory: { topic, score, difficulty } }
    })
    res.json({ status: 'saved' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save result' })
  }
}

module.exports = { register, login, getMe, saveQuizResult }