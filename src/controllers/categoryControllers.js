import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiResponse} from "../utils/ApiResponse.js"
import {ApiError} from "../utils/ApiError.js"
import {Category} from '../models/category.model.js';



const getCategoryByName = asyncHandler(async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json(new ApiError(400, "Category name is required"));
        }

        const category = await Category.findOne({ name });
        if (!category) {
            return res.status(404).json(new ApiError(404, [], "Category not found"));
        }

        return res.status(200).json(new ApiResponse(200, category, "Category found"));
    } catch (error) {
        return res.status(500).json(new ApiError(500, [], "Error fetching category"));
    }
});


const getAllCategories = asyncHandler(async (req, res) => {
    try {
        const categories = await Category.find({});
        return res.status(200).json(new ApiResponse(200, categories, "All categories fetched"));
    } catch (error) {
        return res.status(500).json(new ApiError(500, [], "Error fetching categories"));
    }
});

// ✅ 3. Create a New Category
const createCategory = asyncHandler(async (req, res) => {
    try {
        console.log(req.body)
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json(new ApiError(400, [], "Category name is required"));
        }

        // Check if category already exists
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json(new ApiError(400, [], "Category already exists"));
        }

        const newcategory = new Category({ name,description });
        await newcategory.save();


        return res.status(201).json(new ApiResponse(201, newcategory, "Category created successfully"));
    } catch (error) {
        console.log(error.message)
        return res.status(500).json(new ApiError(500, "Error creating category"));
    }
});

export { getCategoryByName, getAllCategories, createCategory };
