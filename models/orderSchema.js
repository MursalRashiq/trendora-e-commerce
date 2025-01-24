const mongoose = require('mongoose')
const {Schema} = mongoose
const {v4:uuidv4} = require('uuid')


const orderSchema = new Schema({
    orderId:{
        type: String,
        default: ()=>uuidv4,
        unique:true
    },
    orderItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required: true
        },
        quantity:{
            type: Number,
            required: true,
        },
        price:{
            type:Number,
            default:0
        }
    }],
    totalPrice:{
        type:Number,
        requred: true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmound:{
        type: Number,
        required: true
    },
    address:{
        type: Schema.Types.ObjectId,
        ref:"Address",
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status:{
        type: String,
        required:true,
        enum: ["Pending", "Processing","Shipped","Delivered","Cancelled","Return Request","Returned"]
    },
    createdAt:{
        type:Date,
        default: Date.now,
        required: true
    },
    couponApplied:{
        type:Boolean,
        default:false
    }
})

const Order = mongoose.model('Order', orderSchema)
module.exports = Order