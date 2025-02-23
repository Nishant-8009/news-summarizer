import mongoose from "mongoose";
import { GoogleGenerativeAI } from '@google/generative-ai';
import NewsArticle from './models/NewsArticle.js'; // Import your schema
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/newsDB";
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Gemini API setup
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export default class TopicSimilarityChecker {
    constructor(newTitle, newDescription) {
        this.newTitle = newTitle;
        this.newDescription = newDescription;
    }

    async generateResponse(prompt) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            if (result?.response?.candidates?.length > 0) {
                const firstCandidate = result.response.candidates[0];
                if (firstCandidate.content?.parts?.length > 0) {
                    const textPart = firstCandidate.content.parts[0];
                    return typeof textPart === 'string' ? textPart : textPart.text;
                }
            }
            return 'No response available.';
        } catch (error) {
            console.error('Error generating text:', error);
            return 'Error generating text.';
        }
    }

    async isSimilarTopicExists() {
        const batchSize = 60; // Number of entries to process per batch
        let skip = 0;

        while (true) {
            // Fetch a batch of entries from the database
            const entries = await NewsArticle.find().skip(skip).limit(batchSize).exec();

            if (entries.length === 0) {
                break; // No more entries to check
            }

            // Prepare the prompt for Gemini
            const batchTitlesDescriptions = entries.map(entry => `Title: ${entry.title}\nDescription: ${entry.content}\n`).join('\n\n');
            const prompt = `
    You are an AI assistant that checks if a new topic is similar to existing topics in a database.
    Your task is to compare the new topic with the existing topics and determine if they are similar based on the **focus of the content** and **temporal context**.
    Focus on the main subject, context, key details, and timing of the news articles. Do not consider superficial similarities like similar words or phrases unless they indicate the same core topic at the same point in time.

    New Topic:
    Title: ${this.newTitle}
    Description: ${this.newDescription}

    Existing Topics:
    ${batchTitlesDescriptions}

    Compare the new topic with the existing topics. If any of the existing topics are similar to the new topic more than 80% then, respond with "YES". Otherwise, respond with "NO".
`;

            // Call Gemini API
            const response = await this.generateResponse(prompt);

            // Check the response
            if (response.includes("YES")) {
                return "YES"; // Similar topic found
            }

            // Move to the next batch
            skip += batchSize;

            // Respect API rate limits (4 requests per minute)
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15-second delay
        }

        return "NO"; // No similar topic found
    }

    async determineCategories() {
        const prompt = `
            You are an AI assistant that determines the categories for a news article based on its title and description.
            The categories can include:
            - City, State, District (if the news is local or regional):
                - If the news is about a district, include the district name, city name, and state name.
                - If the news is about a city, include the city name and state name.
                - If the news is about a state, include only the state name.
            - Sports and the name of the sport (if the news is related to sports)
            - Politics (if the news is related to politics)
            - World and the country name (if the news is international)
            - Entertainment (if the news is related to entertainment)
            - Education (if the news is related to education)
    
            Based on the following title and description, determine the appropriate categories and return them as a comma-separated list.
            For city, state, and district, include the specific names as applicable.
            Exclude generic terms like "City", "State", or "District" from the response. Only include specific names and relevant categories.
            Ensure that each category is separated by a comma and a space (e.g., "Education, Mumbai, Maharashtra").
    
            Title: ${this.newTitle}
            Description: ${this.newDescription}
    
            Respond only with the comma-separated list of categories. Do not include any additional text.
        `;
    
        const response = await this.generateResponse(prompt);
    
        // Clean the response and split into categories
        const categories = response
            .replace(/\n/g, '') // Remove all newline characters
            .split(',') // Split by commas
            .map(category => category.trim()) // Trim each category
            .filter(category => category.length > 0) // Remove empty strings
            .flatMap(category => {
                // Handle cases like "Sports and Football"
                if (category.includes(' and ')) {
                    return category.split(' and ').map(subCategory => subCategory.trim());
                }
                return [category]; // Return the category as is
            });
    
        return categories;
    }

    async checkSimilarityAndCategorize() {
        const similarityResult = await this.isSimilarTopicExists();

        if (similarityResult === "NO") {
            console.log('Agent Found: No similar News');
            console.log('Agent Action: To find categories for the News.');
            const categories = await this.determineCategories();
            console.log(`Categories Founded: ${categories.join(', ')}`);
            console.log(`Agent action: To find make the SEO for the Post.`);
            return categories;
        } else {
            console.log("Agent Found: Similar topic already exists.");
            console.log('Agent action: To scrap the next News.');
            return [];
        }
    }
}
