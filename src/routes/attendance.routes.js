import express from "express"
import { body, param, query } from "express-validator"
import {
  getAttendanceRecords,
  getAttendanceRecord,
  createAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  bulkCreateAttendanceRecords,
  getPathfinderAttendance,
  getEventAttendance,
} from "../controllers/attendance.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(
    [
      query("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      query("eventType").optional().isString().withMessage("Event type must be a string"),
      query("eventId").optional().isInt().withMessage("Event ID must be an integer"),
      query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
      query("endDate").optional().isDate().withMessage("End date must be a valid date"),
      query("status").optional().isIn(["present", "absent", "excused", "late"]).withMessage("Invalid status"),
    ],
    validate,
    getAttendanceRecords,
  )
  .post(
    [
      body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
      body("eventDate").isDate().withMessage("Event date must be a valid date"),
      body("eventType").isString().withMessage("Event type must be a string"),
      body("eventId").optional().isInt().withMessage("Event ID must be an integer"),
      body("status").isIn(["present", "absent", "excused", "late"]).withMessage("Invalid status"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    createAttendanceRecord,
  )

router.post(
  "/bulk",
  [
    body("eventDate").isDate().withMessage("Event date must be a valid date"),
    body("eventType").isString().withMessage("Event type must be a string"),
    body("eventId").optional().isInt().withMessage("Event ID must be an integer"),
    body("records").isArray().withMessage("Records must be an array"),
    body("records.*.pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    body("records.*.status").isIn(["present", "absent", "excused", "late"]).withMessage("Invalid status"),
    body("records.*.notes").optional().isString().withMessage("Notes must be a string"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  bulkCreateAttendanceRecords,
)

router.get(
  "/pathfinder/:pathfinderId",
  [
    param("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
    query("endDate").optional().isDate().withMessage("End date must be a valid date"),
    query("eventType").optional().isString().withMessage("Event type must be a string"),
  ],
  validate,
  getPathfinderAttendance,
)

router.get(
  "/event/:eventType/:eventId",
  [
    param("eventType").isString().withMessage("Event type must be a string"),
    param("eventId").isString().withMessage("Event ID must be a string"),
  ],
  validate,
  getEventAttendance,
)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Attendance record ID must be an integer")], validate, getAttendanceRecord)
  .patch(
    [
      param("id").isInt().withMessage("Attendance record ID must be an integer"),
      body("eventDate").optional().isDate().withMessage("Event date must be a valid date"),
      body("status").optional().isIn(["present", "absent", "excused", "late"]).withMessage("Invalid status"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    updateAttendanceRecord,
  )
  .delete(
    [param("id").isInt().withMessage("Attendance record ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteAttendanceRecord,
  )

export default router

