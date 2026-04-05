const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const connectDB = require('./database/db') // Fixed: was './databse/db'
const userRoute = require('./routes/userRoute')
const courseRoute = require('./routes/courseRoute')
const adminRoute = require('./routes/adminRoute')

dotenv.config()

const app = express()

// Fixed: lock CORS to frontend origin in production
app.use(cors({
    origin: process.env.FRONTEND_URL || '*'
}))
app.use(express.json())

const port = process.env.PORT || 5000

app.get("/", (req, res) => {
    res.send("Server is working!")
})
app.use("/uploads", express.static("uploads"))

app.use("/api", userRoute)
app.use("/api", courseRoute)
app.use("/api", adminRoute)

// Fixed: connect to DB first, then start the server
// This ensures no requests are handled before the DB is ready
connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is running at port ${port}`)
        })
    })
    .catch((err) => {
        console.error("Failed to connect to database:", err)
        process.exit(1)
    })