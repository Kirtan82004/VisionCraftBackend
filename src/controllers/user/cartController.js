import { asyncHandler } from "../../utils/asyncHandler.js"
import { ApiError } from "../../utils/ApiError.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import { Product } from "../../models/product.model.js"
import { Cart } from "../../models/cart.model.js"
import { ioInstance } from "../../index.js";



const addToCart = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        const { _id, quantity } = req.body;
        console.log("productId quantity",req.body)
        console.log("productId",_id)
        console.log("quantity",quantity)

        const product = await Product.findById(_id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        let cart = await Cart.findOne({ customer: userId });

        if (!cart) {

            cart = new Cart({
                customer: userId,
                products: [{ product: _id, quantity, price: product.price }]
            });
        } else {

            const productIndex = cart.products.findIndex(
                (item) => item.product.toString() === _id
            );

            if (productIndex > -1) {

                cart.products[productIndex].quantity += quantity;
            } else {

                cart.products.push({ product: _id, quantity, price: product.price });
            }
        }

        await cart.save();
        if (ioInstance) {
  ioInstance.emit("cartUpdated", { userId, cart });
}
        return res
            .status(200)
            .json(new ApiResponse(200, cart, "Product added to cart"))

    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json(new ApiError(500, "Failed to add product to cart"))
    }
})

const getCart = asyncHandler(async (req, res) => {
    try {
        const userId = req.userId;

        const cart = await Cart.findOne({ customer: userId })
            .populate('products.product', 'name price stock');

        if (!cart) {
            return res.status(200).json({ message: "Cart is empty", cart: { products: [] } });
        }
        return res
            .status(200)
            .json(new ApiResponse(200, cart, "Cart retrieved successfully"))


    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to retrieve cart" });
    }
})

const removeFromCart = asyncHandler(async (req, res) => {
    try {
        const userId = req.userId;
        const { productId } = req.body;

        const cart = await Cart.findOneAndUpdate(
            { customer: userId },
            { $pull: { products: { product: productId } } },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }
        if (ioInstance) {
  ioInstance.emit("cartUpdated", { userId, cart });
}
        return res
            .status(200)
            .json(new ApiResponse(200, cart, "Product removed from cart"))
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to remove product from cart" });
    }
})

const clearCart = asyncHandler(async (req, res) => {
    try {
        const userId = req.userId;

        const cart = await Cart.findOneAndDelete({ customer: userId });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }
        if (ioInstance) {
  ioInstance.emit("cartCleared", { userId });
}
        return res
            .status(200)
            .json(new ApiResponse(200, cart, "Cart cleared successfully"))
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json("Failed to clear cart")

    }
}
)
export {
    addToCart,
    getCart,
    removeFromCart,
    clearCart
}