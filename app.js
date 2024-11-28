if(process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express= require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const Review = require("./models/review.js");
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { register } = require("module");
const {isLoggedIn, isOwner, validateListing, validateReview, isReviewAuthor} = require("./views/middleware.js");

const multer = require("multer");
const {storage} = require("./cloudConfig.js");
const upload = multer({ storage });


const userRouter = require("./routes/user.js")


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const dbUrl = process.env.ATLASDB_URL ;

const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: "mysupersecretcode",
    },
    touchafter: 24*3600, 
});

store.on("error", () => {
    console.log("error in mongo session store", err);
});

const sessionOptions = {
    store: store, 
    secret: "mysupersecretcode",
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

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// app.get("/demouser", async (req, res) => {
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "delta-student"
//     });

//     let registeredUser = await User.register(fakeUser, "hellowrold");
//     res.send(registeredUser);
// })

main()
.then(()=>{
    console.log("connected to DB");
})
.catch((err)=>{
    console.log(err);
});

async function main(){
    // await mongoose.connect('mongodb://127.0.0.1:27017/wanderlust');
    await mongoose.connect(dbUrl);
}

// app.get("/", (req, res)=>{
//     console.log("Hi, I am root.");
// });

app.use("/", userRouter);

//INDEX ROUTE
app.get("/listings", wrapAsync(async (req, res)=>{
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", {allListings});
    
}));

//(Create) NEW (Listing) ROUTE
app.get("/listings/new", isLoggedIn, (req, res)=>{
    res.render("listings/new.ejs");
});

//EDIT ROUTE
app.get("/listings/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req, res)=>{
    let {id}= req.params;
    const listing = await Listing.findById(id);
    if(!listing){
        req.flash("error", "Listing not found");
        res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs", {listing, originalImageUrl});
}));

//SHOW ROUTE
app.get("/listings/:id", wrapAsync(async (req, res)=>{
    let {id}= req.params;
    const listing = await Listing.findById(id).populate({path: "reviews", populate: {path: "author"}}).populate("owner");
    if(!listing){
        req.flash("error", "Listing not found");
        res.redirect("/listings");
    }
    console.log(listing);
    res.render("listings/show.ejs", {listing});
}));


//UPDATE ROUTE
app.put("/listings/:id", isLoggedIn, isOwner, upload.single("listing[image]"), validateListing, wrapAsync(async (req, res)=>{  
    let {id}= req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ... req.body.listing });
    
    if(typeof req.file !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = {url, filename};
    await listing.save();
    }
    req.flash("success", "Listing Updated");
    res.redirect(`/listings/${id}`);
})
);

// app.put("/listings/:id", async (req, res)=>{
//     if(!req.body.listing){
//         throw new ExpressError(400, "Send valid data for listing")
//     }
//     let {id}= req.params;
//     const edit =await Listing.findByIdAndUpdate(id, { ... req.body.listing });
//     res.redirect(`/listings/${id}`);
// });

//DELETE ROUTE
app.delete("/listings/:id", isLoggedIn, isOwner, async (req, res)=>{
    let {id}= req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    // console.log(deletedListing);
    req.flash("success", "Listing Deleted");
    res.redirect("/listings")
}); 

// REVIEWS
// POST REVIEW ROUTE 
app.post("/listings/:id/reviews", isLoggedIn, validateReview, wrapAsync(async(req, res) =>{
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    // console.log(newReview);

    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();
    req.flash("success", "New Review Created");

    res.redirect(`/listings/${listing._id}`);
}));

// DELETE REVIEW ROUTE 
app.delete("/listings/:id/reviews/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(async (req, res) =>{
    let {id, reviewId} = req.params;

    await Listing.findByIdAndUpdate(id, {$pull: {reviews: reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash("success", "Review Deleted");
    
    res.redirect(`/listings/${id}`);
}));


//CREATE ROUTE
app.post("/listings", isLoggedIn, upload.single("listing[image]"), validateListing, wrapAsync(async (req, res, next)=>{
    let url = req.file.path;
    let filename = req.file.filename;
    console.log(url, "..", filename);
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url, filename};
    await newListing.save();
    req.flash("success", "New Listing Created");
    res.redirect("/listings");
     })
 );

// app.post("/listings", upload.single("listing[image]"), (req, res) => {
//     res.send(req.file);
// });

// app.post("/listings", wrapAsync(async (req, res, next)=>{
//     if(!req.body.listing){
//         throw new ExpressError(400, "Send valid data for listing")
//     }
//     if(!newListing.title){
//         throw new ExpressError(400, "Title is missing");
//     }
//     if(!newListing.description){
//         throw new ExpressError(400, "Description is missing");
//     }
//     if(!newListing.location){
//         throw new ExpressError(400, "Location is missing");
//     }
//     const newListing = new Listing(req.body.listing);
//       await newListing.save();
//       res.redirect("/listings");
//      })
//  );


// app.post("/listings", wrapAsync(async (req, res, next)=>{
//     if(!req.body.listing){
//         throw new ExpressError(400, "Send valid data for listing")
//     }

//     const newListing = new Listing(req.body.listing);
//       await newListing.save();
//       res.redirect("/listings");
//      })
//  );

 
// app.post("/listings", wrapAsync(async (req, res, next)=>{
//    const newListing = new Listing(req.body.listing);
//      await newListing.save();
//      res.redirect("/listings");
//     })
// );

// app.post("/listings", async (req, res, next)=>{
//    try{
//     const newListing = new Listing(req.body.listing);
//     await newListing.save();
//     res.redirect("/listings");
//    } catch(err){
//     next(err);
//    }  
// });

//app.post("/listings", async (req, res)=>{
    // let {title, description, image, price, country, location} = req.body;
    // let listing = req.body.listing;
  //  const newListing = new Listing(req.body.listing);
    // await newListing.save();
    // res.redirect("/listings");
    // console.log(listing);
// });

// app.get("/testListing", async (req, res)=>{
//     let sampleListing = new Listing({
//         title: "My old Villa",
//         description: "By the beach",
//         price: 1200,
//         location: "Calangute, Goa",
//         country: "India"
//     });
    
//     await sampleListing.save();
//     console.log("sample was saved");
//     res.send("testing successful");
// });

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