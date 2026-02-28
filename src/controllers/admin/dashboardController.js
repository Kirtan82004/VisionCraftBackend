import {User} from "../../models/user.model.js"
import {Product} from "../../models/product.model.js"
import {Order} from "../../models/order.model.js"
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";

import { ApiResponse } from "../../utils/ApiResponse.js";

const getGrowthPercent = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    /* ================= DATE RANGES ================= */
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(today.getDate() - 2);

    const lastWeekStart = new Date();
    lastWeekStart.setDate(today.getDate() - 7);

    const prevWeekStart = new Date();
    prevWeekStart.setDate(today.getDate() - 14);

    /* ================= TOTAL REVENUE ================= */
    const totalRevenueAgg = await Order.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: { $multiply: ["$products.price", "$products.quantity"] },
          },
        },
      },
    ]);

    const totalRevenue =
      totalRevenueAgg[0]?.totalRevenue || 0;

    /* ================= REVENUE GROWTH (WEEKLY) ================= */
    const revenueLastWeek = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastWeekStart },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: { $multiply: ["$products.price", "$products.quantity"] },
          },
        },
      },
    ]);

    const revenuePrevWeek = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: prevWeekStart,
            $lt: lastWeekStart,
          },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: { $multiply: ["$products.price", "$products.quantity"] },
          },
        },
      },
    ]);

    const revenueGrowth = getGrowthPercent(
      revenueLastWeek[0]?.revenue || 0,
      revenuePrevWeek[0]?.revenue || 0
    );

    /* ================= ORDERS GROWTH (YESTERDAY) ================= */
    const ordersYesterday = await Order.countDocuments({
      createdAt: { $gte: yesterday },
    });

    const ordersDayBefore = await Order.countDocuments({
      createdAt: {
        $gte: dayBeforeYesterday,
        $lt: yesterday,
      },
    });

    const ordersGrowth = getGrowthPercent(
      ordersYesterday,
      ordersDayBefore
    );

    /* ================= USERS GROWTH (CUSTOMERS) ================= */
    const usersYesterday = await User.countDocuments({
      createdAt: { $gte: yesterday },
    });

    const usersDayBefore = await User.countDocuments({
      createdAt: {
        $gte: dayBeforeYesterday,
        $lt: yesterday,
      },
    });

    const usersGrowth = getGrowthPercent(
      usersYesterday,
      usersDayBefore
    );

    /* ================= PRODUCTS GROWTH (WEEKLY) ================= */
    const productsLastWeek = await Product.countDocuments({
      createdAt: { $gte: lastWeekStart },
    });

    const productsPrevWeek = await Product.countDocuments({
      createdAt: {
        $gte: prevWeekStart,
        $lt: lastWeekStart,
      },
    });

    const productsGrowth = getGrowthPercent(
      productsLastWeek,
      productsPrevWeek
    );

    /* ================= RESPONSE ================= */
    return res.status(200).json(
      new ApiResponse(200, {
        totals: {
          totalUsers,
          totalOrders,
          totalProducts,
          totalRevenue,
        },
        growth: {
          revenueGrowthPercent: revenueGrowth,
          ordersGrowthPercent: ordersGrowth,
          usersGrowthPercent: usersGrowth,
          productsGrowthPercent: productsGrowth,
        },
      })
    );
  } catch (error) {
    return res.status(500).json(new ApiError(500, error.message));
  }
});
const getSalesReport = asyncHandler(async(req,res)=>{
    console.log("getSalesReport called")
    try {
        console.log(req.query)
        const {startDate,endDate} = req.query
        console.log("startDate,endDate",startDate,endDate)
        if(!startDate || !endDate){
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
            throw new ApiError(404,"sales report not getted")
        }
        console.log(salesReport)
        return res.status(200).json(new ApiResponse(200,salesReport.length ? salesReport[0] :{
            totalSales:salesReport[0]?salesReport[0].totalSales:0,
        }))
    } catch (error) {
        return res.status(500).json(new ApiError(500, error.message))
    }
})

const getOrderSummary = asyncHandler(async (req, res) => {
  try {
    const orderSummary = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          orderStatus: "$_id",
          count: 1,
        },
      },
    ]);

    return res
      .status(200)
      .json(new ApiResponse(200, orderSummary, "Order summary retrieved successfully"));
  } catch (error) {
    console.error("Error in getOrderSummary:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Error retrieving order summary"));
  }
});


export {
    getDashboardStats,
    getSalesReport,
    getOrderSummary
    

}