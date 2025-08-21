import { Product } from "../../models/product.model.js"
import { Category } from "../../models/category.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js"
import { io } from "../../app.js";


const createProduct = asyncHandler(async (req, res) => {
    try {
        const { name, price, description, category, brand, stock } = req.body;
        if(!category){
            throw new ApiError(400, "Category is required");
        }
        const categoryName = category.trim();

        const categoryExists = await Category.findOne({ name: categoryName });
        if (!categoryExists) {
            return res.status(400).json({ message: "Invalid category" });
        }


        const productExist = await Product.findOne({
            $and: [{ name }, { price }]
        })
        if (productExist) {
            throw new ApiError(400, "Product already exists")
        }
        const singleImage = req.files?.image ? req.files.image[0].path : null;
        const multipleImages = req.files?.images
            ? req.files.images.map((file) => file.path) : [];

        const singleImageUrl = singleImage ? await uploadOnCloudinary(singleImage) : null;
        const multipleImageUrls = [];
        for (let i = 0; i < multipleImages.length; i++) {
            const imageUrl = await uploadOnCloudinary(multipleImages[i]);
            multipleImageUrls.push(imageUrl);
        }
        console.log("imagearray",multipleImageUrls)


        const allImages = singleImageUrl? [singleImageUrl, ...multipleImageUrls] : multipleImageUrls;

        if (allImages.length === 0) {
            return res.status(400).json({ message: "At least one image is required" });
        }
        const newProduct = new Product({
            name,
            price,
            description,
            category: categoryExists?._id || "",
            stock,
            brand,
            images: allImages

        })
        console.log("allimages",allImages)

        await newProduct.save();
        io.emit("product", {
            action: "create",
            productName:newProduct.name,
            meaasge:`New product ${newProduct.name} created`
        });
        res.json({ message: "Product created successfully" });
    } catch (error) {
        console.log(error.message)
        return res
            .status(500)
            .json(new ApiError(500, error.message || "error occured while creating product"))

    }

})

const updateProduct = asyncHandler(async (req, res) => {
    try {
        console.log(req.body)
        const { name, price, description, id, brand, stock } = req.body;
        console.log(name)
        console.log(price)
        console.log(description)
        const updatedProduct = await Product.findByIdAndUpdate(id,
            {
                name,
                price,
                description,
                brand,
                stock
            },
            {
                new: true
            }
        )
        if (!updatedProduct) {
            throw new ApiError(404, "Product not found")
        }

        await updatedProduct.save()
        io.emit("product", {
            action: "update",
            product: updatedProduct,
        });
        return res
            .status(200)
            .json(new ApiResponse(200, updatedProduct, "Product updated successfully"))
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, error.message || "error occured while updating product"))
    }
})
const deleteProduct = asyncHandler(async (req, res) => {
    try {


        const { id } = req.body;
        console.log(id)
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            throw new ApiError(404, "Product not found");
        }
        io.emit("product", {
            action: "delete",
            productId:product._id,
            productName:product.name,
            message: `Product ${product._id} has been deleted`,
        })  
        return res
            .status(200)
            .json(new ApiResponse(200, product, "Product deleted successfully"))
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, error.message || "error occured while deleting product"))
    }
})

export {
    createProduct,
    updateProduct,
    deleteProduct,

}