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
  referralCode: { // Fixed typo from "referalCode"
    type: String,
    unique: true,
    sparse: true,
  },
  referredBy: { // Tracks who referred this user
    type: String,
    default: null,
  },
  redeemed: { // Indicates if this user's referral reward is claimed
    type: Boolean,
    default: false,
  },
  redeemedUsers: [ // Users referred by this user
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  referralCount: { // Number of successful referrals
    type: Number,
    default: 0,
  },
  referralRewardStatus: { // Status of this user's referral reward
    type: String,
    enum: ["pending", "claimed", "ineligible"],
    default: "pending",
  },
  referralEarnings: { // Total earnings from referrals
    type: Number,
    default: 0,
  },
  referredAt: { // When this user was referred
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