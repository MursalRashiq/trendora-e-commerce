const mongoose = require("mongoose")
const {Schema} = mongoose;



const categorySchema = new mongoose.Schema({
    name: {
        type:String,
        required:true,
        unique: true,
    },
    description:{
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true
    },
    categoryOffer:{
        type: Number,
        defalt: 0
    },
    createdAt: {
        type: Date,
        defalt: Date.now
    }
})

const Category = mongoose.model("Category",categorySchema)
module.exports = Category