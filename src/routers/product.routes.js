import { Router } from "express"
import {
    getAllProducts,
    getProductDetails
} from "../controllers/productControllers.js"
import {apiRateLimiter} from "../middlewares/rateLimiter.js"


const router = Router()

router.route("/getAllProducts").get(apiRateLimiter,getAllProducts)
router.route("/getProductDetails/:productId").get(getProductDetails)


export default router;