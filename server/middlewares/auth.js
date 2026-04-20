const jwt  = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' })

    const token = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')
    if (!user) return res.status(401).json({ error: 'User not found' })

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

const teacherOnly = (req, res, next) => {
  if (req.user?.role !== 'teacher')
    return res.status(403).json({ error: 'Teacher access required' })
  next()
}

const studentOnly = (req, res, next) => {
  if (req.user?.role !== 'student')
    return res.status(403).json({ error: 'Student access required' })
  next()
}

module.exports = { protect, teacherOnly, studentOnly }