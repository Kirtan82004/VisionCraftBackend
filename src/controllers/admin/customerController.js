import {User} from "../../models/user.model.js";
import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Get all users

const getAllUsers = async (req, res) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: "orders",               // 👈 Order collection
          localField: "_id",
          foreignField: "customer",
          as: "orders"
        }
      },
      {
        $addFields: {
          totalOrders: { $size: "$orders" }
        }
      },
      {
        $project: {
          password: 0,
          refreshToken: 0,
          orders: 0      // 👈 full orders nahi bhej rahe
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};




const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(id) },
    },
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
        orders: 0,
      },
    },
  ]);

  if (!user.length) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    user: user[0],
  });
});

// Update user
const updateUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const formData = req.body;
    console.log("formdata",formData)

    const updatedUser = await User.findByIdAndUpdate(id, formData, {
      new: true, // return updated document
      runValidators: false, // ensure schema validation
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
});

// Delete user
const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      user: deletedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

export { getAllUsers, updateUser, deleteUser,getUserById };