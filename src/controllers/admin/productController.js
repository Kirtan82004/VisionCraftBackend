import { Product } from "../../models/product.model.js";
import { Category } from "../../models/category.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { getIO } from "../../config/socket.js";

// Get all products
const getAllProducts = asyncHandler(async (req, res) => {
  const products = await Product.find()
    .populate("category", "name")
    .populate("reviews.user", "fullName email");

  return res.status(200).json(new ApiResponse(200, products, "Products retrieved successfully"));
});

// Get product by ID
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id)
    .populate("category", "name")
    .populate("reviews.user", "fullName email");

  if (!product) throw new ApiError(404, "Product not found");

  return res.status(200).json(new ApiResponse(200, product, "Product retrieved successfully"));
});

// Create product
const createProduct = asyncHandler(async (req, res) => {
  const { name, price, description, category, brand, stock } = req.body;

  if (!category) throw new ApiError(400, "Category is required");

  let categoryExists = await Category.findOne({ name: category.trim() });
  if (!categoryExists) categoryExists = await Category.create({ name: category.trim() });

  const productExist = await Product.findOne({ name, price });
  if (productExist) throw new ApiError(400, "Product already exists");

  // Handle images
  const singleImage = req.files?.image?.[0]?.path || null;
  const multipleImages = req.files?.images?.map(f => f.path) || [];

  const singleImageUrl = singleImage ? await uploadOnCloudinary(singleImage) : null;
  const multipleImageUrls = [];

  for (const img of multipleImages) multipleImageUrls.push(await uploadOnCloudinary(img));

  const images = singleImageUrl ? [singleImageUrl, ...multipleImageUrls] : multipleImageUrls;
  if (images.length === 0) throw new ApiError(400, "At least one product image is required");

  const newProduct = new Product({
    name,
    price,
    description,
    category: categoryExists._id,
    stock,
    brand,
    images,
  });

  await newProduct.save();

  const io = getIO();
  if (io) io.emit("productCreated", newProduct);

  return res.status(201).json(new ApiResponse(201, newProduct, "Product created successfully"));
});

// Update product
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, price, description, brand, stock } = req.body;

  const updatedProduct = await Product.findByIdAndUpdate(
    id,
    { name, price, description, brand, stock },
    { new: true }
  );

  if (!updatedProduct) throw new ApiError(404, "Product not found");

  const io = getIO();
  if (io) io.emit("productUpdated", updatedProduct);

  return res.status(200).json(new ApiResponse(200, updatedProduct, "Product updated successfully"));
});

// Delete product
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new ApiError(404, "Product not found");

  const io = getIO();
  if (io) io.emit("productDeleted", { productId: id });

  return res.status(200).json(new ApiResponse(200, product, "Product deleted successfully"));
});

export { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
