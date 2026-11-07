const mongoose = require("mongoose");

async function connectToDatabase() {
    await mongoose.connect(process.env.MONGO_URI, {
    dbName: "wynd"
});
    console.log("Connected to MongoDB Atlas successfully");
}

module.exports = { connectToDatabase };