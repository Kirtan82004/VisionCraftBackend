import { Product } from "../../models/product.model.js"
import { Category } from "../../models/category.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {Order} from "../../models/order.model.js"
import { io } from "../../app.js";
import mongoose from "mongoose";

const getAllOrders = asyncHandler(async (req, res) => {
try {
        const { page = 1, limit = 10, status, customerId } = req.query;
        console.log(status)
        console.log(customerId)
        const filter = {};
        if (status) filter.orderStatus = status;
        if (customerId) filter.customer = customerId;
        const skip = (page - 1) * limit;
        const orders = await Order.find(filter)
            .populate("customer", "fullName email")
            .populate("products.product", "name price")
            .skip(skip)
            .limit(Number(limit));
    
        const totalOrder = await Order.countDocuments(filter);
        return res.status(200).json({
            message: "Orders retrieved successfully.",
            orders,
            totalOrder,
            currentPage: page,
            totalPages: Math.ceil(totalOrder / limit),
        })
} catch (error) {
    throw new ApiError(500,error.message)
    
}

});

const getOrderById = asyncHandler(async(req,res)=>{
    try {
        const {id}=req.params;
        const order=await Order.findById(id)
        .populate("customer","fullName email address phoneNo")
        .populate("products.product","name price brand")

        if(!order){
            throw new ApiError(404,"Order not found")
        }
        return res
        .status(200)
        .json( new ApiResponse(200,order,"Order retrieved successfully"))
    } catch (error) {
        throw new ApiError(500,error.message)
        
    }
});
const updateOrderStatus =asyncHandler( async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["Pending", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid order status." });
        }
       const order = await Order.findById(id)
       order.orderStatus = status

       if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }

        await order.save();
        io.emit("orderStatusChanged", {                   
            orderId: order._id,
            status: order.orderStatus,
            meaasge:`Oredr ${order._id} status cahanged to ${status}`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const deleteOrder = asyncHandler(async(req,res)=>{
    try {
        const {id}=req.params;
        const order=await Order.findByIdAndDelete(id)
        if(!order){
            throw new ApiError(404,"Order not found")
        }
        await order.save();
        io.emit("orderDeleted", {
            orderId: order._id,
            message: `Order ${order._id} has been deleted.`,
        })
    } catch (error) {
        throw new ApiError(500,error.message)
        
    }
})
export {
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    deleteOrder
}