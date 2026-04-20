const express    = require('express')
const dotenv     = require('dotenv')
const cors       = require('cors')
const fs         = require('fs')
const connectDB  = require('./database/db')
const authRoute  = require('./routes/authRoute')
const lectureRoute = require('./routes/lectureRoute')

dotenv.config()

const app = express()
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads')

const port = process.env.PORT || 5000

app.get('/', (req, res) => res.send('Server is working!'))
app.use('/uploads', express.static('uploads'))
app.use('/api/auth',     authRoute)
app.use('/api/lectures', lectureRoute)

// Keep your existing routes if they exist
try { app.use('/api', require('./routes/userRoute'))   } catch(e) {}
try { app.use('/api', require('./routes/courseRoute')) } catch(e) {}
try { app.use('/api', require('./routes/adminRoute'))  } catch(e) {}

connectDB()
  .then(() => app.listen(port, () => console.log(`Server running on port ${port}`)))
  .catch(err => { console.error('DB failed:', err); process.exit(1) })