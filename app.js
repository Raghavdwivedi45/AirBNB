if(process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express= require("express");
const app = express();
const mongoose = require("mongoose");

const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { register } = require("module");


const userRouter = require("./routes/user.js");
const listRouter = require("./routes/listUser.js");


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const dbUrl = process.env.ATLASDB_URL1 + "=true&w=majority&appName=Cluster0";

const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24*3600, 
});

store.on("error", () => {
    console.log("error in mongo session store", err);
});

const sessionOptions = {
    store: store, 
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


main()
.then(()=>{
    console.log("connected to DB");
})
.catch((err)=>{
    console.log(err);
});

async function main(){
    await mongoose.connect(dbUrl);
}


app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.use("/", userRouter);
app.use("/listings", listRouter);


app.all("*", (req, res, next) =>{
    next(new ExpressError(404, "Page Not Found"));
})

app.use((err, req, res, next)=>{
    let {statusCode=500, message="SOMETHING WENT WRONG"} = err;
    // res.render("error.ejs", { message });
    res.status(statusCode).render("error.ejs", { err });
    // res.status(statusCode).send(message);
});

app.listen(8080, ()=>{
    console.log("server is  listening to port 8080");
});