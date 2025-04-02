import express from "express"
import { body, param } from "express-validator"
import {
  getAllSettings,
  getSetting,
  createSetting,
  updateSetting,
  deleteSetting,
} from "../controllers/setting.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Get all settings - accessible to all authenticated users
router.get("/", getAllSettings)

// Get a specific setting - accessible to all authenticated users
router.get("/:key", [param("key").isString().withMessage("Key must be a string")], validate, getSetting)

// Admin only routes
router.use(restrictTo("admin"))

router.post(
  "/",
  [
    body("key").isString().withMessage("Key must be a string"),
    body("value").isString().withMessage("Value must be a string"),
    body("description").optional().isString().withMessage("Description must be a string"),
    body("isPublic").isBoolean().withMessage("Is public must be a boolean"),
  ],
  validate,
  createSetting,
)

router.patch(
  "/:key",
  [
    param("key").isString().withMessage("Key must be a string"),
    body("value").optional().isString().withMessage("Value must be a string"),
    body("description").optional().isString().withMessage("Description must be a string"),
    body("isPublic").optional().isBoolean().withMessage("Is public must be a boolean"),
  ],
  validate,
  updateSetting,
)

router.delete("/:key", [param("key").isString().withMessage("Key must be a string")], validate, deleteSetting)

export default router

