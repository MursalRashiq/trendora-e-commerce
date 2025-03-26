const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const razorpay = require("razorpay");
const dotenv = require("dotenv").config();

let instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const addMoneyToWallet = async (req, res) => {
  try {
    var options = {
      amount: req.body.total * 100,
      currency: "INR",
      receipt: "" + Date.now(),
    };
    instance.orders.create(options, async function (err, order) {
      if (err) {
        console.log("Error while creating order : ", err);
      } else {
        var amount = order.amount / 100;
        await User.updateOne(
          {
            _id: req.session.user,
          },
          {
            $push: {
              history: {
                amount: amount,
                status: "credit",
                date: Date.now(),
              },
            },
          }
        );
      }
      res.json({ order: order, razorpay: true });
    });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const verify_payment = async (req, res) => {
  try {
    let { payment_id, order_id, signature, amount } = req.body;
    let transactionId = req.body.payment_id || "N/A";

    if (!amount) {
      console.error("Error: Amount not found in request!");
      return res
        .status(400)
        .json({ success: false, message: "Amount missing" });
    }

    let userId = req.session.user._id || req.session.user;
    if (!userId) {
      console.error("Error: User ID not found in session!");
      return res
        .status(401)
        .json({ success: false, message: "User not logged in" });
    }

    let updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { wallet: amount / 100 },
        $push: {
          walletHistory: {
            amount: amount / 100,
            type: "credit",
            transactionId: transactionId,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      console.error(" Error: User not found in database!");
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, wallet: updatedUser.wallet });
  } catch (error) {
    console.error("Payment Verification Error:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  addMoneyToWallet,
  verify_payment,
};
