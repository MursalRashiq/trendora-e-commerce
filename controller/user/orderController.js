const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const { v4: uuidv4 } = require("uuid");
const Coupon = require("../../models/couponSchema");
const razorpay = require("razorpay");
const crypto = require("crypto");
const easyinvoice = require("easyinvoice");
const path = require("path");
const moment = require("moment");
const fs = require("fs");

let instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const findUser = await User.findOne({ _id: userId });

    // Get all addresses for the user
    const addressData = await Address.findOne({ userId: userId });

    const oid = new mongodb.ObjectId(userId);

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
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: null,
          totalPrice: {
            $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
          },
        },
      },
    ]);

    const totalAmount = grandTotal[0]?.totalPrice || 0;
    // console.log("Total Amount:", totalAmount);

    const currentDate = new Date();
    const availableCoupons = await Coupon.find({
      isList: true,
      minimumPrice: { $lte: totalAmount },
      maximumPrice: { $gte: totalAmount },
      expireOn: { $gt: currentDate },
      userId: { $nin: [userId] }, 
    });

    // console.log("Coupon Query:", {
    //   isList: true,
    //   minimumPrice: { $lte: totalAmount },
    //   expireOn: { $gt: currentDate },
    //   userId: { $nin: [userId] },
    // });

    // console.log("Found Coupons:", availableCoupons);

    if (findUser.cart.length > 0) {
      res.render("check-out", {
        product: data,
        user: findUser,
        name: findUser.name,
        isCart: true,
        userAddress: addressData,
        grandTotal: totalAmount,
        Coupon: availableCoupons,
        locals: {
          name: findUser.name,
          Coupon: availableCoupons,
        },
      });
    } else {
      res.redirect("/shop");
    }
  } catch (error) {
    console.error("Error in getCheckoutPage:", error);
    console.error("Full error stack:", error.stack);
    res.redirect("/pageNotFound");
  }
};

const paymentConfirm = async (req, res) => {
  try {
    await Order.updateOne(
      { _id: req.body.orderId },
      { $set: { status: "Confirmed" } }
    ).then((data) => {
      res.json({ status: true });
    });
  } catch (error) {
    res.redirect("/pageNotFound");
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

    const productIds = findUser.cart.map((item) => item.productId);
    const findAddress = await Address.findOne({
      userId: userId,
      "address._id": addressId,
    });
    if (!findAddress) {
      return res.status(404).json({ error: "Address not found" });
    }

    const desiredAddress = findAddress.address.find(
      (item) => item._id.toString() === addressId.toString()
    );
    if (!desiredAddress) {
      return res.status(404).json({ error: "Specific address not found" });
    }

    const findProducts = await Product.find({ _id: { $in: productIds } });
    if (findProducts.length !== productIds.length) {
      return res.status(404).json({ error: "Some products not found" });
    }

    const cartItemQuantities = findUser.cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    const orderedProducts = findProducts.map((item) => ({
      _id: item._id,
      price: item.salePrice,
      name: item.productName,
      image: item.productImage[0],
      productStatus: "Confirmed",
      quantity: cartItemQuantities.find(
        (cartItem) => cartItem.productId.toString() === item._id.toString()
      ).quantity,
    }));

    if (payment === "cod" && totalPrice > 1000) {
      return res
        .status(400)
        .json({
          error:
            "Orders above ₹1000 are not allowed for Cash on Delivery (COD)",
        });
    }

    for (let item of findProducts) {
      const cartItem = findUser.cart.find(
        (cartItem) => cartItem.productId.toString() === item._id.toString()
      );

      if (cartItem.quantity > item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Sorry, ${item.productName} is out of stock. Only ${item.quantity} available.`,
          availableQuantity: item.quantity,
          productId: item._id,
          productName: item.productName,
          requestedQuantity: cartItem.quantity,
        });
      }
    }

    const finalAmound = totalPrice - discount;
    // console.log("finalAmound", finalAmound);

    let newOrder = new Order({
      orderId: uuidv4(),
      product: orderedProducts,
      totalPrice: totalPrice,
      discount: discount,
      finalAmound: totalPrice - (discount || 0),
      address: desiredAddress,
      payment: payment,
      user: userId,
      status: "Confirmed",
      orderItems: orderedProducts.map((product) => ({
        product: product._id,
        quantity: product.quantity,
        price: product.price,
        status: "Confirmed"
      })),
      createdOn: Date.now(),
    });

    let orderDone = await newOrder.save();

    await User.findByIdAndUpdate(userId, {
      $push: { orderHistory: orderDone._id },
    });

    await User.updateOne({ _id: userId }, { $set: { cart: [] } });
    for (let orderedProduct of orderedProducts) {
      const product = await Product.findOne({ _id: orderedProduct._id });
      if (product) {
        product.quantity = Math.max(
          product.quantity - orderedProduct.quantity,
          0
        );
        await product.save();
      }
    }

    // console.log("Order Details for Razorpay:", {
    //   orderId: orderDone._id,
    //   finalAmound: orderDone.finalAmound,
    // });

    switch (payment) {
      case "cod":
        return res.json({
          payment: true,
          method: "cod",
          order: orderDone,
          quantity: cartItemQuantities,
          orderId: orderDone._id,
        });

      case "wallet":
        if (newOrder.finalAmound <= findUser.wallet) {
          findUser.wallet -= newOrder.finalAmound;

          if (!findUser.history) {
            findUser.history = [];
          }

          await User.updateOne(
            { _id: findUser._id }, 
            {
              $push: {
                walletHistory: {
                  amount: newOrder.finalAmound,
                  type: "debit",
                  timestamp: new Date(),
                },
              },
            }
          );

          await findUser.save();

          return res.json({
            payment: true,
            method: "wallet",
            order: orderDone,
            orderId: orderDone._id,
            quantity: cartItemQuantities,
            success: true,
          });
        } else {
          await Order.updateOne(
            { _id: orderDone._id },
            { $set: { status: "Failed" } }
          );
          return res.json({ payment: false, method: "wallet", success: false });
        }
      case "razorpay":
        const razorPayGeneratedOrder = await generateOrderRazorpay(
          orderDone._id,
          orderDone.finalAmound
        );
        return res.json({
          payment: false,
          method: "razorpay",
          razorPayOrder: razorPayGeneratedOrder,
          order: orderDone,
          quantity: cartItemQuantities,
          finalAmound,
        });

      default:
        return res.status(400).json({ error: "Invalid payment method" });
    }
  } catch (error) {
    console.error("Error processing order:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

const generateOrderRazorpay = (orderId, total) => {
  return new Promise((resolve, reject) => {
    const options = {
      amount: total * 100,
      currency: "INR",
      receipt: String(orderId),
    };
    instance.orders.create(options, (err, order) => {
      if (err) {
        reject(err);
      } else {
        resolve(order);
      }
    });
  });
};

const getOrderSuccessPage = async (req, res) => {
  try {
    const order = await Order.findOne({ user: req.session.user }) 
      .sort({ createdAt: -1 }) 
      .populate("orderItems.product"); 

    if (!order) {
      return res.redirect("/error");
    }

    res.render("orderSuccess", {
      order,
      product: order.orderItems[0].product, 
    });
  } catch (error) {
    console.error(error);
    res.status(500).redirect("/error");
  }
};

const verify = (req, res) => {
  let hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  hmac.update(
    `${req.body.payment.razorpay_order_id}|${req.body.payment.razorpay_payment_id}`
  );
  hmac = hmac.digest("hex");
  // console.log(hmac, "HMAC");
  console.log(req.body.payment.razorpay_signature, "signature");
  if (hmac === req.body.payment.razorpay_signature) {
    console.log("true");
    res.json({ status: true });
  } else {
    // console.log("false");
    res.json({ status: false });
  }
};

const getOrderDetailsPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.query.id;

    const orderObjectId = new mongoose.Types.ObjectId(orderId);

    const findOrder = await Order.findOne({ _id: orderObjectId })
      .populate({
        path: "orderItems",
        populate: {
          path: "product",
        },
      })
      .populate("address")
      .populate("user");

      if (!findOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

    findOrder.orderItems.forEach((item) => {
      console.log("Product Image:", item.product?.productImage);
    });

    // console.log("Find Order:", JSON.stringify(findOrder, null, 2));

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
    res.redirect("pageNotFound");
  }
};


const cancelProductItem = async (req, res) => {
  try {
    const { orderId, productId, quantity, paymentMethod } = req.body; // Added reason
// console.log("Request orderId:", orderId); 

const order = await Order.findOne({ _id: orderId })
  .populate("orderItems.product")
  .lean();

if (!order) {
  return res.status(404).json({ message: "Order not found" });
}

// console.log("Order found:", order);



    // Check active items
    const activeItems = order.orderItems.filter(item => item.status !== "Cancelled");

    if (activeItems.length === 1) {
      order.status = "Cancelled"; // Changed orderStatus → status
    }

    // Find the item
    const itemIndex = order.orderItems.findIndex(
      (item) => item.product._id.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in order" });
    }

    const item = order.orderItems[itemIndex];

    if (item.status === "Cancelled") {
      return res.status(400).json({ message: "Item is already cancelled" });
    }

    // Update item status
    item.status = "Cancelled";
    // item.cancellationReason = reason;

    let refundAmount = 0;
    if (order.payment === "Confirmed") { // Fixed `order.paymentStatus`
      refundAmount = item.price * item.quantity;

      if (paymentMethod === "razorpay" && order.razorpayOrderId) {
        const refund = await razorpayInstance.payments.refund(order.razorpayOrderId, {
          amount: Math.round(refundAmount * 100),
        });

        if (!refund) {
          return res.status(500).json({ message: "Refund failed, please try again." });
        }
      }

      if (paymentMethod === "wallet" || paymentMethod === "razorpay") {
        const wallet = new Wallet({
          userId: order.user,
          amount: refundAmount,
          type: "Credit",
          description: `Refund for cancelled item in order ${orderId}`,
        });

        await wallet.save();

        const user = await User.findById(order.user);
        if (user) {
          user.wallet += refundAmount;
          await user.save();
        }
      }

      order.refundAmount = (order.refundAmount || 0) + refundAmount;
    }

    if (order.payment === "Pending") {
      order.finalAmound -= item.price * item.quantity; // Fixed finalAmount → finalAmound
      refundAmount = 0;
    }

    if (order.finalAmound < 0) {
      order.finalAmound = 0;
    }

    // Update product quantity
    const product = await Product.findById(productId);
    if (product) {
      product.quantity += quantity;
      await product.save();
    }

    // Save order changes
    await order.save();

    res.status(200).json({
      message: "Item cancelled successfully",
      refundAmount,
    });
  } catch (error) {
    console.error("Error cancelling item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const findUser = await User.findById(userId);
    if (!findUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const { orderId } = req.body;
    console.log(req.body)
    const findOrder = await Order.findById(orderId).populate("orderItems.product"); // ✅ Populate product details

    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (findOrder.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    // ✅ Process Refund (if paid via Razorpay or Wallet)
    if (
      (findOrder.payment === "razorpay" || findOrder.payment === "wallet") &&
      findOrder.status === "Confirmed"
    ) {
      // Find the specific item inside the order
      const canceledItem = findOrder.orderItems.find(
        (item) => item.product.toString() === productId // ✅ Compare productId
      );
    
      if (canceledItem) {
        const refundAmount = canceledItem.price * canceledItem.quantity; // ✅ Calculate refund
    
        findUser.wallet += refundAmount;
    
        findUser.walletHistory.push({
          amount: refundAmount,
          type: "credit", 
          timestamp: new Date(),
          description: `Refund for product ${productId} in order ${orderId}`,
        });
    
        await findUser.save();
      }
    }
    
    // ✅ Update Order Items Status
    findOrder.orderItems.forEach((item) => {
      item.status = "Cancelled";
    });
    await findOrder.save();

    // ✅ Restore Stock
    for (const item of findOrder.orderItems) {
      if (item.product) {
        const product = await Product.findById(item.product._id);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }
    }

    res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const returnorder = async (req, res) => {
  try {
    const userId = req.session.user;
    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add itemIndex to identify which specific item to return
    const { orderId, itemIndex, returnReason } = req.body;
    
    const findOrder = await Order.findOne({ _id: orderId });
    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Check if the item exists
    if (!findOrder.orderItems || !findOrder.orderItems[itemIndex]) {
      return res.status(404).json({ message: "Item not found in this order" });
    }
    
    const item = findOrder.orderItems[itemIndex];
    
    // Check if this specific item is already returned
    if (item.status === "Returned" || item.status === "Return Request") {
      return res.status(400).json({ message: "This item already has a return request or has been returned" });
    }
    
    // Check return eligibility based on delivery date
    const returnPeriodDays = 7;
    const currentDate = new Date();
    
    if (!item.deliveredAt) {
      return res.status(400).json({ message: "This item doesn't have a delivery date recorded" });
    }
    
    const deliveryDate = new Date(item.deliveryDate);
    const diffTime = Math.abs(currentDate - deliveryDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > returnPeriodDays) {
      return res.status(400).json({
        message: `Return period expired. Returns are only accepted within ${returnPeriodDays} days after delivery.`,
      });
    }
    
    // Update just this item's status
    const updateQuery = {};
    updateQuery[`orderItems.${itemIndex}.status`] = "Return Request";
    updateQuery[`orderItems.${itemIndex}.returnReason`] = returnReason;
    
    await Order.updateOne(
      { _id: orderId },
      { $set: updateQuery }
    );
    
    res.status(200).json({ message: "Return request initiated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
      .populate("user")
      .populate("orderItems.product"); 

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const data = {
      documentTitle: "INVOICE",
      currency: "INR",
      taxNotation: "gst",
      marginTop: 25,
      marginRight: 25,
      marginLeft: 25,
      marginBottom: 25,
      apiKey: process.env.EASYINVOICE_API,
      mode: "production",

      sender: {
        company: "Trendora",
        address: "Vadakkencherry",
        zip: "678684",
        city: "Palakkad",
        country: "India",
      },
      client: {
        company: order.address.name,
        address: order.address.landmark + ", " + order.address.city,
        zip: order.address.pincode,
        city: order.address.state,
        country: "India",
      },
      information: {
        number: order.orderId,
        date: moment(order.createdAt).format("YYYY-MM-DD HH:mm:ss"), 
      },
      products: order.orderItems.map((item) => ({
       
        quantity: item.quantity,
        description: item.product.productName, 
        tax: 0,
        price: item.price,
      })),
      bottomNotice: "Thank you for your business",
    };

    const result = await easyinvoice.createInvoice(data);
    const invoicePath = path.join(
      __dirname,
      "../../public/invoice/",
      `invoice_${orderId}.pdf`
    );
    fs.writeFileSync(invoicePath, result.pdf, "base64");
    res.download(invoicePath, `invoice_${orderId}.pdf`, (err) => {
      if (err) {
        console.error("Error downloading the file", err);
      }
      fs.unlinkSync(invoicePath);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while generating the invoice");
  }
};

module.exports = {
  getCheckoutPage,
  orderPlaced,
  getOrderSuccessPage,
  getOrderDetailsPage,
  cancelOrder,
  verify,
  paymentConfirm,
  returnorder,
  downloadInvoice,
  cancelProductItem
};
