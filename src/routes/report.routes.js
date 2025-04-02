import express from "express"
import { param, query } from "express-validator"
import {
  getAttendanceReport,
  getClassProgressReport,
  getFinancialReport,
  getPathfinderActivityReport,
} from "../controllers/report.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Attendance report
router.get(
  "/attendance",
  [
    query("startDate").isDate().withMessage("Start date must be a valid date"),
    query("endDate").isDate().withMessage("End date must be a valid date"),
    query("unitId").optional().isInt().withMessage("Unit ID must be an integer"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  getAttendanceReport,
)

// Class progress report
router.get(
  "/class-progress",
  [
    query("unitId").optional().isInt().withMessage("Unit ID must be an integer"),
    query("classId").optional().isInt().withMessage("Class ID must be an integer"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  getClassProgressReport,
)

// Financial report
router.get(
  "/financial",
  [
    query("startDate").isDate().withMessage("Start date must be a valid date"),
    query("endDate").isDate().withMessage("End date must be a valid date"),
    query("groupBy").optional().isIn(["category", "month"]).withMessage("Group by must be category or month"),
  ],
  validate,
  restrictTo("admin", "director"),
  getFinancialReport,
)

// Pathfinder activity report
router.get(
  "/pathfinder/:pathfinderId",
  [param("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer")],
  validate,
  restrictTo("admin", "director", "leader"),
  getPathfinderActivityReport,
)

export default router

