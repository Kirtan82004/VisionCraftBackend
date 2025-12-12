import {Router} from "express"
import {
    getDashboardStats,
    getSalesReport,
    getOrderSummary
} from "../controllers/admin/dashboardController.js"
import {
    sendEmailNotification,
    sendBulkNotifications
} from "../controllers/admin/notificationController.js"
import {
    getAllProducts,
    getProductById,  
    createProduct,
    updateProduct,
    deleteProduct,
} from "../controllers/admin/productController.js"
import {
    getAllOrders,
    getRecentOrders,
    getOrderById,
    updateOrderStatus,
    deleteOrder
} from "../controllers/admin/orderControllers.js"
import {
    createCategory
} from "../controllers/categoryControllers.js"
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { authorizeRoles } from "../middlewares/authorizeRole.middleware.js"

const router = Router()

//dashboard routes
router.route("/dashboard").get(verifyJWT,authorizeRoles("admin"),getDashboardStats)
router.route("/dashboard/sales-report").get(verifyJWT,authorizeRoles("admin"),getSalesReport)
router.route("/dashboard/order-summary").get(verifyJWT,authorizeRoles("admin"),getOrderSummary)

//notification routes
router.route("/notifications/email").post(verifyJWT,authorizeRoles("admin"),sendEmailNotification)
router.route("/notifications/bulk").post(verifyJWT,authorizeRoles("admin"),sendBulkNotifications)

//product routes
router.route("/product/create").post(verifyJWT,upload.fields([
    {
        name: "image",
        maxCount: 1
    },
    {
        name:"images",
        maxCount:5
    }
]),authorizeRoles("admin"),createProduct)
router.route("/product/get-all-products").get(verifyJWT,authorizeRoles("admin"),getAllProducts)
router.route("/product/get-product-byId/:id").get(verifyJWT,authorizeRoles("admin"),getProductById)
router.route("/product/update/:id").put(verifyJWT,authorizeRoles("admin"),updateProduct)
router.route("/product/delete/:id").delete(verifyJWT,authorizeRoles("admin"),deleteProduct)

//order routes
router.route("/order/get-orders").get(verifyJWT,authorizeRoles("admin"),getAllOrders)
router.route("/order/get-recent-orders").get(verifyJWT,authorizeRoles("admin"),getRecentOrders)
router.route("/order/get-order-ById/:id").get(verifyJWT,authorizeRoles("admin"),getOrderById)
router.route("/order/update-Order-Status/:id").put(verifyJWT,authorizeRoles("admin"),updateOrderStatus)
router.route("/order/delete-order/:orderId").delete(verifyJWT,authorizeRoles("admin"),deleteOrder)

//category route
router.route("/create-category").post(verifyJWT,authorizeRoles("admin"),createCategory)


export default router;