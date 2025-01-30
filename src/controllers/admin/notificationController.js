import { User } from "../../models/user.model.js"
import { Product } from "../../models/product.model.js"
import { Order } from "../../models/order.model.js"
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import nodemailer from "nodemailer"
import { ApiResponse } from "../../utils/ApiResponse.js";


const sendEmailNotification = asyncHandler(async (req, res) => {
    const { userId, subject, message } = req.body;
    if (!userId || !subject || !message) {
        throw new ApiError(400, "Please fill all fields");
    }
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const transporter = nodemailer.createTransport({
        service: "gamail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,

        }
    });
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: subject,
        text: message,
    };
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.log(err);
            return res
                .status(500)
                .json(new ApiError(500, "Failed to send email"));
        }
        return res
            .status(200)
            .json(new ApiResponse(200, "Email sent successfully"));
    })
})
const sendBulkNotifications = asyncHandler(async (req, res) => {
  try {
      const { userIds, subject, message } = req.body;
  if (!userIds || !subject || !message) {
      throw new ApiError(400, "User IDs, subject, and message are required");
  }
  const users = await User.find({ '_id': { $in: userIds } });
  if (!users) {
      throw new ApiError(404, "No users found");
  }
  const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
      }
  
  });
  const emailPromises = users.map(user => {
      const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: subject,
          text: message,
      }
      return transporter.sendMail(mailOptions)
  })
  await Promise.all(emailPromises);
  return res
  .status(200)
  .json(new ApiResponse(200,{sentTo:users.length},"Bulk emails sent successfully"))
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