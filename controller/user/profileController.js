const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { userAuth } = require("../../middleware/auth");
const mongoose = require("mongoose");
const Order = require("../../models/orderSchema");
const { ibanLocales } = require("validator");

function generateOtp() {
  const digits = "1234567890";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {}
};

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 589,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your OTP for Password reset",
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4><br></b>`,
    };

    const info = await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error(error, ":error sending email");
    return false;
  }
};

const getForgotPassPage = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    res.redirect("pageNotFound");
  }
};

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        res.render("forgotPass-otp");
        console.log("OTP:", otp);
      } else {
        res.json({
          success: false,
          message: "Failed to send OTP, Please try again",
        });
      }
    } else {
      res.render("forgot-password", {
        message: "User with this email does not exist`",
      });
      console.log("User with this email does not exist");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const verifyForgotPassOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;

    if (enteredOtp === req.session.userOtp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.json({ sucess: false, message: "OTP not matching" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "An error occured Please try again" });
  }
};

const getResetPassPage = async (req, res) => {
  try {
    res.render("reset-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const resendOtp = async (req, res) => {
  try {
    const otp = generateOtp();

    req.session.userOtp = otp;
    const email = req.session.email;
    console.log("Resending OTP to email: ", email);
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("Resend OTP:", otp);
      res
        .status(200)
        .json({ success: true, message: "Resend OTP successfull" });
    }
  } catch (error) {
    console.error("Error in resend OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const postNewPassword = async (req, res) => {
  try {
    const { newPass1, newPass2 } = req.body;
    const email = req.session.email;
    if (newPass1 === newPass2) {
      const passwordHash = await securePassword(newPass1);
      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      );
      res.redirect("/login");
    } else {
      res.render("reset-password", { message: "Passwords do not match" });
      console.log("password not matching");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId).populate("orderHistory");
    const addressData = await Address.findOne({ userId: userId });

    const walletHistory = userData.walletHistory
      .map((x) => ({
        status: x.type,
        date: x.timestamp,
        amount: x.amount,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render("profile", {
      locals: userData,
      userAddress: addressData,
      walletHistory,
      query: req.query,
    });
  } catch (error) {
    console.error("Error retrieving profile data", error);
    res.redirect("/pageNotFound");
  }
};

const changeEmail = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    res.render("change-email", {
      locals: userData,
    });
  } catch (error) {
    console.error("chage email get error", error);
    res.redirect("/pageNotFound");
  }
};

const changeEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req, (session.email = email);
        res.render("change-email-otp", {
          locals: userExists,
        });
        console.log("Otp :", otp);
        console.log("email :", email);
      } else {
        res.json("email-error");
      }
    } else {
      res.render("change-email", {
        message: "User with this email not exsist",
      });
    }
  } catch (error) {
    res.redirect("pageNotFound");
    console.log(error);
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const enteredOtp = req.session.userOtp;
    if (enteredOtp === req.session.userOtp) {
      req.session.userData = req.body.userData;
      res.render("new-email", {
        userData: req.session.userData,
      });
    } else {
      res.render("change-email-otp", {
        message: "OTP not matching",
        userData: req.session.userData,
      });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const updateEmail = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const userId = req.session.user;
    await User.findByIdAndUpdate(userId, { email: newEmail });
    res.redirect("Profile");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const changeUserPass = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });

    res.render("change-password", {
      locals: userData,
    });
  } catch (error) {
    console.error("errror found in cangepass get ", error);
  }
};

const changeUserPassPost = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User not logged in." });
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    const userData = await User.findById(userId);
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (!currentPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is required." });
    }

    const isMatch = await bcrypt.compare(currentPassword, userData.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect." });
    }

    if (newPassword !== confirmNewPassword) {
      return res
        .status(400)
        .json({ success: false, message: "New passwords do not match." });
    }

    if (!newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "New password is required." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    userData.password = hashedNewPassword;
    await userData.save();

    res.json({
      success: true,
      message: "Password changed successfully.",
      redirectUrl: "/profile",
    });
  } catch (error) {
    console.error("Error in changing password: ", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findById(user);
    let cartQuantity = 0;

    res.render("add-address", {
      userData: userData,
    });
  } catch (error) {
    res.redirect("/pageNotFound");
    console.error("error found in addAddress", error);
  }
};

const postAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      console.log("User ID not found in session");
      return res.redirect("/pageNotFound");
    }

    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      console.log("User not found in database with ID:", userId);
      return res.redirect("/pageNotFound");
    }

    const {
      addressType,
      name,
      city,
      landmark,
      state,
      pincode,
      phone,
      altPhone,
    } = req.body;

    const userAddress = await Address.findOne({ userId: userData._id });
    if (!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [
          {
            addressType,
            name,
            city,
            landmark,
            state,
            pincode,
            phone,
            altPhone,
          },
        ],
      });
      await newAddress.save();
    } else {
      userAddress.address.push({
        addressType,
        name,
        city,
        landmark,
        state,
        pincode,
        phone,
        altPhone,
      });
      await userAddress.save();
      console.log(
        "Address added to existing address list for user:",
        userData._id
      );
    }

    res.redirect("/profile");
  } catch (error) {
    console.error("Error adding address:", error);
    res.redirect("/pageNotFound");
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.query.id?.trim();

    if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
      console.error("Invalid address ID:", addressId);
      return res.status(400).send("Invalid Address ID");
    }

    const user = req.session.user;
    const currentAddress = await Address.findOne({ "address._id": addressId });

    if (!currentAddress) {
      return res.status(404).send("Address not found");
    }

    const addressData = currentAddress.address.find(
      (item) => item._id.toString() === addressId
    );

    if (!addressData) {
      return res.status(404).send("Address not found");
    }
    const userData = await User.findOne({ _id: user });

    res.render("edit-address", { address: addressData, locals: userData });
  } catch (error) {
    console.error("edit address error", error);
    res.status(500).send("Server Error");
  }
};

const postEditAddress = async (req, res) => {
  try {
    const data = req.body;
    const addressId = req.query.id;
    const user = req.session.user;
    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      res.redirect("/pageNotFound");
    }
    await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$": {
            _id: addressId,
            addressType: data.addressType,
            name: data.name,
            city: data.city,
            landmark: data.landmark,
            state: data.state,
            pincode: data.pincode,
            phone: data.phone,
            altPhone: data.altPhone,
          },
        },
      }
    );

    res.redirect("/profile");
  } catch (error) {
    console.error("error in edit address post ", error);
    res.redirect("/pageNotFound");
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      return res.status(404).send("Address not found");
    }

    await Address.updateOne(
      {
        "address._id": addressId,
      },
      {
        $pull: {
          address: {
            _id: addressId,
          },
        },
      }
    );

    res.redirect("/profile");
  } catch (error) {
    console.error("error in delete address", error);
    res.redirect("/pageNotFound");
  }
};

const changeName = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);

    if (!userData) {
      req.flash("error", "User not found");
      return res.redirect("/profile");
    }

    // Pass user data through locals
    res.locals.user = userData;
    res.locals.message = req.flash();

    res.render("change-name", { locals: userData });
  } catch (error) {
    console.error("Error in changeName:", error);
    req.flash("error", "Something went wrong");
    return res.redirect("/pageNotFound");
  }
};
const changeNamePost = async (req, res) => {
  try {
    const { newName, reNewName } = req.body;
    const userId = req.session.user;

    const userData = await User.findById(userId); // Fetch user details

    if (!userId) {
      return res.redirect("/login");
    }

    if (!newName || !reNewName) {
      req.flash("error", "Please fill all fields");
      return res.render("change-name", {
        user: userData,
        message: req.flash(),
      });
    }

    if (newName !== reNewName) {
      req.flash("error", "Names do not match");
      return res.render("change-name", {
        user: userData,
        message: req.flash(),
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { name: newName } },
      { new: true }
    );

    if (!updatedUser) {
      req.flash("error", "User not found");
      return res.render("change-name", {
        user: userData,
        message: req.flash(),
      });
    }

    req.session.user.name = newName;

    req.flash("success", "Name updated successfully");
    return res.redirect("/profile");
  } catch (error) {
    console.error("Error in changeNamePost:", error);
    req.flash("error", "Something went wrong");
    return res.redirect("/pageNotFound");
  }
};
const changePhone = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);

    if (!userData) {
      req.flash("error", "User not found");
      return res.redirect("/profile");
    }

    res.render("change-phone", {
      locals: userData,
      message: req.flash(),
    });
  } catch (error) {
    console.error("Error in changePhone:", error);
    req.flash("error", "Something went wrong");
    return res.redirect("/profile");
  }
};

const changePhonePost = async (req, res) => {
  try {
    const { newPhone, reNewPhone } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    if (!newPhone || !reNewPhone) {
      req.flash("error", "Please fill all fields");
      return res.redirect("/change-phone");
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(newPhone)) {
      req.flash("error", "Please enter a valid 10-digit phone number");
      return res.redirect("/change-phone");
    }

    if (newPhone !== reNewPhone) {
      req.flash("error", "Phone numbers do not match");
      return res.redirect("/change-phone");
    }

    const existingUser = await User.findOne({ phone: newPhone });
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      req.flash("error", "Phone number already in use");
      return res.redirect("/change-phone");
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { phone: newPhone } },
      { new: true }
    );

    if (!updatedUser) {
      req.flash("error", "User not found");
      return res.redirect("/change-phone");
    }

    req.session.user.phone = newPhone;

    req.flash("success", "Phone number updated successfully");
    return res.redirect("/profile");
  } catch (error) {
    console.error("Error in changePhonePost:", error);
    req.flash("error", "Something went wrong");
    return res.redirect("/change-phone");
  }
};

const addingAddressFromCheckout = async (req, res) => {
  try {
    console.log("Hitting /addAddressFromCheckout");
    console.log("Received address data:", req.body);

    const userId = req.body.userId || req.session.user; // Fallback to session if used
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const {
      addressType,
      name,
      city,
      landmark,
      state,
      pincode,
      phone,
      altPhone,
    } = req.body;
    const missingFields = [];
    if (!addressType) missingFields.push("addressType");
    if (!name) missingFields.push("name");
    if (!city) missingFields.push("city");
    if (!landmark) missingFields.push("landmark");
    if (!state) missingFields.push("state");
    if (!pincode) missingFields.push("pincode");
    if (!phone) missingFields.push("phone");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
        missing: missingFields,
      });
    }

    let userAddress = await Address.findOne({ userId: userData._id });
    const newAddressEntry = {
      addressType,
      name,
      city,
      landmark,
      state,
      pincode,
      phone,
      altPhone,
    };

    if (!userAddress) {
      userAddress = new Address({
        userId: userData._id,
        address: [newAddressEntry],
      });
    } else {
      userAddress.address.push(newAddressEntry);
    }

    await userAddress.save();
    res
      .status(200)
      .json({ success: true, message: "Address added successfully" });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const editAddressFromCheckout = async (req, res) => {
  try {
    const {
      userId,
      addressId,
      addressType,
      name,
      city,
      landmark,
      state,
      pincode,
      phone,
      altPhone,
    } = req.body;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }
    if (!addressId) {
      return res
        .status(400)
        .json({ success: false, message: "Address ID is required" });
    }

    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const missingFields = [];
    if (!addressType) missingFields.push("addressType");
    if (!name) missingFields.push("name");
    if (!city) missingFields.push("city");
    if (!landmark) missingFields.push("landmark");
    if (!state) missingFields.push("state");
    if (!pincode) missingFields.push("pincode");
    if (!phone) missingFields.push("phone");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
        missing: missingFields,
      });
    }

    const userAddress = await Address.findOne({ userId: userData._id });
    if (!userAddress) {
      return res
        .status(404)
        .json({ success: false, message: "Address document not found" });
    }

    const addressIndex = userAddress.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );
    if (addressIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    userAddress.address[addressIndex] = {
      addressType,
      name,
      city,
      landmark,
      state,
      pincode,
      phone,
      altPhone,
    };
    await userAddress.save();

    res
      .status(200)
      .json({ success: true, message: "Address updated successfully" });
  } catch (error) {
    console.error("Error editing address:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  getResetPassPage,
  resendOtp,
  postNewPassword,
  userProfile,
  changeEmail,
  changeEmailValid,
  verifyEmailOtp,
  updateEmail,
  changeUserPass,
  changeUserPassPost,
  addAddress,
  postAddAddress,
  editAddress,
  postEditAddress,
  deleteAddress,
  changeName,
  changeNamePost,
  changePhone,
  changePhonePost,
  addingAddressFromCheckout,
  editAddressFromCheckout,
};
