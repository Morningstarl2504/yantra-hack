const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ['student', 'teacher'], required: true },

  // Teacher-only
  subject:      { type: String },
  institution:  { type: String },

  // Student-only
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

  // Quiz history for students
  quizHistory: [{
    topic:      String,
    score:      Number,    // 0 or 1
    difficulty: String,
    date:       { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
})

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

module.exports = mongoose.model('User', userSchema)