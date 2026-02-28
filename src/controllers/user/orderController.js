import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Order } from "../../models/order.model.js";
import { Cart } from "../../models/cart.model.js";
import Razorpay from "razorpay";
import mongoose from "mongoose";
import { getIO } from "../../config/socket.js";

/* =========================
   Razorpay Instance
========================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

/* =========================
   CREATE RAZORPAY ORDER
========================= */
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ customer: userId });

  if (!cart || cart.products.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  const amount = cart.products.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  const order = await razorpay.orders.create({
    amount: amount * 100, // paise
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
    payment_capture: 1,
  });

  return res.status(200).json(
    new ApiResponse(200, order, "Razorpay order created")
  );
});


/* =========================
   PLACE ORDER
========================= */

const placeOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const {
      shippingDetails,
      paymentMethod = "cod",
      razorpayPayment,
    } = req.body;

    if (
      !shippingDetails?.fullName ||
      !shippingDetails?.email ||
      !shippingDetails?.address
    ) {
      throw new ApiError(400, "Invalid shipping details");
    }

    /* 1️⃣ Fetch cart */
    const cart = await Cart.findOne({ customer: userId })
      .populate("products.product", "price stock")
      .session(session);

    if (!cart || cart.products.length === 0) {
      throw new ApiError(400, "Cart is empty");
    }

    /* 2️⃣ Verify Razorpay payment (ONLY for online) */
    if (paymentMethod === "razorpay") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        razorpayPayment || {};

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, "Invalid Razorpay payment data");
      }

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        throw new ApiError(400, "Payment verification failed");
      }
    }

    /* 3️⃣ Prepare products safely */
    const products = cart.products.map((item) => {
      if (item.product.stock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for product ${item.product._id}`
        );
      }

      return {
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
      };
    });

    const orderTotal = products.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );

    /* 4️⃣ Create order */
    const [order] = await Order.create(
      [
        {
          customer: userId,
          products,
          shippingDetails,
          paymentMethod,
          paymentStatus: paymentMethod === "cod" ? "Pending" : "Success",
          orderStatus: "Pending",
          razorpayOrderId:
            paymentMethod === "razorpay"
              ? razorpayPayment.razorpay_order_id
              : null,
        },
      ],
      { session }
    );

    /* 5️⃣ Clear cart AFTER order creation */
    await Cart.findOneAndDelete({ customer: userId }).session(session);

    await session.commitTransaction();
    session.endSession();

    /* 🔥 ADMIN SOCKET */
    getIO().to("admin-room").emit("orderPlaced", {
      orderId: order._id,
      total: orderTotal,
      customer: userId,
      message: "New order placed",
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        { ...order.toObject(), orderTotal },
        "Order placed successfully"
      )
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

/* =========================
   ORDER HISTORY (USER)
========================= */
const getOrderHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const orders = await Order.find({ customer: userId })
    .sort({ createdAt: -1 })
    .select("createdAt orderStatus paymentStatus products");

  const formattedOrders = orders.map((order) => {
    const totalAmount = order.products.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    return {
      _id: order._id,
      createdAt: order.createdAt,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount,
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, formattedOrders, "Order history fetched"));
});


/* =========================
   ORDER DETAILS
========================= */
const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId)
    .populate("products.product", "name price image")
    .populate("customer", "fullName email phoneNo");

  if (!order) throw new ApiError(404, "Order not found");

  // calculate total
  const totalAmount = order.products.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const formattedOrder = {
    ...order.toObject(),
    totalAmount,
  };

  return res.status(200).json(
    new ApiResponse(200, formattedOrder, "Order details fetched")
  );
});


/* =========================
   CANCEL ORDER
========================= */
const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.orderStatus !== "Pending") {
    throw new ApiError(400, "Order cannot be cancelled");
  }

  order.orderStatus = "Cancelled";
  await order.save();

  getIO().to("admin-room").emit("orderCancelled", {
    orderId: order._id,
    status: order.orderStatus,
  });

  return res.status(200).json(
    new ApiResponse(200, order, "Order cancelled successfully")
  );
});

export {
  createRazorpayOrder,
  placeOrder,
  getOrderHistory,
  getOrderDetails,
  cancelOrder,
};
