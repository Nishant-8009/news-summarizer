import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from "mongoose";
import dotenv from 'dotenv';
import WordPressPostCreator from "./generator.js";
import NewsArticle from './models/NewsArticle.js';
import TopicSimilarityChecker from './planner.js';
dotenv.config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/newsDB";

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const baseUrl = 'https://timesofindia.indiatimes.com/';
const categories = {
    'Mumbai': 'city/mumbai'
};

async function fetchPage(url) {
    try {
        const response = await axios.get(url);
        return cheerio.load(response.data);
    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        return null;
    }
}

async function extractNewsUrls($) {

    const newsUrls = [];
    $('a[href*="/articleshow/"]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href && !newsUrls.includes(href)) {
            newsUrls.push(href);
        }
    });

    return newsUrls;
}

async function extractNewsDetails(url) {
    console.log(`Extracting details from: ${url}`);
    try {
        const $ = await fetchPage(url);
        if (!$) return null;

        // Extract title
        const title = $('h1.HNMDR').text().trim();

        // Extract content
        const content = $('div._s30J').text().trim().replace(/\s+/g, ' ');

        if (!title || !content) {
            console.warn(`No title or content found for URL: ${url}`);
            return null;
        }

        return { title, content };
    } catch (error) {
        console.error(`Error extracting details from ${url}:`, error.message);
        return null;
    }
}

async function scrapeCategory(category, path) {
    const categoryUrl = baseUrl + path;

    const $ = await fetchPage(categoryUrl);
    if (!$) return [];

    const newsUrls = await extractNewsUrls($);
    const newsArticles = [];

    for (const url of newsUrls) {
        const fullUrl = url.startsWith('http') ? url : baseUrl + url;
        // Check if article already exists
        const existingArticle = await NewsArticle.findOne({ url: fullUrl });
        if (existingArticle) {
            continue;
        }

        const details = await extractNewsDetails(fullUrl);
        if (details) {
            const newsItem = {
                title: details.title,
                url: fullUrl,
                content: details.content,
                category,
              };
              console.log('Agent Plan: To find similar News in Database.');
              newsArticles.push(newsItem);
              // Save to MongoDB
                    const savedArticle = await new NewsArticle(newsItem).save();
              const similarityChecker = new TopicSimilarityChecker(newsItem.title, newsItem.content);
              const categories = await similarityChecker.checkSimilarityAndCategorize();
              if(categories.length){
                
                // Create WordPress post
                const post = new WordPressPostCreator(newsItem.title, newsItem.content, categories);
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
    return newsArticles;
}

export default async function TOIArticles() {
    let allArticles = [];
    for (const [category, path] of Object.entries(categories)) {
        const articles = await scrapeCategory(category, path);
        allArticles = allArticles.concat(articles);
    }

}
