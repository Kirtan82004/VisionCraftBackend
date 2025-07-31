import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
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
        if (brand) filters.push({ brand: new RegExp(brand, "i") });
        if (search) {
            filters.push({
                $or: [
                    { name: new RegExp(search, "i") },
                    { description: new RegExp(search, "i") }
                ]
            });
        }

        // Apply filters only if there are conditions
        if (filters.length > 0) {
            matchQuery.$and = filters;
        }

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
            }
        ];

        const products = await Product.aggregate(pipeline);
        

        if (!products || products.length === 0) {
            throw new ApiError(404, "No products found");
        }

        return res
            .status(200)
            .json(new ApiResponse(200, products, "Products retrieved successfully"));
    } catch (error) {
        console.log(error.message);
        return res
            .status(500)
            .json(new ApiError(500, error.message || "Error occurred while getting all products"));
    }
});


 const getProductDetails = asyncHandler(async (req, res) => {
try {
        const id = req.params.productId;
        const product = await Product.findById(id);
        if(!product){
            throw new ApiError(404,'Product not found')
        }
        return res
            .status(200)
            .json(new ApiResponse(200, product, "Product retrieved successfully"))
} catch (error) {
    return res
        .status(500)
        .json(new ApiError(500, error.message || "error occured while getting product"))
}
 })

 export {
    getAllProducts,
    getProductDetails
 }