import express from "express"
import pathfinderRoutes from "./pathfinder.routes.js"
import classRoutes from "./class.routes.js"
import unitRoutes from "./unit.routes.js"
import specialtyRoutes from "./specialty.routes.js"
import minuteRoutes from "./minute.routes.js"
import actRoutes from "./act.routes.js"
import assetRoutes from "./asset.routes.js"
import registrationRoutes from "./registration.routes.js"
import monthlyFeeRoutes from "./monthlyFee.routes.js"
import cashBookRoutes from "./cashBook.routes.js"
import paymentRoutes from "./payment.routes.js"
import eventRoutes from "./event.routes.js"
import departureAuthRoutes from "./departureAuth.routes.js"
import authRoutes from "./auth.routes.js"
import userRoutes from "./user.routes.js"
import reportRoutes from "./report.routes.js"
import notificationRoutes from "./notification.routes.js"
import auditRoutes from "./audit.routes.js"
import backupRoutes from "./backup.routes.js"
import dashboardRoutes from "./dashboard.routes.js"
import documentRoutes from "./document.routes.js"
import settingRoutes from "./setting.routes.js"
import searchRoutes from "./search.routes.js"
import calendarRoutes from "./calendar.routes.js"
import attendanceRoutes from "./attendance.routes.js"
import messageRoutes from "./message.routes.js"
import permissionRoutes from "./permission.routes.js"

const router = express.Router()

// Auth routes
router.use("/auth", authRoutes)

// Entity routes
router.use("/pathfinders", pathfinderRoutes)
router.use("/classes", classRoutes)
router.use("/units", unitRoutes)
router.use("/specialties", specialtyRoutes)
router.use("/minutes", minuteRoutes)
router.use("/acts", actRoutes)
router.use("/assets", assetRoutes)
router.use("/registrations", registrationRoutes)
router.use("/monthly-fees", monthlyFeeRoutes)
router.use("/cash-book", cashBookRoutes)
router.use("/payments", paymentRoutes)
router.use("/events", eventRoutes)
router.use("/departure-authorizations", departureAuthRoutes)
router.use("/calendar", calendarRoutes)
router.use("/attendance", attendanceRoutes)
router.use("/messages", messageRoutes)

// Admin routes
router.use("/users", userRoutes)
router.use("/reports", reportRoutes)
router.use("/notifications", notificationRoutes)
router.use("/audit", auditRoutes)
router.use("/backups", backupRoutes)
router.use("/dashboard", dashboardRoutes)
router.use("/documents", documentRoutes)
router.use("/settings", settingRoutes)
router.use("/search", searchRoutes)
router.use("/permissions", permissionRoutes)

export default router

