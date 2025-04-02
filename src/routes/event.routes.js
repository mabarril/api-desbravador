import express from "express"
import { body, param } from "express-validator"
import {
  getAllEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  registerPathfinderForEvent,
  updatePathfinderEventRegistration,
  removePathfinderFromEvent,
} from "../controllers/event.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(getAllEvents)
  .post(
    [
      body("name").notEmpty().withMessage("Name is required"),
      body("startDate").isDate().withMessage("Valid start date is required"),
      body("endDate").isDate().withMessage("Valid end date is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("location").optional().isString().withMessage("Location must be a string"),
      body("fee").optional().isFloat({ min: 0 }).withMessage("Fee must be a positive number"),
      body("maxParticipants").optional().isInt({ min: 1 }).withMessage("Max participants must be a positive integer"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    createEvent,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Event ID must be an integer")], validate, getEvent)
  .patch(
    [
      param("id").isInt().withMessage("Event ID must be an integer"),
      body("name").optional().isString().withMessage("Name must be a string"),
      body("startDate").optional().isDate().withMessage("Valid start date is required"),
      body("endDate").optional().isDate().withMessage("Valid end date is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("location").optional().isString().withMessage("Location must be a string"),
      body("fee").optional().isFloat({ min: 0 }).withMessage("Fee must be a positive number"),
      body("maxParticipants").optional().isInt({ min: 1 }).withMessage("Max participants must be a positive integer"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    updateEvent,
  )
  .delete(
    [param("id").isInt().withMessage("Event ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteEvent,
  )

// Register a pathfinder for an event
router.post(
  "/:id/participants",
  [
    param("id").isInt().withMessage("Event ID must be an integer"),
    body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    body("paymentStatus")
      .optional()
      .isIn(["pending", "paid", "waived"])
      .withMessage("Payment status must be pending, paid, or waived"),
    body("notes").optional().isString().withMessage("Notes must be a string"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  registerPathfinderForEvent,
)

// Update a pathfinder's event registration
router.patch(
  "/:id/participants",
  [
    param("id").isInt().withMessage("Event ID must be an integer"),
    body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    body("paymentStatus")
      .optional()
      .isIn(["pending", "paid", "waived"])
      .withMessage("Payment status must be pending, paid, or waived"),
    body("attendanceStatus")
      .optional()
      .isIn(["registered", "attended", "absent"])
      .withMessage("Attendance status must be registered, attended, or absent"),
    body("notes").optional().isString().withMessage("Notes must be a string"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  updatePathfinderEventRegistration,
)

// Remove a pathfinder from an event
router.delete(
  "/:id/participants/:pathfinderId",
  [
    param("id").isInt().withMessage("Event ID must be an integer"),
    param("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  removePathfinderFromEvent,
)

export default router

