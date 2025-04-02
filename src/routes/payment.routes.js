import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentStatistics,
} from "../controllers/payment.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Restrict all payment routes to admin and director
router.use(restrictTo("admin", "director"))

router
  .route("/")
  .get(
    [
      query("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      query("referenceType")
        .optional()
        .isIn(["registration", "monthly_fee", "event", "other"])
        .withMessage("Reference type must be registration, monthly_fee, event, or other"),
      query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
      query("endDate").optional().isDate().withMessage("End date must be a valid date"),
      query("paymentMethod")
        .optional()
        .isIn(["cash", "credit_card", "bank_transfer", "other"])
        .withMessage("Payment method must be cash, credit_card, bank_transfer, or other"),
    ],
    validate,
    getAllPayments,
  )
  .post(
    [
      body("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be a positive number"),
      body("paymentDate").isDate().withMessage("Valid payment date is required"),
      body("paymentMethod")
        .isIn(["cash", "credit_card", "bank_transfer", "other"])
        .withMessage("Payment method must be cash, credit_card, bank_transfer, or other"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("referenceType")
        .isIn(["registration", "monthly_fee", "event", "other"])
        .withMessage("Reference type must be registration, monthly_fee, event, or other"),
      body("referenceId").optional().isInt().withMessage("Reference ID must be an integer"),
    ],
    validate,
    createPayment,
  )

router.get(
  "/statistics",
  [
    query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
    query("endDate").optional().isDate().withMessage("End date must be a valid date"),
  ],
  validate,
  getPaymentStatistics,
)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Payment ID must be an integer")], validate, getPayment)
  .patch(
    [
      param("id").isInt().withMessage("Payment ID must be an integer"),
      body("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      body("amount").optional().isFloat({ min: 0.01 }).withMessage("Amount must be a positive number"),
      body("paymentDate").optional().isDate().withMessage("Valid payment date is required"),
      body("paymentMethod")
        .optional()
        .isIn(["cash", "credit_card", "bank_transfer", "other"])
        .withMessage("Payment method must be cash, credit_card, bank_transfer, or other"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("referenceType")
        .optional()
        .isIn(["registration", "monthly_fee", "event", "other"])
        .withMessage("Reference type must be registration, monthly_fee, event, or other"),
      body("referenceId").optional().isInt().withMessage("Reference ID must be an integer"),
    ],
    validate,
    updatePayment,
  )
  .delete([param("id").isInt().withMessage("Payment ID must be an integer")], validate, deletePayment)

export default router

