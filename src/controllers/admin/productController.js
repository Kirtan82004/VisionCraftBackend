import { Product } from "../../models/product.model.js"
import { Category } from "../../models/category.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js"
import { ioInstance } from "../../index.js";


const getAllProducts = asyncHandler(async (req, res) => {
    try {
        const products = await Product.find()
            .populate("category", "name")
            .populate("reviews.user", "fullName email")

        return res
            .status(200)
            .json(new ApiResponse(200, products, "Products retrieved successfully"));
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, error.message || "Error occurred while retrieving products"));
    }
});
const getProductById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id)
            .populate("category", "name")
            .populate("reviews.user", "fullName email");

        if (!product) {
            throw new ApiError(404, "Product not found");
        }
        return res
            .status(200)
            .json(new ApiResponse(200, product, "Product retrieved successfully"));
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, error.message || "Error occurred while retrieving product"));
    }
});
const createProduct = asyncHandler(async (req, res) => {
    try {
        const { name, price, description, category, brand, stock } = req.body;

        if (!category) {
            throw new ApiError(400, "Category is required");
        }

        const categoryName = category.trim();

        // 🔹 Check if category exists
        let categoryExists = await Category.findOne({ name: categoryName });

        // 🔹 If not exists, create a new one
        if (!categoryExists) {
            categoryExists = await Category.create({ name: categoryName });
            console.log(`🆕 New Category Created: ${categoryName}`);
        }

        // 🔹 Check if product with same name & price already exists
        const productExist = await Product.findOne({
            $and: [{ name }, { price }]
        });
        if (productExist) {
            throw new ApiError(400, "Product already exists");
        }

        // 🔹 Handle images
        const singleImage = req.files?.image ? req.files.image[0].path : null;
        const multipleImages = req.files?.images
            ? req.files.images.map((file) => file.path)
            : [];

        const singleImageUrl = singleImage ? await uploadOnCloudinary(singleImage) : null;

        const multipleImageUrls = [];
        for (let i = 0; i < multipleImages.length; i++) {
            const imageUrl = await uploadOnCloudinary(multipleImages[i]);
            multipleImageUrls.push(imageUrl);
        }

        const allImages = singleImageUrl
            ? [singleImageUrl, ...multipleImageUrls]
            : multipleImageUrls;

        if (allImages.length === 0) {
            throw new ApiError(400, "At least one product image is required");
        }

        // 🔹 Create and save product
        const newProduct = new Product({
            name,
            price,
            description,
            category: categoryExists._id,
            stock,
            brand,
            images: allImages
        });

        await newProduct.save();
        if (ioInstance) {
            ioInstance.emit("productCreated", newProduct);
        }
        return res
            .status(201)
            .json(new ApiResponse(201, newProduct, "Product created successfully"));
    } catch (error) {
        console.error("Error while creating product:", error.message);
        return res
            .status(500)
            .json(new ApiError(500, error.message || "Error occurred while creating product"));
    }
});

const updateProduct = asyncHandler(async (req, res) => {
    try {
        console.log(req.body)
        const { id } = req.params;
        const { name, price, description, brand, stock } = req.body;
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
        if (ioInstance) {
            ioInstance.emit("productUpdated", updatedProduct);
        }

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


        const { id } = req.params;
        console.log(id)
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            throw new ApiError(404, "Product not found");
        }
        if (ioInstance) {
            ioInstance.emit("productDeleted", { productId: id });
        }


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
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct

}