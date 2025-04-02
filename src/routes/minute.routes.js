import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllMinutes,
  getMinute,
  createMinute,
  updateMinute,
  deleteMinute,
  searchMinutes,
} from "../controllers/minute.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(
    [
      query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
      query("endDate").optional().isDate().withMessage("End date must be a valid date"),
      query("search").optional().isString().withMessage("Search term must be a string"),
    ],
    validate,
    getAllMinutes,
  )
  .post(
    [
      body("title").notEmpty().withMessage("Title is required"),
      body("meetingDate").isDate().withMessage("Meeting date must be a valid date"),
      body("content").notEmpty().withMessage("Content is required"),
      body("attendees").optional().isString().withMessage("Attendees must be a string"),
      body("decisions").optional().isString().withMessage("Decisions must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    createMinute,
  )

router.get("/search", [query("query").notEmpty().withMessage("Search query is required")], validate, searchMinutes)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Minutes ID must be an integer")], validate, getMinute)
  .patch(
    [
      param("id").isInt().withMessage("Minutes ID must be an integer"),
      body("title").optional().notEmpty().withMessage("Title is required"),
      body("meetingDate").optional().isDate().withMessage("Meeting date must be a valid date"),
      body("content").optional().notEmpty().withMessage("Content is required"),
      body("attendees").optional().isString().withMessage("Attendees must be a string"),
      body("decisions").optional().isString().withMessage("Decisions must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    updateMinute,
  )
  .delete(
    [param("id").isInt().withMessage("Minutes ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteMinute,
  )

export default router

