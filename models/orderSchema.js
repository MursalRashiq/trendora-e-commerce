const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");
const Coupon = require("./couponSchema");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        required: true,
        enum: [
          "Pending",
          "Confirmed",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
          "Return Request",
          "Returned",
          "Return Rejected",
          "Failed",
        ],
        default: "Pending",
      },

      returnReason: {
        type: String,
        default: "",
      },
      cancelReason: {
        type: String,
        default: "",
      },
      deliveredAt: {
        type: Date,
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmound: {
    type: Number,
    required: true,
  },
  address: {
    addressType: String,
    name: String,
    city: String,
    landmark: String,
    state: String,
    pincode: Number,
    phone: String,
    altPhone: String,
  },
  invoiceDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
      "Return Rejected",
      "Failed",
      "Partially Returned",
    ],
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Paid",
      "Failed",
      "Refunded",
      "Confirmed",
      "Refund Processing",
      "Partial Refund Processing",
      "Partial Refunded",
    ],
    default: "Pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  couponDiscount: {
    type: Number,
    default: 0,
  },
  payment: {
    type: String,
    required: true,
    enum: ["razorpay", "cod", "wallet"],
  },

  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  razorpaySignature: {
    type: String,
  },
  shippingCharge: {
    type: Number,
    default: 0,
  },
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
