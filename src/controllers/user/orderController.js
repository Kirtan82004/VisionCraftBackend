import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiError } from "../../utils/ApiError.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import { Order } from "../../models/order.model.js"
import { Cart } from "../../models/cart.model.js"

import Razorpay from "razorpay"
import mongoose from "mongoose"

// 🔐 Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
})

// 1️⃣ Create Razorpay Order (called before frontend checkout)
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount } = req.body
  console.log("amount",amount)

  if (!amount) throw new ApiError(400, "Amount is required")

  const options = {
    amount: amount * 100, // in paise
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
    payment_capture: 1,
  }

  try {
    const order = await razorpay.orders.create(options)
    console.log("order",order)
    return res.status(200).json(new ApiResponse(200, order, "Razorpay order created"))
  } catch (error) {
    console.error("Razorpay Error:", error)
    throw new ApiError(500, "Failed to create Razorpay order")
  }
})

// 2️⃣ Place Order After Successful Payment
const placeOrder = asyncHandler(async (req, res) => {
  console.log("req.body", req.body);

  const { shippingDetails, paymentMethod, razorpayPayment } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not found." });
  }

  const cart = await Cart.findOne({ customer: userId }).populate("products.product", "name price");

  if (!cart || !cart.products || cart.products.length === 0) {
    return res.status(400).json({ message: "Cart is empty. Cannot place order." });
  }

  // Prepare product details for order
  const products = cart.products.map((item) => ({
    product: item.product._id,
    quantity: item.quantity,
    price: item.product.price,
  }));

  const orderTotal = products.reduce((sum, item) => sum + item.quantity * item.price, 0);

  // Validate shippingDetails
  if (
    !shippingDetails ||
    !shippingDetails.fullName ||
    !shippingDetails.email ||
    !shippingDetails.address
  ) {
    return res.status(400).json({ message: "Invalid shipping details." });
  }

  const newOrder = new Order({
    customer: userId,
    products,
    shippingDetails: {
      fullName: shippingDetails.fullName,
      email: shippingDetails.email,
      address: shippingDetails.address,
    },
    paymentMethod: paymentMethod || "cod", // default fallback
    paymentStatus: "Success",
    orderStatus: "Pending",
    razorpayOrderId: razorpayPayment?.razorpay_order_id || null,
  });

  const savedOrder = await newOrder.save();

  // Notify via socket (if io is globally available)
  if (typeof io !== "undefined") {
    io.emit("order", {
      action: "create",
      order: savedOrder,
      message: `New order placed with order id ${savedOrder._id}`,
    });
  }

  // Clear user's cart after successful order
  await Cart.findOneAndDelete({ customer: userId });

  res.status(201).json({
    message: "Order placed successfully",
    order: {
      ...savedOrder.toObject(),
      orderTotal,
    },
  });
});


// 3️⃣ Get Order History
const getOrderHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id

  const orders = await Order.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(userId) } },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        orderStatus: 1,
        orderTotal: {
          $sum: {
            $map: {
              input: "$products",
              as: "product",
              in: { $multiply: ["$$product.price", "$$product.quantity"] },
            },
          },
        },
      },
    },
    { $sort: { createdAt: -1 } },
  ])

  res.status(200).json({ message: "Order history retrieved successfully", orders })
})

// 4️⃣ Get Order Details
const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const orderDetails = await Order.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(orderId) } },

    // Join product details
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "productDetails",
      },
    },

    // Join customer details (optional)
    {
      $lookup: {
        from: "users",
        localField: "customer",
        foreignField: "_id",
        as: "customerDetails",
      },
    },

    {
      $unwind: {
        path: "$customerDetails",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $project: {
        _id: 1,
        createdAt: 1,
        orderStatus: 1,
        paymentStatus: 1,
        paymentMethod: 1,
        razorpayOrderId: 1,

        // Shipping
        shippingDetails: 1,

        // Customer Info
        user: {
          _id: "$customerDetails._id",
          name: "$customerDetails.fullName",
          email: "$customerDetails.email",
          phone: "$customerDetails.phone",
        },

        // Reconstruct ordered products with quantity & price
        products: {
          $map: {
            input: "$products",
            as: "item",
            in: {
              quantity: "$$item.quantity",
              price: "$$item.price",
              product: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$productDetails",
                      as: "pd",
                      cond: { $eq: ["$$pd._id", "$$item.product"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },

        // Order Total
        orderTotal: {
          $sum: {
            $map: {
              input: "$products",
              as: "item",
              in: { $multiply: ["$$item.quantity", "$$item.price"] },
            },
          },
        },
      },
    },
  ]);

  if (!orderDetails || orderDetails.length === 0) {
    throw new ApiError(404, "Order not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, orderDetails, "Order details retrieved successfully"));
});

const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params
  const order = await Order.findById(orderId)

  if (!order) throw new ApiError(404, "Order not found")

  order.status = "Cancelled"
  await order.save()

  io.emit("orderCancelled", {
    orderId: order._id,
    status: order.status,
    message: `Order ${order._id} has been cancelled`,
  })

  return res.status(200).json(new ApiResponse(200, null, "Order cancelled successfully"))
})

export {
  createRazorpayOrder,
  placeOrder,
  getOrderHistory,
  getOrderDetails,
  cancelOrder,
}
