import { Router } from "express"
import {
    getAllCategories,
    getCategoryByName
} from "../controllers/categoryControllers.js"


const router = Router()

router.route("/all-category").get(getAllCategories)
router.route("/category-by-name").get(getCategoryByName)



export default router;