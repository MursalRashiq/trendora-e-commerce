const mongoose = require ('mongoose')
const {Schema} = mongoose


const brandSchema = new mongoose.Schema(
    {
      brandName: {
        type: String,
        required: true,
        trim: true,
      },
      brandImage: {
        type: [String], 
        default: ['default-image.jpg'],
      },
      isBlocked: {
        type: Boolean,
        default: true,
      },
    },
    { timestamps: true } 
  );

// const mongoose = require('mongoose');
// const { Schema } = mongoose;

// const brandSchema = new Schema({
//     brandName: {
//         type: String,
//         required: true,
//     },
//     description: {
//         type: String,
//         required: false,
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now,
//     },
// });

module.exports = mongoose.model('Brand', brandSchema);
