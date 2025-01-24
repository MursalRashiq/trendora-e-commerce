const mongoose = require('mongoose')
const {Schema} = mongoose



const wishlistSchema = new Schema({
    userId:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    products:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            default: Date.now
        },
        addedOn:{
            type: Data,
            default:Date.name
        }
    }]
})

const Wishlist = mongoose.model('Wishlist',wishlistSchema)
module.exports = Wishlist