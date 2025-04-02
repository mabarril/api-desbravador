import express from "express"
import { body, param } from "express-validator"
import {
  getAllSpecialties,
  getSpecialty,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  assignSpecialtyToPathfinder,
  updatePathfinderSpecialtyStatus,
  removePathfinderFromSpecialty,
} from "../controllers/specialty.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(getAllSpecialties)
  .post(
    [
      body("name").notEmpty().withMessage("Name is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("requirements").optional().isString().withMessage("Requirements must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    createSpecialty,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Specialty ID must be an integer")], validate, getSpecialty)
  .patch(
    [
      param("id").isInt().withMessage("Specialty ID must be an integer"),
      body("name").optional().isString().withMessage("Name must be a string"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("requirements").optional().isString().withMessage("Requirements must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    updateSpecialty,
  )
  .delete(
    [param("id").isInt().withMessage("Specialty ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteSpecialty,
  )

// Assign a specialty to a pathfinder
router.post(
  "/:id/pathfinders",
  [
    param("id").isInt().withMessage("Specialty ID must be an integer"),
    body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    body("status")
      .optional()
      .isIn(["not_started", "in_progress", "completed"])
      .withMessage("Status must be not_started, in_progress, or completed"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  assignSpecialtyToPathfinder,
)

// Update a pathfinder's specialty status
router.patch(
  "/:id/pathfinders",
  [
    param("id").isInt().withMessage("Specialty ID must be an integer"),
    body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
    body("status")
      .isIn(["not_started", "in_progress", "completed"])
      .withMessage("Status must be not_started, in_progress, or completed"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  updatePathfinderSpecialtyStatus,
)

// Remove a pathfinder from a specialty
router.delete(
  "/:id/pathfinders/:pathfinderId",
  [
    param("id").isInt().withMessage("Specialty ID must be an integer"),
    param("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  removePathfinderFromSpecialty,
)

export default router

