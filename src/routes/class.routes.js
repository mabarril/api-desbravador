import express from "express"
import { body, param } from "express-validator"
import {
  getAllClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  assignClassToPathfinder,
  updatePathfinderClassStatus,
  removePathfinderFromClass,
} from "../controllers/class.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(getAllClasses)
  .post(
    [
      body("name").notEmpty().withMessage("Name is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("requirements").optional().isString().withMessage("Requirements must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    createClass,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Class ID must be an integer")], validate, getClass)
  .patch(
    [
      param("id").isInt().withMessage("Class ID must be an integer"),
      body("name").optional().isString().withMessage("Name must be a string"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("requirements").optional().isString().withMessage("Requirements must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    updateClass,
  )
  .delete(
    [param("id").isInt().withMessage("Class ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteClass,
  )

// Assign a class to a pathfinder
router.post(
  "/:id/pathfinders",
  [
    param("id").isInt().withMessage("Class ID must be an integer"),
    body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    body("status")
      .optional()
      .isIn(["not_started", "in_progress", "completed"])
      .withMessage("Status must be not_started, in_progress, or completed"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  assignClassToPathfinder,
)

// Update a pathfinder's class status
router.patch(
  "/:id/pathfinders",
  [
    param("id").isInt().withMessage("Class ID must be an integer"),
    body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    body("status")
      .isIn(["not_started", "in_progress", "completed"])
      .withMessage("Status must be not_started, in_progress, or completed"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  updatePathfinderClassStatus,
)

// Remove a pathfinder from a class
router.delete(
  "/:id/pathfinders/:pathfinderId",
  [
    param("id").isInt().withMessage("Class ID must be an integer"),
    param("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  removePathfinderFromClass,
)

export default router

