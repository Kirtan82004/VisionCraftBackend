import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Review } from "../../models/review.model.js";
import { Product } from "../../models/product.model.js";
import { getIO } from "../../config/socket.js";

/* =========================
   ADD REVIEW
========================= */
const addProductReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = await Product.findById(productId).session(session);
    if (!product) throw new ApiError(404, "Product not found");

    const alreadyReviewed = await Review.findOne({
      product: productId,
      user: userId,
    }).session(session);

    if (alreadyReviewed) {
      throw new ApiError(400, "You already reviewed this product");
    }

    const review = await Review.create(
      [{ product: productId, user: userId, rating, comment }],
      { session }
    );

    product.reviews.push(review[0]._id);

    const totalRating =
      product.ratings * product.reviews.length + rating;

    product.reviewsCount = product.reviews.length;
    product.ratings = totalRating / product.reviewsCount;

    await product.save({ session });

    await session.commitTransaction();
    session.endSession();

    await review[0].populate("user", "fullName email");

    getIO().to(`product-${productId}`).emit("reviewAdded", {
      productId,
      review: review[0],
    });

    return res.status(201).json(
      new ApiResponse(201, review[0], "Review added successfully")
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

/* =========================
   EDIT REVIEW
========================= */
const editProductReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const review = await Review.findById(reviewId).session(session);
    if (!review) throw new ApiError(404, "Review not found");

    if (review.user.toString() !== userId.toString()) {
      throw new ApiError(403, "Unauthorized");
    }

    const product = await Product.findById(review.product).session(session);

    const oldRating = review.rating;

    review.rating = rating;
    review.comment = comment || review.comment;
    await review.save({ session });

    product.ratings =
      (product.ratings * product.reviewsCount - oldRating + rating) /
      product.reviewsCount;

    await product.save({ session });

    await session.commitTransaction();
    session.endSession();

    getIO().to(`product-${product._id}`).emit("reviewUpdated", {
      reviewId,
      rating,
      comment,
    });

    return res.status(200).json(
      new ApiResponse(200, review, "Review updated")
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

/* =========================
   DELETE REVIEW
========================= */
const deleteProductReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const review = await Review.findById(reviewId).session(session);
    if (!review) throw new ApiError(404, "Review not found");

    if (review.user.toString() !== userId.toString()) {
      throw new ApiError(403, "Unauthorized");
    }

    const product = await Product.findById(review.product).session(session);

    product.reviews.pull(reviewId);
    product.reviewsCount -= 1;

    if (product.reviewsCount === 0) {
      product.ratings = 0;
    } else {
      product.ratings =
        (product.ratings * (product.reviewsCount + 1) - review.rating) /
        product.reviewsCount;
    }

    await product.save({ session });
    await review.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    getIO().to(`product-${product._id}`).emit("reviewDeleted", {
      reviewId,
      productId: product._id,
    });

    return res.status(200).json(
      new ApiResponse(200, null, "Review deleted")
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

/* =========================
   GET REVIEWS
========================= */
const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const reviews = await Review.find({ product: productId })
    .populate("user", "fullName email")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, reviews, "Reviews fetched")
  );
});

export {
  addProductReview,
  editProductReview,
  deleteProductReview,
  getProductReviews,
};
