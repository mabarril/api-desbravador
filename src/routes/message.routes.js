import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllMessages,
  getMessage,
  sendMessage,
  deleteMessage,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../controllers/message.controller.js"
import { protect } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get([query("folder").isIn(["inbox", "sent"]).withMessage("Folder must be inbox or sent")], validate, getAllMessages)
  .post(
    [
      body("recipientId").isInt().withMessage("Recipient ID must be an integer"),
      body("subject").optional().isString().withMessage("Subject must be a string"),
      body("content").notEmpty().withMessage("Content is required"),
      body("parentId").optional().isInt().withMessage("Parent ID must be an integer"),
    ],
    validate,
    sendMessage,
  )

router.get("/unread-count", getUnreadCount)
router.patch("/mark-all-read", markAllAsRead)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Message ID must be an integer")], validate, getMessage)
  .delete([param("id").isInt().withMessage("Message ID must be an integer")], validate, deleteMessage)

router.patch("/:id/mark-read", [param("id").isInt().withMessage("Message ID must be an integer")], validate, markAsRead)

export default router

