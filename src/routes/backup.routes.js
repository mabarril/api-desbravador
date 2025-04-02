import express from "express"
import { body, param } from "express-validator"
import {
  createDatabaseBackup,
  restoreDatabaseFromBackup,
  getAllBackups,
  deleteBackupFile,
} from "../controllers/backup.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)
router.use(restrictTo("admin"))

router
  .route("/")
  .get(getAllBackups)
  .post(
    [body("filename").optional().isString().withMessage("Filename must be a string")],
    validate,
    createDatabaseBackup,
  )

router
  .route("/:filename")
  .post([param("filename").isString().withMessage("Filename must be a string")], validate, restoreDatabaseFromBackup)
  .delete([param("filename").isString().withMessage("Filename must be a string")], validate, deleteBackupFile)

export default router

