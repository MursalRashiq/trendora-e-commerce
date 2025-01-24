const express = require('express');
const dotenv = require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path');
const session = require("express-session");
const passport = require("./config/passport");
const nochache = require("nocache");
const userRouter = require('./routes/user');
const adminRouter = require("./routes/admin");
const bodyParser = require("body-parser");
const flash = require("connect-flash")

connectDB();

const app = express();



// Body parsers (Express built-in)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000, // 72 hours
    }
}));

app.use((req,res,next)=>{
  res.set("cache-control","no-store")
  next()
}
)


// Prevent browser caching
app.use(nochache());

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash())

// Setting up EJS as the templating engine
app.set("view engine", "ejs");
app.set("views", [
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin')
]);

// Static Files Middleware
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.json());


app.use((req, res, next)=>{
  res.locals.user = req.session.user || null;
  next()
})


// Pass flash messages to views
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});



// Routes
app.use("/", userRouter);
app.use("/admin", adminRouter);



// Start the Server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
});
