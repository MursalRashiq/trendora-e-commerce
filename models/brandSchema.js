const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    brandImage: {
      type: [String],
      default: ["default-image.jpg"],
    },
    isBlocked: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Brand", brandSchema);
