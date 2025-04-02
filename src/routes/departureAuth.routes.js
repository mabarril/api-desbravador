import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllDepartureAuths,
  getDepartureAuth,
  createDepartureAuth,
  updateDepartureAuth,
  deleteDepartureAuth,
  authorizeDeparture,
  setParentAuthorization,
} from "../controllers/departureAuth.controller.js"
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
      query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
      query("endDate").optional().isDate().withMessage("End date must be a valid date"),
      query("authorized").optional().isBoolean().withMessage("Authorized must be a boolean"),
    ],
    validate,
    getAllDepartureAuths,
  )
  .post(
    [
      body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
      body("departureDate").isDate().withMessage("Departure date must be a valid date"),
      body("returnDate").isDate().withMessage("Return date must be a valid date"),
      body("destination").notEmpty().withMessage("Destination is required"),
      body("purpose").optional().isString().withMessage("Purpose must be a string"),
      body("parentAuthorization").optional().isBoolean().withMessage("Parent authorization must be a boolean"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    createDepartureAuth,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Departure authorization ID must be an integer")], validate, getDepartureAuth)
  .patch(
    [
      param("id").isInt().withMessage("Departure authorization ID must be an integer"),
      body("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      body("departureDate").optional().isDate().withMessage("Departure date must be a valid date"),
      body("returnDate").optional().isDate().withMessage("Return date must be a valid date"),
      body("destination").optional().notEmpty().withMessage("Destination is required"),
      body("purpose").optional().isString().withMessage("Purpose must be a string"),
      body("authorizedBy").optional().isInt().withMessage("Authorized by must be an integer"),
      body("parentAuthorization").optional().isBoolean().withMessage("Parent authorization must be a boolean"),
      body("authorizationDate").optional().isDate().withMessage("Authorization date must be a valid date"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director", "leader"),
    updateDepartureAuth,
  )
  .delete(
    [param("id").isInt().withMessage("Departure authorization ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteDepartureAuth,
  )

// Authorize a departure
router.patch(
  "/:id/authorize",
  [param("id").isInt().withMessage("Departure authorization ID must be an integer")],
  validate,
  restrictTo("admin", "director"),
  authorizeDeparture,
)

// Set parent authorization
router.patch(
  "/:id/parent-authorization",
  [
    param("id").isInt().withMessage("Departure authorization ID must be an integer"),
    body("parentAuthorization").isBoolean().withMessage("Parent authorization must be a boolean"),
  ],
  validate,
  restrictTo("admin", "director", "leader"),
  setParentAuthorization,
)

export default router

