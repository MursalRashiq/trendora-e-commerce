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
const morgan = require("morgan")
const helmet = require("helmet")

connectDB();

const app = express();

// Body parsers (Express built-in)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  "/admin/productImages",
  express.static(path.join(__dirname, "public/admin/productImages"))
);
// app.use(morgan("dev"))
// app.use(helmet())
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

app.use(express.urlencoded({ extended: true })); 
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

// Admin Error Handler
app.use((err, req, res, next) => {
  if (req.session.admin) {
    console.error("Admin Error:", err.message);

    return res.status(500).render("admin-error", {
      message:
        err.message ||
        "Something went wrong with the admin action. Please try again later.",
    });
  }
  next(err);
});

// User Error Handler 
app.use((err, req, res, next) => {
  if (!req.session.admin) {
    console.error("User Error:", err.message);

    return res.status(500).render("404", {
      message:
        err.message ||
        "Something went wrong for the user. Please try again later.",
    });
  }
  next(err);
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
