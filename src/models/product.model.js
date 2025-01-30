import mongoose ,{Schema} from "mongoose";


const productSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim:true
    },
    category:{
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required:true
    },
    description: {
        type: String,
        required: true,
        trim:true
    },
    price: {
        type: Number,
        required: true,
        min:0
    },
    brand:{
        type:String,
        required:true,
        trim:true
    },
    images:{
        type:[String],
        default:[]

    },
    stock:{
        type:Number,
        required:true,
        min:0
    },
    ratings: { type: Number, default: 0 },
    reviews: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
          comment: { type: String },
          rating: { type: Number, min: 1, max: 5 },
        },
      ],




},{
    timestamps:true
})

export const Product = mongoose.model("Product",productSchema)