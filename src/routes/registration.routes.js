import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllRegistrations,
  getRegistration,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  approveRegistration,
  rejectRegistration,
  markRegistrationAsPaid,
} from "../controllers/registration.controller.js"
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
      query("status")
        .optional()
        .isIn(["pending", "approved", "rejected"])
        .withMessage("Status must be pending, approved, or rejected"),
      query("paymentStatus")
        .optional()
        .isIn(["pending", "paid", "waived"])
        .withMessage("Payment status must be pending, paid, or waived"),
    ],
    validate,
    getAllRegistrations,
  )
  .post(
    [
      body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
      body("registrationDate").optional().isDate().withMessage("Registration date must be a valid date"),
      body("status")
        .optional()
        .isIn(["pending", "approved", "rejected"])
        .withMessage("Status must be pending, approved, or rejected"),
      body("paymentStatus")
        .optional()
        .isIn(["pending", "paid", "waived"])
        .withMessage("Payment status must be pending, paid, or waived"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    createRegistration,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Registration ID must be an integer")], validate, getRegistration)
  .patch(
    [
      param("id").isInt().withMessage("Registration ID must be an integer"),
      body("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      body("registrationDate").optional().isDate().withMessage("Registration date must be a valid date"),
      body("status")
        .optional()
        .isIn(["pending", "approved", "rejected"])
        .withMessage("Status must be pending, approved, or rejected"),
      body("paymentStatus")
        .optional()
        .isIn(["pending", "paid", "waived"])
        .withMessage("Payment status must be pending, paid, or waived"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    updateRegistration,
  )
  .delete(
    [param("id").isInt().withMessage("Registration ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteRegistration,
  )

// Approve a registration
router.patch(
  "/:id/approve",
  [param("id").isInt().withMessage("Registration ID must be an integer")],
  validate,
  restrictTo("admin", "director"),
  approveRegistration,
)

// Reject a registration
router.patch(
  "/:id/reject",
  [
    param("id").isInt().withMessage("Registration ID must be an integer"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  validate,
  restrictTo("admin", "director"),
  rejectRegistration,
)

// Mark registration as paid
router.patch(
  "/:id/mark-paid",
  [param("id").isInt().withMessage("Registration ID must be an integer")],
  validate,
  restrictTo("admin", "director"),
  markRegistrationAsPaid,
)

export default router

