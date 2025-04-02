import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import { rateLimit } from "express-rate-limit"
import errorHandler from "./middleware/errorHandler.js"
import routes from "./routes/index.js"
import { connectToDatabase } from "./config/database.js"
import { initializeSettings } from "./controllers/setting.controller.js"
import { scheduleBackups } from "./utils/backup.js"
import { initializeDefaultPermissions } from "./controllers/permission.controller.js"
import swaggerUi from "swagger-ui-express"
import swaggerDocument from "./docs/swagger.js"

// Initialize express app
const app = express()

// Connect to database
connectToDatabase()

// Initialize settings
initializeSettings()
  .then(() => console.log("Settings initialized"))
  .catch((err) => console.error("Error initializing settings:", err))

// Initialize permissions
initializeDefaultPermissions()
  .then(() => console.log("Permissions initialized"))
  .catch((err) => console.error("Error initializing permissions:", err))

// Schedule automatic backups (every 24 hours)
scheduleBackups(24)

// Set up middleware
app.use(helmet()) // Security headers
app.use(cors()) // Enable CORS
app.use(express.json()) // Parse JSON bodies
app.use(morgan("dev")) // Logging

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Routes
app.use("/api", routes)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Resource not found" })
})

export default app

