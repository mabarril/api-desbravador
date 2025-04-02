import express from "express"
import { getDashboardStats, getDirectorDashboard, getLeaderDashboard } from "../controllers/dashboard.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Admin dashboard
router.get("/admin", restrictTo("admin"), getDashboardStats)

// Director dashboard
router.get("/director", restrictTo("admin", "director"), getDirectorDashboard)

// Leader dashboard
router.get("/leader", restrictTo("admin", "director", "leader"), getLeaderDashboard)

export default router

