const User = require("../../models/userSchema")
const Product = require("../../models/productSchema");
const mongodb = require("mongodb");




const getCartPage = async (req, res) => {
    try {
      const id = req.session.user 
      console.log("User ID from session:", id);
  
      const query = id.length === 24 ? { _id: new mongodb.ObjectId(id) } : { googleId: id };
      const locals = await User.findOne(query);
  
      if (!locals) {
        console.error("User not found for ID:", id);
        return res.redirect("/login"); // Redirect to login if user not found
      }
  
      const productIds = locals.cart.map((item) => item.productId);
      const products = await Product.find({ _id: { $in: productIds } });
  
      let data = await User.aggregate([
        { $match: { _id: locals._id } }, // Use `locals._id` as the match condition
        { $unwind: "$cart" },
        {
          $project: {
            proId: { $toObjectId: "$cart.productId" },
            quantity: "$cart.quantity",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "proId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
      ]);
  
      // Calculate the total quantity of items in the cart
      let quantity = 0;
      for (const item of locals.cart) {
        quantity += item.quantity;
      }
  
      // Calculate the grand total
      let grandTotal = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i].productDetails.length > 0) {
          grandTotal += data[i].productDetails[0].salePrice * data[i].quantity;
        }
      }
  
      req.session.grandTotal = grandTotal;
  
      res.render("cart", {
        locals, // User data
        quantity, // Total quantity
        data, // Cart data with product details
        grandTotal, // Total price
      });
    } catch (error) {
      console.error("get cart error:", error);
      res.redirect("/pageNotFound");
    }
  };
  

  const addToCart = async (req, res) => {
    try {
      const id = req.body.productId;
      const userId = req.session.user;
      const findUser = await User.findById(userId);
      const product = await Product.findById({ _id: id }).lean();
      
      if (!product) {
        return res.json({ status: "Product not found" });
      }
      
      if (product.quantity <= 0) {
        return res.json({ status: "Out of stock" });
      }
  
      const cartIndex = findUser.cart.findIndex((item) => item.productId == id);
  
      if (cartIndex === -1) {
        const quantity = 1;
        await User.findByIdAndUpdate(userId, {
          $addToSet: {
            cart: {
              productId: id,
              quantity: quantity,
            },
          },
        });
        return res.json({ status: true, cartLength: findUser.cart.length + 1, user: userId });
      } else {
        const productInCart = findUser.cart[cartIndex];
        if (productInCart.quantity < product.quantity) {
          const newQuantity = productInCart.quantity + 1;
          await User.updateOne(
            { _id: userId, "cart.productId": id },
            { $set: { "cart.$.quantity": newQuantity } }
          );
          return res.json({ status: true, cartLength: findUser.cart.length, user: userId });
        } else {
          return res.json({ status: "Out of stock" });
        }
      }
    } catch (error) {
      console.error(error);
      return res.redirect("/pageNotFound");
    }
  };
  


  const changeQuantity = async (req, res) => {
    try {
      const productId = req.body.productId;
      const userId = req.session.user;
      const count = parseInt(req.body.count);
  
      // Validate count
      if (count !== 1 && count !== -1) {
        return res.status(400).json({ status: false, error: "Invalid count" });
      }
  
      // Find user and product
      const user = await User.findOne({ _id: userId });
      const product = await Product.findOne({ _id: productId });
  
      if (!user || !product) {
        return res.status(404).json({ status: false, error: "User or product not found" });
      }
  
      // Find the specific product in cart
      const cartItem = user.cart.find(
        (item) => item.productId.toString() === productId.toString()
      );
  
      if (!cartItem) {
        return res.status(404).json({ status: false, error: "Product not found in cart" });
      }
  
      // Calculate new quantity
      const newQuantity = cartItem.quantity + count;
  
      // Validate new quantity
      if (newQuantity <= 0) {
        return res.json({ status: false, error: "Quantity cannot be less than 1" });
      }
  
      if (newQuantity > product.quantity) {
        return res.json({ status: false, error: "Out of stock" });
      }
  
      // Update cart quantity
      const quantityUpdated = await User.updateOne(
        { 
          _id: userId, 
          "cart.productId": productId 
        },
        {
          $set: {
            "cart.$.quantity": newQuantity
          }
        }
      );
  
      if (!quantityUpdated.modifiedCount) {
        return res.json({ status: false, error: "Failed to update quantity" });
      }
  
      // Calculate totals using aggregation
      const oid = new mongodb.ObjectId(userId);
      const grandTotal = await User.aggregate([
        { $match: { _id: oid } },
        { $unwind: "$cart" },
        {
          $project: {
            proId: { $toObjectId: "$cart.productId" },
            quantity: "$cart.quantity"
          }
        },
        {
          $lookup: {
            from: "products",
            localField: "proId",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: "$productDetails" },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
            totalPrice: {
              $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] }
            }
          }
        }
      ]);
  
      return res.json({
        status: true,
        quantityInput: newQuantity,
        count: count,
        totalAmount: product.salePrice * newQuantity,
        grandTotal: grandTotal[0].totalPrice
      });
  
    } catch (error) {
      console.error('Cart quantity update error:', error);
      return res.status(500).json({ status: false, error: "Server error" });
    }
  };

  const deleteProduct = async (req, res) => {
    try {
      const id = req.query.id;
      const userId = req.session.user;
      const user = await User.findById(userId);
      const cartIndex = user.cart.findIndex((item) => item.productId == id);
      user.cart.splice(cartIndex, 1);
      await user.save();
      res.redirect("/cart");
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  };
  

    
      
      
    


module.exports = {
    getCartPage,
    addToCart,
    changeQuantity,
    deleteProduct
    
}