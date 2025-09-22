import { Router } from "express"
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    UpdateAccountDetail,
    updateUserImage,
    getCurrentUser
} from "../controllers/user/authController.js";
import {
    getUserWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist
} from "../controllers/user/wishlistController.js"
import {
    createRazorpayOrder,
    placeOrder,
    getOrderHistory,
    getOrderDetails,
    cancelOrder
} from "../controllers/user/orderController.js"
import {
    addToCart,
    getCart,
    removeFromCart,
    clearCart
} from "../controllers/user/cartController.js"
import {
    addProductReview,
    editProductReview,
    deleteProductReview,
    getProductReviews
} from "../controllers/user/reviewController.js"
import { createTempFolder } from "../middlewares/checkFile.middleware.js"
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    createTempFolder,
    upload.fields([
        {
            name: "image",
            maxCount: 1
        }
    ]),
    registerUser
)
router.route("/login").post(
    upload.none(),
    loginUser)

//secured Routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-Token").post(refreshAccessToken)
router.route("/change-Password").patch(upload.none(), verifyJWT, changeCurrentPassword)
router.route("/update-Account").patch(upload.none(), verifyJWT, UpdateAccountDetail)
router.route("/update-Image").patch(upload.single("image"), verifyJWT, updateUserImage)
router.route("/current-User").get(verifyJWT, getCurrentUser)

//wishlist routes
router.route("/getUserWishlist").get(verifyJWT, getUserWishlist)
router.route("/addToWishlist").post(verifyJWT, addToWishlist)
router.route("/removeFromWishlist").delete(verifyJWT,removeFromWishlist)
router.route("/clearWishlist").delete(clearWishlist)

//order routes
router.route("/create-razorpay-order").post(verifyJWT,createRazorpayOrder)
router.route("/placeOrder").post(verifyJWT, placeOrder)
router.route("/getOrderHistory").get( verifyJWT,getOrderHistory)
router.route("/getOrderDetails/:orderId").get(verifyJWT, getOrderDetails)
router.route("/cancelOrder/:orderId").delete(cancelOrder)

//cart routes
router.route("/addToCart").post( verifyJWT, addToCart)
router.route("/getCart").get(verifyJWT, getCart)
router.route("/removeFromCart").delete(verifyJWT, removeFromCart)
router.route("/clearCart").delete(verifyJWT, clearCart)

//review routes
router.route("/addProductReview/:productId").post(verifyJWT, addProductReview)
router.route("/getProductReviews/:productId").get(verifyJWT,getProductReviews)
router.route("/editProductReview").patch(verifyJWT,editProductReview)
router.route("/deleteProductReview").delete(verifyJWT,deleteProductReview)







export default router;  