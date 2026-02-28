import { User } from "../../models/user.model.js";
import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getIO } from "../../config/socket.js";

// Get all users with totalOrders count
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "customer",
        as: "orders",
      },
    },
    {
      $addFields: {
        totalOrders: { $size: "$orders" },
      },
    },
    {
      $project: {
        password: 0,
        refreshToken: 0,
        orders: 0, // exclude full orders
      },
    },
  ]);

  res.status(200).json({
    success: true,
    count: users.length,
    users,
  });
});

// Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "customer",
        as: "orders",
      },
    },
    {
      $addFields: { totalOrders: { $size: "$orders" } },
    },
    { $project: { password: 0, refreshToken: 0, orders: 0 } },
  ]);

  if (!user.length) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.status(200).json({ success: true, user: user[0] });
});

// Update user
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const formData = req.body;

  const updatedUser = await User.findByIdAndUpdate(id, formData, {
    new: true,
    runValidators: true,
  }).select("-password -refreshToken");

  if (!updatedUser) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // 🔥 Emit socket event for admin dashboard
  const io = getIO();
  if (io) io.emit("userUpdated", { userId: id, updatedUser });

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    user: updatedUser,
  });
});

// Delete user
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedUser = await User.findByIdAndDelete(id);

  if (!deletedUser) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // 🔥 Emit socket event for admin dashboard
  const io = getIO();
  if (io) io.emit("userDeleted", { userId: id });

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
    user: deletedUser,
  });
});

export { getAllUsers, getUserById, updateUser, deleteUser };
