import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../../models/user.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Product } from "../../models/product.model.js";
import { ioInstance } from "../../index.js";   // ✅ import ioInstance

const addToWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const {productId} = req.body;
    console.log("Received addToWishlist request:",req.body);
    console.log("Adding to wishlist:", { userId, productId });

    const product = await Product.findById(productId);
    console.log("Product found:", product);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const user = await User.findById(userId);
    console.log("User found:", user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.wishlist.some(id => id.toString() === productId)) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();
    console.log("Added to wishlist:",user.wishlist);

    // 🔥 Emit event
    if (ioInstance) {
      ioInstance.emit("wishlistUpdated", { userId, wishlist: user.wishlist });
    }

    return res.status(201).json(new ApiResponse(200, { wishlist: user.wishlist }, "Product added to wishlist"));
  } catch (error) {
    res.status(500).json({ message: "Failed to add product to wishlist" });
  }
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const productId = req.body.product._id;
    console.log("Removing from wishlist:", { userId, productId });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.wishlist.some(id => id.toString() === productId)) {
      return res.status(400).json({ message: "Product not found in wishlist" });
    }

    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    await user.save();

    console.log("Removed from wishlist:", { userId, productId });

    // 🔥 Emit event
    if (ioInstance) {
      ioInstance.emit("wishlistUpdated", { userId, wishlist: user.wishlist });
    }

    res.status(200).json({ message: "Product removed from wishlist", wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove product from wishlist" });
  }
});

const clearWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    user.wishlist = [];
    await user.save();

    // 🔥 Emit event
    if (ioInstance) {
      ioInstance.emit("wishlistCleared", { userId });
    }

    return res.status(200).json(new ApiResponse(200, user.wishlist, "Wishlist cleared successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Error occurred while clearing wishlist"));
  }
});

const getUserWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;  
    const user = await User.findById(userId).populate("wishlist");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(new ApiResponse(200, user.wishlist, "Wishlist retrieved successfully"));
  }
  catch (error) {
    res.status(500).json({ message: "Failed to retrieve wishlist" });
  }
});

export {
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  getUserWishlist
}