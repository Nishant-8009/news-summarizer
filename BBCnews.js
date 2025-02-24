import axios from "axios";
import * as cheerio from "cheerio";
import mongoose from "mongoose";
import dotenv from 'dotenv';
import WordPressPostCreator from "./generator.js";
import NewsArticle from "./models/NewsArticle.js";
import TopicSimilarityChecker from "./planner.js";
dotenv.config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/newsDB";

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});



const baseURL = "https://www.bbc.com/news";

// Function to determine category based on URL
function getCategory(url) {
  if (url.includes("/sport")) return "Sports";
  if (url.includes("/politics")) return "Politics";
  if (url.includes("/business")) return "Business";
  if (url.includes("/science")) return "Science";
  if (url.includes("/health")) return "Health";
  if (url.includes("/entertainment")) return "Entertainment";
  if (url.includes("/live")) return "Live";
  if (url.includes("/photo") || url.includes("/gallery")) return "Photo";
  if (url.includes("/video")) return "Videos";
  return "World"; // Default category
}

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url);
    return cheerio.load(data);
  } catch (error) {
    console.error(`Error fetching URL: ${url}`, error);
    return null;
  }
}

async function scrapeNewsHeadlines() {
  const $ = await fetchHTML(baseURL);
  if (!$) return [];

  const articles = [];

  $('a:has(h2[data-testid="card-headline"])').each((index, element) => {
    const title = $(element).find('h2[data-testid="card-headline"]').text().trim();
    const url = new URL($(element).attr("href"), baseURL).href; // Resolve full URL
    const category = getCategory(url); // Extract category

    // Skip unwanted categories
    if (!["Photo", "Live", "Videos"].includes(category) && title && url) {
      articles.push({ title, url, category });
    }
  });

  return articles;
}

async function scrapeArticleContent(url) {
  const $ = await fetchHTML(url);
  if (!$) return "Content not available";

  let paragraphs = [];
  $("article p").each((index, element) => {
    const text = $(element).text().trim();
    if (text) paragraphs.push(text);
  });

  return paragraphs.join("\n");
}

export default async function scrapeBBCNews() {
  const newsArticles = await scrapeNewsHeadlines();
  if (!newsArticles.length) return;

  let newsData = [];

  for (const article of newsArticles) {
    const existingArticle = await NewsArticle.findOne({ url: article.url });
    if (existingArticle ) {
      continue; // Skip if URL already exists
    }
    console.log(`Fetching content from: ${article.url}`);
    const content = await scrapeArticleContent(article.url);

    const newsItem = {
      title: article.title,
      url: article.url,
      category: article.category,
      content: content || "Content not available",
    };
    console.log('Agent Plan: To find similar News in Database.');
    newsData.push(newsItem);
    // Save to MongoDB
      const savedArticle = await new NewsArticle(newsItem).save();
    const similarityChecker = new TopicSimilarityChecker(newsItem.title, newsItem.content);
    const categories = await similarityChecker.checkSimilarityAndCategorize();
    if(categories.length){

      const post = new WordPressPostCreator(
        newsItem.title,
        newsItem.content,
        categories
      );
      try {
        const createPostWithTimeout = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(), 180000); // 180 sec timeout

          post.createPost().then((result) => {
            clearTimeout(timer);
            resolve(result);
          }).catch(() => reject());
        });

        await createPostWithTimeout;
      } catch {
        await NewsArticle.deleteOne({ _id: savedArticle._id }); // Delete if failed
      }
    }
  }
 
}

// scrapeBBCNews();
