import { Router } from "express"
import {
    getAllCategories,
    getCategoryById,
    createCategory
} from "../controllers/categoryControllers.js"


const router = Router()

router.route("/").get(getAllCategories)
router.route("/:Id").get(getCategoryById)
router.route("/create").post(createCategory)



export default router;