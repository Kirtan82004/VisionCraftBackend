import {User} from "../../models/user.model.js"
import {Product} from "../../models/product.model.js"
import {Order} from "../../models/order.model.js"
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";

import { ApiResponse } from "../../utils/ApiResponse.js";

const getDashboardStats = asyncHandler(async(req,res)=>{
    try {
        const totalUsers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalRevenue = await Order.aggregate([
            {
                $unwind:"$products"
            },
            {
                $group:{
                    _id:null,
                    totalRevenue:{
                        $sum:{
                            $multiply:["$products.price", "$products.quantity"]
                        }
                    }
                }
            }
        ])
        return res 
        .status(200)
        .json(new ApiResponse(200,{
            totalUsers,
            totalOrders,
            totalProducts,
            totalRevenue:totalRevenue[0]?totalRevenue[0].totalRevenue:0
        }))
    } catch (error) {
        return res.status(500).json(new ApiError(500, error.message))
    }
})
const getSalesReport = asyncHandler(async(req,res)=>{
    try {
        const {startDate,endDate} = req.query;
        if(!startDate || endDate){
            return res.status(400).json(new ApiError(400,"Invalid date range"))
        }
        const salesReport = await Order.aggregate([
            {
                $match:{
                    createdAt:{
                        $gte:new Date(startDate),
                        $lte:new Date(endDate)
                    }
                }
            },{
                $unwind:"$products"
            },{
                $group:{
                    _id:null,
                    totalSales:{
                        $sum:{
                            $multiply:["$products.price","$products.quantity"]
                        }
                    },
                    totalOrders:{
                        $sum:1
                    }
                }
            }
        ]);
        if(!salesReport){
            throw new ApiError(404,"sales report not gettet")
        }
        console.log(salesReport)
        return res.status(200).json(new ApiResponse(200,salesReport.length ? salesReport[0] :{
            totalSales:salesReport[0]?salesReport[0].totalSales:0,
        }))
    } catch (error) {
        return res.status(500).json(new ApiError(500, error.message))
    }
})

const getOrderSummary = asyncHandler(async(req,res)=>{
    try {
        const orderSummary= Order.aggregate([
            {
                $group:{
                    _id:"$orderStatus",
                    count:{
                        $sum:1
                    }
                }
            },
            {
                $project:{
                    _id:0,
                    orderStatus:"$_id",
                    count:1
                }
            }
        ]);
        return res.status(200).json(new ApiResponse(200,orderSummary,"Order summary retrieved successfully"))
    } catch (error) {
        return res
        .status(200)
        .json(new ApiError(500, "Error retrieving order summary"))
    }
})

export {
    getDashboardStats,
    getSalesReport,
    getOrderSummary
    

}