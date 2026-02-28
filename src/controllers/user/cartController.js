import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Product } from "../../models/product.model.js";
import { Cart } from "../../models/cart.model.js";
import { getIO } from "../../config/socket.js";

/* =========================
   ADD TO CART
========================= */
const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId, quantity = 1 } = req.body;

  if (!productId || quantity <= 0) {
    throw new ApiError(400, "Invalid product or quantity");
  }

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  if (product.stock < quantity) {
    throw new ApiError(400, "Not enough stock available");
  }

  let cart = await Cart.findOne({ customer: userId });

  if (!cart) {
    cart = await Cart.create({
      customer: userId,
      products: [
        {
          product: productId,
          quantity,
          price: product.price,
        },
      ],
    });
  } else {
    const item = cart.products.find(
      (p) => p.product.toString() === productId
    );

    if (item) {
      item.quantity += quantity;
      item.price = product.price;
    } else {
      cart.products.push({
        product: productId,
        quantity,
        price: product.price,
      });
    }

    await cart.save();
  }

  return res.status(200).json(
    new ApiResponse(200, cart, "Product added to cart")
  );
});


/* =========================
   GET CART
========================= */
const getCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ customer: userId }).populate(
    "products.product",
    "name price stock images"
  );

  return res.status(200).json(
    new ApiResponse(200, cart || { products: [] }, "Cart fetched")
  );
});

/* =========================
   REMOVE FROM CART
========================= */
const removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!productId) throw new ApiError(400, "Product ID required");

  const cart = await Cart.findOneAndUpdate(
    { customer: userId },
    { $pull: { products: { product: productId } } },
    { new: true }
  );

  if (!cart) throw new ApiError(404, "Cart not found");

  getIO().to(`user-${userId}`).emit("cartUpdated", cart);

  return res.status(200).json(
    new ApiResponse(200, cart, "Product removed from cart")
  );
});

/* =========================
   CLEAR CART
========================= */
const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await Cart.findOneAndDelete({ customer: userId });

  getIO().to(`user-${userId}`).emit("cartCleared");

  return res.status(200).json(
    new ApiResponse(200, {}, "Cart cleared successfully")
  );
});

export {
  addToCart,
  getCart,
  removeFromCart,
  clearCart,
};
