import { User } from "../../models/user.model.js"
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import nodemailer from "nodemailer"
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ioInstance } from "../../index.js";



const sendEmailNotification =  asyncHandler(async (req, res) => {
    const { email,subject, message } = req.body;
    const userId = req.user._id;
    if ( !email || !subject || !message) {
        throw new ApiError(400, "Please fill all fields");
    }
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,

        }
    });
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        text: message,
    };
   try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    if (ioInstance) {
      ioInstance.emit("notificationSent", {
        type: "email",
        to: email,
        subject,
        message,
      });
    }


    return res
      .status(200)
      .json(new ApiResponse(200, null, "Email sent successfully"));
  } catch (err) {
    console.error("Email error:", err);
    throw new ApiError(500, "Failed to send email");
  }
})
const sendBulkNotifications = asyncHandler(async (req, res) => {
  try {
      const { subject, message,emails } = req.body;
      console.log("emails",emails)
      const userId = req.user._id // Expecting an array of user IDs
  if (!userId || !subject || !message) {
      throw new ApiError(400, "User IDs, subject, and message are required");
  }
  const user = await User.findById(userId);
  if (!user) {
      throw new ApiError(404, "No users found");
  }
  const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
      }
  
  });
  const emailPromises = emails.map(email => {
      const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject,
          text: message,
      }
      return transporter.sendMail(mailOptions)
  })
  await Promise.all(emailPromises);
     if (ioInstance) {
      ioInstance.emit("bulkNotificationSent", {
        type: "bulk",
        subject,
        message,
        total: emails.length,
      });
    }
  return res
  .status(200)
  .json(new ApiResponse(200,{sentTo:emails.length},"Bulk emails sent successfully"))
  } catch (error) {
    return res
    .status(500)
    .json(new ApiError(500,error.message))
    
  }
})


export {
    sendEmailNotification,
    sendBulkNotifications

}