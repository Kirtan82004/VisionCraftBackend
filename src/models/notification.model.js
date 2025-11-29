import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",  // References the User model.
      required: true,
    },
    type: {
      type: String,
      enum: ["Order", "Promotion", "System", "General"], // Notification categories.
      default: "General",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false, // Tracks if the user has read the notification.
    },
    metadata: {
      type: Schema.Types.Mixed, // Additional data (e.g., order ID, promo code).
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds `createdAt` and `updatedAt`.
  }
);

export const Notification = mongoose.model("Notification", notificationSchema);
