import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllCalendarEvents,
  getCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  addEventAttendee,
  updateAttendeeResponse,
  removeEventAttendee,
  getUserEvents,
} from "../controllers/calendar.controller.js"
import { protect } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Get user's events
router.get(
  "/my-events",
  [
    query("startDate").optional().isISO8601().withMessage("Start date must be a valid date"),
    query("endDate").optional().isISO8601().withMessage("End date must be a valid date"),
  ],
  validate,
  getUserEvents,
)

router
  .route("/")
  .get(
    [
      query("startDate").optional().isISO8601().withMessage("Start date must be a valid date"),
      query("endDate").optional().isISO8601().withMessage("End date must be a valid date"),
      query("eventType")
        .optional()
        .isIn(["meeting", "activity", "class", "specialty", "camp", "other"])
        .withMessage("Invalid event type"),
      query("createdBy").optional().isInt().withMessage("Created by must be an integer"),
    ],
    validate,
    getAllCalendarEvents,
  )
  .post(
    [
      body("title").notEmpty().withMessage("Title is required"),
      body("startDatetime").isISO8601().withMessage("Start date must be a valid date"),
      body("endDatetime").isISO8601().withMessage("End date must be a valid date"),
      body("allDay").optional().isBoolean().withMessage("All day must be a boolean"),
      body("location").optional().isString().withMessage("Location must be a string"),
      body("color").optional().isString().withMessage("Color must be a string"),
      body("eventType")
        .optional()
        .isIn(["meeting", "activity", "class", "specialty", "camp", "other"])
        .withMessage("Invalid event type"),
      body("relatedEntityType").optional().isString().withMessage("Related entity type must be a string"),
      body("relatedEntityId").optional().isInt().withMessage("Related entity ID must be an integer"),
      body("attendees").optional().isArray().withMessage("Attendees must be an array"),
      body("attendees.*.userId").optional().isInt().withMessage("User ID must be an integer"),
      body("attendees.*.pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      body("attendees.*.responseStatus")
        .optional()
        .isIn(["pending", "accepted", "declined", "tentative"])
        .withMessage("Invalid response status"),
    ],
    validate,
    createCalendarEvent,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Event ID must be an integer")], validate, getCalendarEvent)
  .patch(
    [
      param("id").isInt().withMessage("Event ID must be an integer"),
      body("title").optional().notEmpty().withMessage("Title is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("startDatetime").optional().isISO8601().withMessage("Start date must be a valid date"),
      body("endDatetime").optional().isISO8601().withMessage("End date must be a valid date"),
      body("allDay").optional().isBoolean().withMessage("All day must be a boolean"),
      body("location").optional().isString().withMessage("Location must be a string"),
      body("color").optional().isString().withMessage("Color must be a string"),
      body("eventType")
        .optional()
        .isIn(["meeting", "activity", "class", "specialty", "camp", "other"])
        .withMessage("Invalid event type"),
      body("relatedEntityType").optional().isString().withMessage("Related entity type must be a string"),
      body("relatedEntityId").optional().isInt().withMessage("Related entity ID must be an integer"),
    ],
    validate,
    updateCalendarEvent,
  )
  .delete([param("id").isInt().withMessage("Event ID must be an integer")], validate, deleteCalendarEvent)

router.post(
  "/:id/attendees",
  [
    param("id").isInt().withMessage("Event ID must be an integer"),
    body("userId").optional().isInt().withMessage("User ID must be an integer"),
    body("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
    body("responseStatus")
      .optional()
      .isIn(["pending", "accepted", "declined", "tentative"])
      .withMessage("Invalid response status"),
  ],
  validate,
  addEventAttendee,
)

router.patch(
  "/:id/attendees/:attendeeId",
  [
    param("id").isInt().withMessage("Event ID must be an integer"),
    param("attendeeId").isInt().withMessage("Attendee ID must be an integer"),
    body("responseStatus")
      .isIn(["pending", "accepted", "declined", "tentative"])
      .withMessage("Invalid response status"),
  ],
  validate,
  updateAttendeeResponse,
)

router.delete(
  "/:id/attendees/:attendeeId",
  [
    param("id").isInt().withMessage("Event ID must be an integer"),
    param("attendeeId").isInt().withMessage("Attendee ID must be an integer"),
  ],
  validate,
  removeEventAttendee,
)

export default router

