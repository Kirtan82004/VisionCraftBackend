import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Order } from "../../models/order.model.js";
import { getIO } from "../../config/socket.js";

// Get all orders with optional status/customer filter
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, customerId } = req.query;
  const matchStage = {};
  if (status) matchStage.orderStatus = status;
  if (customerId) matchStage.customer = new mongoose.Types.ObjectId(customerId);

  const orders = await Order.aggregate([
    { $match: matchStage },
    { $sort: { createdAt: -1 } }, // newest first
    {
      $lookup: {
        from: "users",
        localField: "customer",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        customerName: "$customer.fullName",
      },
    },
    {
      $lookup: {
        from: "products",
        let: { productIds: "$products.product" },
        pipeline: [{ $match: { $expr: { $in: ["$_id", "$$productIds"] } } }],
        as: "productDetails",
      },
    },
    {
      $addFields: {
        products: {
          $map: {
            input: "$products",
            as: "p",
            in: {
              _id: "$$p._id",
              quantity: "$$p.quantity",
              price: "$$p.price",
              product: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$productDetails",
                      as: "pd",
                      cond: { $eq: ["$$pd._id", "$$p.product"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
        totalAmount: {
          $round: [
            {
              $sum: {
                $map: {
                  input: "$products",
                  as: "p",
                  in: { $multiply: ["$$p.quantity", "$$p.price"] },
                },
              },
            },
            2,
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        orderId: { $concat: ["ORD-", { $substrBytes: [{ $toString: "$_id" },6, 6] }] },
        customerName: 1,
        orderStatus: 1,
        paymentMethod: 1,
        paymentStatus: 1,
        products: 1,
        totalAmount: 1,
        shippingDetails: { $ifNull: ["$shippingDetails", "$shippingAddress"] },
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  const totalOrder = await Order.countDocuments(matchStage);

  return res.status(200).json(new ApiResponse(200, { orders, totalOrder }, "Orders retrieved successfully"));
});

// Get 10 recent orders
const getRecentOrders = asyncHandler(async (req, res) => {
  const recentOrders = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("customer", "fullName email")
    .populate("products.product", "name price");

  const ordersWithTotal = recentOrders.map(order => {
    const totalAmount = order.products.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
    return {
      ...order.toObject(),
      totalAmount,
      orderId: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
    };
  });

  return res.status(200).json(new ApiResponse(200, ordersWithTotal, "Recent orders retrieved successfully"));
});

// Get order by ID
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id)
    .populate("customer", "fullName email address phoneNo")
    .populate("products.product", "name price brand");

  if (!order) throw new ApiError(404, "Order not found");

  return res.status(200).json(new ApiResponse(200, order, "Order retrieved successfully"));
});

// Update order status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ["Pending", "Shipped", "Delivered", "Cancelled"];

  if (!validStatuses.includes(status)) throw new ApiError(400, "Invalid order status");

  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "Order not found");

  order.orderStatus = status;
  await order.save({ validateBeforeSave: false });

  // 🔥 Emit socket event
  const io = getIO();
  if (io) io.emit("orderStatusUpdated", { orderId: order._id, status: order.orderStatus });

  return res.status(200).json(new ApiResponse(200, order, "Order status updated successfully"));
});

// Delete order
const deleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findByIdAndDelete(orderId);

  if (!order) throw new ApiError(404, "Order not found");

  // 🔥 Emit socket event
  const io = getIO();
  if (io) io.emit("orderDeleted", { orderId });

  return res.status(200).json(new ApiResponse(200, null, "Order deleted successfully"));
});

export { getAllOrders, getRecentOrders, getOrderById, updateOrderStatus, deleteOrder };
