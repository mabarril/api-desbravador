import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetStatistics,
} from "../controllers/asset.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(
    [
      query("condition")
        .optional()
        .isIn(["new", "good", "fair", "poor"])
        .withMessage("Condition must be new, good, fair, or poor"),
      query("search").optional().isString().withMessage("Search term must be a string"),
    ],
    validate,
    getAllAssets,
  )
  .post(
    [
      body("name").notEmpty().withMessage("Name is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("acquisitionDate").optional().isDate().withMessage("Acquisition date must be a valid date"),
      body("value").optional().isFloat({ min: 0 }).withMessage("Value must be a positive number"),
      body("condition")
        .optional()
        .isIn(["new", "good", "fair", "poor"])
        .withMessage("Condition must be new, good, fair, or poor"),
      body("location").optional().isString().withMessage("Location must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    createAsset,
  )

router.get("/statistics", restrictTo("admin", "director"), getAssetStatistics)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Asset ID must be an integer")], validate, getAsset)
  .patch(
    [
      param("id").isInt().withMessage("Asset ID must be an integer"),
      body("name").optional().notEmpty().withMessage("Name is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("acquisitionDate").optional().isDate().withMessage("Acquisition date must be a valid date"),
      body("value").optional().isFloat({ min: 0 }).withMessage("Value must be a positive number"),
      body("condition")
        .optional()
        .isIn(["new", "good", "fair", "poor"])
        .withMessage("Condition must be new, good, fair, or poor"),
      body("location").optional().isString().withMessage("Location must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    updateAsset,
  )
  .delete(
    [param("id").isInt().withMessage("Asset ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteAsset,
  )

export default router

