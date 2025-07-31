import mongoose ,{Schema} from "mongoose";


const orderSchema = new Schema({

    
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required:true
    },
    products: [
        {
          product: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Product" 
        },
          quantity: { 
            type: Number, 
            required: true },
          price: { 
            type: Number, 
            required: true 
        },
        },
      ],
    shippingDetails:{
        fullName: { 
            type: String, 
            required: true 
        },
        email: { 
            type: String, 
            required: true 
        },
        address: { 
            type: String, 
            required: true 
        },
        
    },
    paymentMethod:{
        type:String,
        required:true
    },
    paymentStatus:{
        type:String,
        required:true,
        enum: ['pending', 'success', 'failed'],
        default:'pending'
    },
    orderStatus:{
        type:String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
        required:true
    }

},{
    timeStamps:true
})


export const Order= mongoose.model("Order",orderSchema)