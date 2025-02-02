import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiError } from "../../utils/ApiError.js"
import { User } from "../../models/user.model.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import { Review } from "../../models/review.model.js"
import { Product } from "../../models/product.model.js"

const addProductReview = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({ success: false, message: "Product ID and rating are required." });
    }


    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }


    const existingReview = await Review.findOne({ product: productId, user: req.user._id });
    if (existingReview) {
      return res.status(400).json({ success: false, message: "You have already reviewed this product." });
    }


    const newReview = await Review.create({
      product: productId,
      user: req.user._id,
      rating,
      comment,
    });


    product.reviews.push(newReview._id);
    product.ratings =
      product.reviews.length > 1
        ? (product.ratings * (product.reviews.length - 1) + rating) / product.reviews.length
        : rating;
    await product.save();

    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
})
const editProductReview = asyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    if (!reviewId || !rating) {
      return res.status(400).json({ success: false, message: "Review ID and rating are required." });
    }

    const review = await Review.findById(reviewId).populate("product");
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to edit this review." });
    }

    const oldRating = review.rating;
    review.rating = rating;
    review.comment = comment || review.comment;

    await review.save();


    const product = review.product;
    product.ratings =
      (product.ratings * product.reviews.length - oldRating + rating) / product.reviews.length;
    await product.save();

    res.status(200).json({ success: true, message: "Review updated successfully.", review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
})
const deleteProductReview = asyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId).populate("product");
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this review." });
    }

    const product = review.product;

    // Remove the review from the product
    product.reviews = product.reviews.filter((revId) => revId.toString() !== reviewId);
    if (product.reviews.length > 0) {
      product.ratings =
        (product.ratings * (product.reviews.length + 1) - review.rating) / product.reviews.length;
    } else {
      product.ratings = 0; // No reviews left, reset ratings
    }
    await product.save();

    // Delete the review
    await review.remove();

    res.status(200).json({ success: true, message: "Review deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
})
const getProductReviews = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).populate({
      path: "reviews",
      populate: { path: "user", select: "fullName email" },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    res.status(200).json({ success: true, reviews: product.reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
})
export {
  addProductReview,
  editProductReview,
  deleteProductReview,
  getProductReviews

}