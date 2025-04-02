import express from "express"
import { param, query } from "express-validator"
import { getAuditLogEntries, getEntityAuditLog, getUserAuditLog } from "../controllers/audit.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)
router.use(restrictTo("admin", "director"))

router.get(
  "/",
  [
    query("userId").optional().isInt().withMessage("User ID must be an integer"),
    query("action").optional().isString().withMessage("Action must be a string"),
    query("entityType").optional().isString().withMessage("Entity type must be a string"),
    query("entityId").optional().isInt().withMessage("Entity ID must be an integer"),
    query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
    query("endDate").optional().isDate().withMessage("End date must be a valid date"),
    query("limit").optional().isInt({ min: 1, max: 1000 }).withMessage("Limit must be between 1 and 1000"),
    query("offset").optional().isInt({ min: 0 }).withMessage("Offset must be a non-negative integer"),
  ],
  validate,
  getAuditLogEntries,
)

router.get(
  "/entity/:entityType/:entityId",
  [
    param("entityType").isString().withMessage("Entity type must be a string"),
    param("entityId").isInt().withMessage("Entity ID must be an integer"),
  ],
  validate,
  getEntityAuditLog,
)

router.get(
  "/user/:userId",
  [param("userId").isInt().withMessage("User ID must be an integer")],
  validate,
  getUserAuditLog,
)

export default router

