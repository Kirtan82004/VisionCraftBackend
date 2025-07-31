import { Router } from "express"
import {
    getAllProducts,
    getProductDetails
} from "../controllers/productControllers.js"
import { upload } from "../middlewares/multer.middleware.js"


const router = Router()

router.route("/getAllProducts").get(upload.none(),getAllProducts)
router.route("/getProductDetails/:productId").get(getProductDetails)


export default router;