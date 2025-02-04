const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema")
const { v4: uuidv4 } = require('uuid');



const getCheckoutPage = async (req, res) => {
    try {
      const user = req.session.user;
      const findUser = await User.findOne({ _id: user });
      const addressData = await Address.findOne({ userId: user });
      const oid = new mongodb.ObjectId(user);
      const data = await User.aggregate([
        { $match: { _id: oid } },
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
  
      const grandTotal = await User.aggregate([
        { $match: { _id: oid } },
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
        {
          $unwind: "$productDetails", // Unwind the array created by the $lookup stage
        },
  
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
            totalPrice: {
              $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
            },
          },
        },
      ]);
      const gTotal = req.session.grandTotal;
      const today = new Date().toISOString();
      if (findUser.cart.length > 0) {
        res.render("check-out", {
          product: data,
          user: findUser,
          isCart: true,
          userAddress: addressData,
          grandTotal: grandTotal[0].totalPrice,
        });
      } else {
        res.redirect("/shop");
      }
    } catch (error) {
      res.redirect("/pageNotFound");
      console.error(error)
    }
  };




  const orderPlaced = async (req, res) => {
    try {
      const { totalPrice, addressId, payment, discount } = req.body;
      const userId = req.session.user;
      const findUser = await User.findOne({ _id: userId });
      if (!findUser) {
        return res.status(404).json({ error: "User not found" });
      }
      //console.log("=-=-=-=-=-=-",payment)
      const productIds = findUser.cart.map((item) => item.productId);
      const findAddress = await Address.findOne({ userId: userId, "address._id": addressId });
      if (!findAddress) {
        return res.status(404).json({ error: "Address not found" });
      }
  
      const desiredAddress = findAddress.address.find((item) => item._id.toString() === addressId.toString());
      if (!desiredAddress) {
        return res.status(404).json({ error: "Specific address not found" });
      }
      const findProducts = await Product.find({ _id: { $in: productIds } });
      if (findProducts.length !== productIds.length) {
        return res.status(404).json({ error: "Some products not found" });
      }

      console.log("desiredAddressdesiredAddressdesiredAddressdesiredAddressdesiredAddressdesiredAddress",desiredAddress)
      const cartItemQuantities = findUser.cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));
      console.log("findProducts",findProducts.quantity)

  
      const orderedProducts = findProducts.map((item) => ({
        _id: item._id,
        price: item.salePrice,
        name: item.productName,
        image: item.productImage[0],
        productStatus: "Confirmed",
        quantity: cartItemQuantities.find((cartItem) => cartItem.productId.toString() === item._id.toString()).quantity,
      }));

      console.log("orderedProducts",orderedProducts)
  
      if (payment === "cod" && totalPrice > 1000) {
        return res.status(400).json({ error: "Orders above ₹1000 are not allowed for Cash on Delivery (COD)" });
      }

      for (let item of findProducts) {
        const cartItem = findUser.cart.find((cartItem) => cartItem.productId.toString() === item._id.toString());
        if (cartItem.quantity > item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Sorry, ${item.productName} is out of stock. Only ${item.quantity} available.`,
            availableQuantity: item.quantity,
            productId: item._id,
          });
        }
      }
  
      const finalAmount = totalPrice - discount;
      //console.log(finalAmount,"---------------------")
      
      let newOrder = new Order({
        orderId: uuidv4(),
        product: orderedProducts,
        totalPrice: totalPrice,
        discount: discount,
        finalAmound: finalAmount,
        address: desiredAddress,
        payment: payment,
        user: userId,
        status: "Confirmed",
        orderItems: orderedProducts.map(product => ({
          product: product._id,
          quantity: product.quantity,
          price: product.price,
        })),
        paymentMethod: payment,
        createdOn: Date.now(),
      });
      let orderDone = await newOrder.save();

      await User.findByIdAndUpdate(userId, {
        $push: { orderHistory: orderDone._id }
    });
  
      await User.updateOne({ _id: userId }, { $set: { cart: [] } });
      for (let orderedProduct of orderedProducts) {
        const product = await Product.findOne({ _id: orderedProduct._id });
        if (product) {
          product.quantity = Math.max(product.quantity - orderedProduct.quantity, 0);
          await product.save();
        }
      }
  
      res.json({
        payment: true,
        method: "cod",
        order: orderDone,
        quantity: cartItemQuantities,
        orderId: orderDone._id,
      });
  
    } catch (error) {
      console.error("Error processing order:", error);
      res.redirect("/pageNotFound");
    }
  };



  const orderSuccess =  async (req, res) => {
    try {
        const orderId = req.query.id;
        const paymentMethod = req.query.method;
        
        // Fetch order details from database
        const order = await Order.findById(orderId)
            .populate('orderItems.product')
            .populate('address')
             

        // Render the success page with order details
        res.render('orderSuccess', {
            order,
            paymentMethod,
            formatDate: (date) => {
                return new Date(date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.redirect('/');
    }
}


const getOrderDetailsPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.query.id;


    // Fetch the order details with populated product info
    const orderObjectId = new mongoose.Types.ObjectId(orderId);

    const findOrder = await Order.findOne({ _id: orderObjectId })
      .populate('orderItems.product')
      .populate('address')
      .populate('user')

    // console.log("user:-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=", findOrder.user);

    // Fetch user with populated order history
    const findUser = await User.findOne({ _id: userId }).populate({
      path: 'orderHistory',
      populate: {
        path: 'orderItems.product' // Changed from product.product to orderItems.product
      }
    });


    //console.log("address:-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=", findOrder)

    if (!findOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    let totalGrant = 0;
    findOrder.orderItems.forEach((val) => { 
      totalGrant += val.product.salePrice * val.quantity;
    });


    const totalPrice = findOrder.totalPrice;
    const discount = totalGrant - totalPrice;
    const finalAmount = totalPrice;

    res.render("orderDetails", {
      user: findOrder.user,
      totalGrant: totalGrant,
      totalPrice: totalPrice,
      discount: discount,
      finalAmount: finalAmount,
      orders: findOrder,
      address: findOrder.address,
    });

  } catch (error) {
    console.error("Error fetching order details:", error);
    res.redirect("/pageNotFound");
  }
};




const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return res.status(404).json({ message: "User not found" });
    }

    //console.log(req.body,"=-=-=-=-=-=-=-=-=-=-=-=-")

    const { orderId } = req.body;
    const findOrder = await Order.findOne({ _id: orderId }).populate("orderItems")
    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (findOrder.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    await Order.updateOne({ _id: orderId }, { status: "Cancelled" });

    for (const productData of findOrder.orderItems) {
      const product = productData.product;  // Assuming 'product' is populated
      const quantity = productData.quantity;

      console.log(product._id, "productId", quantity, "quantity");

      // Ensure the product is correctly populated and accessible
      if (product) {
        // If it's not a full Mongoose document, fetch it explicitly
        const fullProduct = await Product.findById(product._id);
        console.log("Before Update:", fullProduct.quantity); // Log current quantity
        fullProduct.quantity += quantity; // Increase the stock by the ordered quantity
        await fullProduct.save(); // Save the updated product
        console.log("After Update:", fullProduct.quantity); // Log updated quantity
      }
    }


    res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
  }


module.exports = {
    getCheckoutPage,
    orderPlaced,
    orderSuccess,
    getOrderDetailsPage,
    cancelOrder
}