const express = require("express");
const dotenv = require("dotenv").config();
const connectDB = require("./config/db");
const path = require("path");
const session = require("express-session");
const passport = require("./config/passport");
const nochache = require("nocache");
const userRouter = require("./routes/user");
const adminRouter = require("./routes/admin");
const bodyParser = require("body-parser");
const flash = require("connect-flash");
const { updateCounts } = require("./middleware/auth");

connectDB();

const app = express();

// Body parsers (Express built-in)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  "/admin/productImages",
  express.static(path.join(__dirname, "public/admin/productImages"))
);

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    },
  })
);

app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

// Prevent browser caching
app.use(nochache());

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);

// Static Files Middleware
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.json());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use(updateCounts);

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
