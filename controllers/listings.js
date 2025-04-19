const Listing = require("../models/listing.js");
const Review = require("../models/review.js");

module.exports.getAllListings = async (req, res)=>{
    let allListings;

    if(req.query.search) {
        allListings = await Listing.find({});
        allListings = allListings.filter((list) => list.title.includes(req.query.search));
    }
    else if(req.query.category) {
        allListings = await Listing.find({category: req.query.category});
    }
    else {
        allListings = await Listing.find({});
    }
    res.render("listings/index.ejs", {allListings});
    
}

module.exports.createNewListing = async (req, res, next)=>{
    let url = req.file.path;
    let filename = req.file.filename;
    // console.log(url, "..", filename);
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url, filename};
    await newListing.save();
    req.flash("success", "New Nest Created");
    res.redirect("/listings");
}



module.exports.sortListings = async (req, res)=>{
    function price(a, b) {
        if (a.price<b.price) {
            return -1;
          } else if (a.price<b.price) {
            return 1;
          }
          return 0;
        }

    const allListings = await Listing.find({});
    allListings.sort(price);
    // console.log(allListings);
    res.render("listings/index.ejs", {allListings});
}




module.exports.editListings = async (req, res)=>{
    let {id}= req.params;
    const listing = await Listing.findById(id);
    if(!listing){
        req.flash("error", "Nest not found");
        res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs", {listing, originalImageUrl});
}



module.exports.showOneListings = async (req, res) => {
    let {id}= req.params;
    const listing = await Listing.findById(id).populate("owner").populate({path: "reviews", populate: {path: "author"}});
    if(!listing){
        req.flash("error", "Nest not found");
        res.redirect("/listings");
    }
    // console.log(listing);
    res.render("listings/show.ejs", {listing});
}


module.exports.updateListings = async (req, res)=>{  
    let {id}= req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ... req.body.listing });
    
    if(typeof(req.file) !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = {url, filename};
    await listing.save();
    }
    req.flash("success", "Nest Updated");
    res.redirect(`/listings/${id}`);
}


module.exports.createReviews = async(req, res) =>{
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    // console.log(newReview);

    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();
    req.flash("success", "New Review Created");

    res.redirect(`/listings/${listing._id}`);
}

module.exports.deleteListings = async (req, res)=>{
    let {id}= req.params;
    await Listing.findByIdAndDelete(id);
    // console.log(deletedListing);
    req.flash("success", "Nest Deleted");
    res.redirect("/listings")
}


module.exports.deleteReviews = async (req, res) =>{
    let {id, reviewId} = req.params;

    await Listing.findByIdAndUpdate(id, {$pull: {reviews: reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash("success", "Review Deleted");
    
    res.redirect(`/listings/${id}`);
}