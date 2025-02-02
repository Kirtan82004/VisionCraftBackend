import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiError } from "../../utils/ApiError.js"
import { Product } from "../../models/product.model.js"
import { ApiResponse } from "../../utils/ApiResponse.js"



const getAllProducts = asyncHandler(async (req, res) => {
    try{
    console.log(req.body)
        const  { category, minPrice, maxPrice, brand, search } = req.body;
         console.log(category)
         const matchQuery = {
             $and: [
                 category ? { category: category} : {},
                 minPrice ? { price: { $gte: parseFloat(minPrice) } } : {},
                 maxPrice ? { price: { $lte: parseFloat(maxPrice) } } : {},
                 brand ? { brand: new RegExp(brand, "i") } : {},
                 search
                     ? {
                         $or: [
                             { name: new RegExp(search, "i") },
                             { description: new RegExp(search, "i") }
                         ]
                     }
                     : {}
             ]
         };
         const pipeline = [
             { $match: matchQuery },
             {
                 $project: {
                     name: 1,
                     category: 1,
                     price: 1,
                     brand: 1,
                     description: 1,
                     stock: 1,
                     ratings: 1
                 }
             }
         ];
         const products = await Product.aggregate(pipeline);
         console.log(products)
         if(!products){
             throw new ApiError(404, "No products found")
         }
         return res
             .status(200)
             .json(new ApiResponse(200, products, "Products retrieved successfully"))
 
 
     } catch (error) {
         console.log(error.message)
         return res
             .status(500)
             .json(new ApiError(500, error.message || "error occured while getting all products"))
 
     }
 })

 const getProductById = asyncHandler(async (req, res) => {
try {
        const id = req.params.id;
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
    getProductById
 }