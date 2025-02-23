import mongoose from "mongoose";

const newsSchema = new mongoose.Schema({
    title: String,
    url: { type: String, unique: true },
    category: String,
    content: String,
    scrapedAt: { type: Date, default: Date.now },
  });
  
const NewsArticle = mongoose.model("NewsArticle", newsSchema);

export default NewsArticle;
