import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Order } from "../../models/order.model.js";
import { ioInstance } from "../../index.js";

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, customerId } = req.query;
  const matchStage = {};

  if (status) matchStage.orderStatus = status;
  if (customerId) matchStage.customer = new mongoose.Types.ObjectId(customerId);

  const orders = await Order.aggregate([
    { $match: matchStage },

    // Lookup customer
    {
      $lookup: {
        from: "users",
        localField: "customer",
        foreignField: "_id",
        as: "customer"
      }
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        customerName: "$customer.fullName"
      }
    },
    // Lookup product details
    {
      $lookup: {
        from: "products",
        let: { productIds: "$products.product" },
        pipeline: [
          { $match: { $expr: { $in: ["$_id", "$$productIds"] } } }
        ],
        as: "productDetails"
      }
    },

    // Merge product details
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
                      cond: { $eq: ["$$pd._id", "$$p.product"] }
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      }
    },

    // ✅ Add totalAmount field
    {
      $addFields: {
        totalAmount: {
          $round: [
            {
              $sum: {
                $map: {
                  input: "$products",
                  as: "p",
                  in: { $multiply: ["$$p.quantity", "$$p.price"] }
                }
              }
            },
            2
          ]
        }

      }
    },
    {
      $project: {
        _id: 1,
        customerName: 1,
        orderStatus: 1,
        paymentMethod: 1,
        paymentStatus: 1,
        products: 1,
        totalAmount: 1,
        createdAt: 1,
        updatedAt: 1,

        shippingDetails: {
          $ifNull: ["$shippingDetails", "$shippingAddress"]
        }
      }
    }

  ]);

  const totalOrder = await Order.countDocuments(matchStage);


  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { orders, totalOrder },
        "Orders retrieved successfully."
      )
    );
});
const getRecentOrders = asyncHandler(async (req, res) => {
  try {
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 }) // newest first
      .limit(10)
      .populate("customer", "fullName email")
      .populate("products.product", "name price");

    // Add totalPrice field to each order
    const ordersWithTotal = recentOrders.map(order => {
      const totalPrice = order.products.reduce((sum, item) => {
        const productPrice = item.product?.price || 0;
        const quantity = item.quantity || 1;
        return sum + productPrice * quantity;
      }, 0);

      return {
        ...order.toObject(), // convert Mongoose doc to plain object
        totalPrice
      };
    });

    return res.status(200).json(
      new ApiResponse(200, ordersWithTotal, "Recent orders retrieved successfully")
    );

  } catch (error) {
    throw new ApiError(500, error.message);
  }
});


const getOrderById = asyncHandler(async (req, res) => {
  try {
    console.log("getOrderById called")
    const { id } = req.params;
    console.log("order id:", req.params)
    const order = await Order.findById(id)
      .populate("customer", "fullName email address phoneNo")
      .populate("products.product", "name price brand")

    if (!order) {
      throw new ApiError(404, "Order not found")
    }
    return res
      .status(200)
      .json(new ApiResponse(200, order, "Order retrieved successfully"))
  } catch (error) {
    throw new ApiError(500, error.message)

  }
});
const updateOrderStatus = asyncHandler(async (req, res) => {
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

    await order.save({ validateBeforeSave: false });
    if (ioInstance) {
      ioInstance.emit("orderStatusUpdated", {
        orderId: order._id,
        status: order.orderStatus
      });
    }

    return res.status(200).json(
      new ApiResponse(200, order, "Order status updated successfully")
    );

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const deleteOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id)
    if (!order) {
      throw new ApiError(404, "Order not found")
    }
    await order.save();
    if (ioInstance) {
      ioInstance.emit("orderDeleted", { orderId: id });
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Order deleted successfully"))

  } catch (error) {
    throw new ApiError(500, error.message)

  }
})
export {
  getAllOrders,
  getRecentOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder
}