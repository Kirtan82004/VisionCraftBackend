import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiError } from "../../utils/ApiError.js"
import { User } from "../../models/user.model.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import { Product } from "../../models/product.model.js"

const getUserWishlist = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id; 
         console.log("hii",userId)
        const user = await User.findById(userId).populate("wishlist", "name price images");
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
    
        res.status(200).json({ message: "Wishlist retrieved successfully", wishlist: user.wishlist || [] });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to retrieve wishlist" });
      }
})

const addToWishlist = asyncHandler(async (req, res) => {
    try {
      //console.log("body",req.body)
        const userId = req.user._id;
        //console.log("user",userId)
        const productId  = req.body.product;
         //console.log("product",productId)
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
    
      
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
    
        if (user.wishlist.includes(productId)) {
          return res.status(400).json({ message: "Product already in wishlist" });
        }
    
        user.wishlist.push(productId);
        await user.save();
    
        return res
        .status(201)
        .json(new ApiResponse(200,{wishlist:user.wishlist},"Product added to wishlist"))
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add product to wishlist" });
      }

})
const removeFromWishlist = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        //console.log("body",req.body)
        const productId  = req.body.product._id;
        //console.log("productid",productId)
    
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
    
        if (!user.wishlist.includes(productId)) {
          return res.status(400).json({ message: "Product not found in wishlist" });
        }
    
        user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
        await user.save();
    
        res.status(200).json({ message: "Product removed from wishlist", wishlist: user.wishlist });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to remove product from wishlist" });
      }
})
const clearWishlist = asyncHandler(async(req,res)=>{
    try {
        const userId = req.user?._id
        const user = await User.findById(userId)
        if (!user) {
            throw new ApiError(404, "   user  not found")
        }
        user.wishlist = []
        await user.save()
        return res
        .status(200)
        .json(new ApiResponse(200, user.wishlist, "Wishlist cleared successfully"))
    } catch (error) {
        return res
        .status(500)
        .json(new ApiError(500, "error occured while clearing wishlist"))
    
        
    }
})
export {
    getUserWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist

}
