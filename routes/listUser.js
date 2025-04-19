const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");

const listingController = require("../controllers/listings.js");
const {isLoggedIn, isOwner, validateListing, validateReview, isReviewAuthor} = require("../views/middleware.js");
const multer = require("multer");
const {storage} = require("../cloudConfig.js");
const upload = multer({ storage });

//INDEX ROUTE
router
.route("/")
.get(wrapAsync(listingController.getAllListings))
.post(isLoggedIn, upload.single("listing[image]"), validateListing, wrapAsync(listingController.createNewListing));
//CREATE ROUTE

// SORT LISTINGS w.r.t. PRICE
router.get("/sort", wrapAsync(listingController.sortListings));

//(Create) NEW (Listing) ROUTE
router.get("/new", isLoggedIn, (req, res)=>{
    res.render("listings/new.ejs");
});

//EDIT ROUTE
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editListings));

//SHOW ROUTE
router.get("/:id", wrapAsync(listingController.showOneListings));


//UPDATE ROUTE
router.put("/:id", isLoggedIn, isOwner, upload.single("listing[image]"), validateListing, wrapAsync(listingController.updateListings)
);


//DELETE ROUTE
router.delete("/:id", isLoggedIn, isOwner, listingController.deleteListings); 

// REVIEWS
// POST REVIEW ROUTE 
router.post("/:id/reviews", isLoggedIn, validateReview, wrapAsync(listingController.createReviews));

// DELETE REVIEW ROUTE 
router.delete("/:id/reviews/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(listingController.deleteReviews));


module.exports = router;


    // router.put("/listings/:id", async (req, res)=>{
    //     if(!req.body.listing){
    //         throw new ExpressError(400, "Send valid data for listing")
    //     }
    //     let {id}= req.params;
    //     const edit =await Listing.findByIdAndUpdate(id, { ... req.body.listing });
    //     res.redirect(`/listings/${id}`);
    // });