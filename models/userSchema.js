const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null,
  },
  googleId: {
    type: String,
    sparse: true,
    required: false,
  },
  password: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  cart: {
    type: Array,
  },
  wallet: {
    type: Number,
    default: 0,
  },
  walletHistory: [
    {
      amount: Number,
      type: { type: String, enum: ["credit", "debit", "refund"] },
      timestamp: { type: Date, default: () => new Date() },
    },
  ],
  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: "Wishlist",
    },
  ],
  orderHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  referredBy: {
    type: String,
    default: null,
  },
  redeemed: {
    type: Boolean,
    default: false,
  },
  redeemedUsers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  referralCount: {
    type: Number,
    default: 0,
  },
  referralRewardStatus: {
    type: String,
    enum: ["pending", "claimed", "ineligible"],
    default: "pending",
  },
  referralEarnings: {
    type: Number,
    default: 0,
  },
  referredAt: {
    type: Date,
    default: null,
  },
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
      brand: {
        type: String,
      },
      searchOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
