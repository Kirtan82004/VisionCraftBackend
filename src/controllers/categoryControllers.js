import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Category } from "../models/category.model.js";
import { getIO } from "../config/socket.js";

/* =========================
   GET CATEGORY BY ID
========================= */
const getCategoryById = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res.status(200).json(
    new ApiResponse(200, category, "Category fetched successfully")
  );
});

/* =========================
   GET ALL CATEGORIES
========================= */
const getAllCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find({}).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, categories, "All categories fetched successfully")
  );
});

/* =========================
   CREATE CATEGORY
========================= */
const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, "Category name is required");
  }

  const existingCategory = await Category.findOne({
    name: name.trim().toLowerCase(),
  });

  if (existingCategory) {
    throw new ApiError(409, "Category already exists");
  }

  const category = await Category.create({
    name: name.trim().toLowerCase(),
    description,
  });

  // 🔥 Emit socket event (admin dashboards etc.)
  getIO().emit("categoryCreated", category);

  return res.status(201).json(
    new ApiResponse(201, category, "Category created successfully")
  );
});

export {
  getCategoryById,
  getAllCategories,
  createCategory,
};
