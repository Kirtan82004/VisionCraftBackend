import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { User } from "../../models/user.model.js";
import { Product } from "../../models/product.model.js";
import { getIO } from "../../config/socket.js";

/* =========================
   ADD TO WISHLIST
========================= */
const addToWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  const productExists = await Product.exists({ _id: productId });
  if (!productExists) {
    throw new ApiError(404, "Product not found");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { wishlist: productId } }, // prevents duplicates
    { new: true }
  ).select("wishlist");

  if (!user) throw new ApiError(404, "User not found");

  getIO().to(`user-${userId}`).emit("wishlistUpdated", {
    wishlist: user.wishlist,
  });

  return res.status(200).json(
    new ApiResponse(200, user.wishlist, "Product added to wishlist")
  );
});

/* =========================
   REMOVE FROM WISHLIST
========================= */
const removeFromWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;
  console.log("Removing product from wishlist:",req.body);

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { wishlist: productId } },
    { new: true }
  ).select("wishlist");

  if (!user) throw new ApiError(404, "User not found");

  getIO().to(`user-${userId}`).emit("wishlistUpdated", {
    wishlist: user.wishlist,
  });

  return res.status(200).json(
    new ApiResponse(200, user.wishlist, "Product removed from wishlist")
  );
});

/* =========================
   CLEAR WISHLIST
========================= */
const clearWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { wishlist: [] } },
    { new: true }
  ).select("wishlist");

  if (!user) throw new ApiError(404, "User not found");

  getIO().to(`user-${userId}`).emit("wishlistCleared");

  return res.status(200).json(
    new ApiResponse(200, [], "Wishlist cleared successfully")
  );
});

/* =========================
   GET USER WISHLIST
========================= */
const getUserWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId)
    .populate({
      path: "wishlist",
      select: "name price images ratings",
    })
    .select("wishlist");

  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json(
    new ApiResponse(200, user.wishlist, "Wishlist retrieved successfully")
  );
});

export {
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  getUserWishlist,
};
