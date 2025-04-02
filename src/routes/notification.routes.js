import express from "express"
import { param, query } from "express-validator"
import {
  getAllNotifications,
  getNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../controllers/notification.controller.js"
import { protect } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get([query("isRead").optional().isBoolean().withMessage("Is read must be a boolean")], validate, getAllNotifications)

router.patch("/mark-all-read", markAllNotificationsAsRead)
router.delete("/delete-all", deleteAllNotifications)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Notification ID must be an integer")], validate, getNotification)
  .patch([param("id").isInt().withMessage("Notification ID must be an integer")], validate, markNotificationAsRead)
  .delete([param("id").isInt().withMessage("Notification ID must be an integer")], validate, deleteNotification)

export default router

