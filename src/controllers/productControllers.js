import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { Review } from "../models/review.model.js"
import { Product } from "../models/product.model.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { Category } from "../models/category.model.js"


const getAllProducts = asyncHandler(async (req, res) => {

    try {
        console.log(req.body);
        const { category, minPrice, maxPrice, brand, search } = req.body;

        // Create dynamic match query
        const matchQuery = {};
        const filters = [];

        if (category) {
            const categoryDoc= await Category.findOne({name:category});
            console.log(categoryDoc);
            if(!categoryDoc) {
                throw new ApiError('Category not found', 404);
            }
            filters.push({ category: categoryDoc?._id });
            }
        
        if (minPrice) filters.push({ price: { $gte: parseFloat(minPrice) } });
        if (maxPrice) filters.push({ price: { $lte: parseFloat(maxPrice) } });
        //brand filter
        if (brand) filters.push({ brand: new RegExp(brand, "i") });
        //search filter
        if (search) {
            filters.push({
                $or: [
                    { name: new RegExp(search, "i") },
                    { description: new RegExp(search, "i") }
                ]
            });
        }

        // Apply filters only if there are conditions
        if (filters.length > 0) matchQuery.$and = filters;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10
        const skip =(parseInt(page)-1)*parseInt(limit);
        ;

        const pipeline = [
            { $match: matchQuery },
            {
                $project: {
                    name: 1,
                    category:1,
                    price: 1,
                    brand: 1,
                    images:1,
                    description: 1,
                    stock: 1,
                    ratings: 1
                }
            },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ];

        const products = await Product.aggregate(pipeline);
        const totalProducts =await Product.countDocuments(matchQuery);

        if (!products || products.length === 0) {
            throw new ApiError(404, "No products found");
        }

        return res
            .status(200)
            .json(
                new ApiResponse(200, {
                    total: totalProducts,
                    page: parseInt(page),
                    pages: Math.ceil(totalProducts / limit),
                    data: products
                }, "Products retrieved successfully")
                );
    } catch (error) {
        console.log(error.message);
        return res
            .status(500)
            .json(new ApiError(500, error.message || "Error occurred while getting all products"));
    }
});
const getProductDetails = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product and populate category
    const product = await Product.findById(productId)
    //  .populate("category", "name")
      .lean();

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    // Fetch reviews for this product and populate user
    const reviews = await Review.find({ product: productId })
      .populate("user", "fullName email")
      .sort({ createdAt: -1 }) // newest first
      .lean();

    // Calculate average rating and total reviews
    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    // Attach additional computed fields
    product.reviews = reviews;
    product.totalReviews = totalReviews;
    product.averageRating = parseFloat(avgRating.toFixed(1));
    product.inStock = product.stock > 0;

    return res
      .status(200)
      .json(new ApiResponse(200, product, "Product retrieved successfully"));
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Error occurred while getting product"));
  }
});



 export {
    getAllProducts,
    getProductDetails
 }