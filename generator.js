import dotenv from 'dotenv';
dotenv.config();
import { HfInference } from "@huggingface/inference";
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

export default class WordPressPostCreator {
    constructor(title, description, category) {
        this.title = title;
        this.description = description;
        this.category = category;

        // WordPress credentials
        this.siteUrl = process.env.WORDPRESS_URL;
        this.username = process.env.WORDPRESS_USERNAME;
        this.applicationPassword = process.env.WORDPRESS_APP_PASSWORD;
        this.auth = Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64');
        this.WP_BASE_URL = `${this.siteUrl}/wp-json/wp/v2`;
        this.WP_AUTH = `Basic ${this.auth}`;

        // Initialize APIs
        this.apiKey = process.env.GEMINI_API_KEY;
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.hfClient = new HfInference(process.env.HF_API_KEY);
    }

    async generateResponse(prompt) {
        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

    async generateSEOData() {
        const promptSEO = `
            Generate an SEO-optimized engaging title and meta description and keywords and engaging description for the given news content.

            Title: "${this.title}"
            Description: "${this.description}"

            Respond ONLY in JSON object:
            {
              "keywords": "Your keywords for topic here",
              "optimized_title": "Your SEO-optimized title here",
              "meta_description": "Your engaging description for topic here" 
            }
        `;
        const gptSeo = await this.generateResponse(promptSEO);
        const cleanedResponse = gptSeo.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanedResponse);
    }

    async generateSummary() {
        const promptSummary = `
            You are an AI assistant specialized in summarizing news articles concisely and accurately.

            Given the following news article details:

            Title: "${this.title}"  
            Content: "${this.description}"  

            Your task is to generate a **well-structured summary** of this article with the following format:  

            1️⃣ **Start with a brief paragraph** summarizing the main idea of the article in **2-3 sentences**.  
            2️⃣ **Follow with key points** that highlight the most important details.  

            ### **Summary Format:**  
            <Brief paragraph summarizing the article>  

            Highlights:  
            - 🔹 [Point 1]  
            - 🔹 [Point 2]  
            - 🔹 [Point 3]  

            Ensure that:  
            - The summary captures the **main points and key events**.  
            - It maintains a **neutral and factual tone**.  
            - Important **names, dates, and locations** are retained for clarity.  
            - If the content is **unclear or lacks information**, mention that explicitly.  
        `;
        return await this.generateResponse(promptSummary);
    }

    async generateImagePrompt() {
        const promptforimgprompt = `
            I have a news article with the following details:  

            Title: "${this.title}"  

            I need a **concise in 2 3 words** image generation prompt for an open-source text-to-image model (like Stable Diffusion).  

            ### **Instructions:**  
            - The prompt should be **short and to the point**, avoiding unnecessary details.  
            - Focus on the **core topic** of the article, ensuring the generated image is relevant.  
            - **Avoid specific names, locations, or complex descriptions**—use common objects, abstract themes, or natural elements for better image quality.  
            - The prompt should create a **visually meaningful** representation of the article.  

            Please generate the **best possible concise image prompt** following these guidelines.  
        `;
        return await this.generateResponse(promptforimgprompt);
    }

    async generateImage(prompt) {
        const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => {
                // console.warn("⏳ Image generation timed out (60 sec), continuing process...");
                resolve(null); // Resolve with null instead of rejecting
            }, 60000)
        );
        
            try {
                const imageBlob = await Promise.race([
                    client.textToImage({
                        model: "CompVis/stable-diffusion-v1-4",
                        inputs: prompt,
                        parameters: { num_inference_steps: 5 },
                        provider: "hf-inference",
                    }),
                    timeoutPromise
                ]);
        
                // Convert Blob to ArrayBuffer
                const buffer = Buffer.from(await imageBlob.arrayBuffer());
        
                return buffer;
            } catch (error) {
               return null;
            }
    }

    async uploadImage(buffer) {
        const mediaResponse = await axios.post(
            `${this.siteUrl}/wp-json/wp/v2/media`,
            buffer,
            {
                headers: {
                    'Content-Disposition': 'attachment; filename=output.png',
                    'Content-Type': 'image/png',
                    'Authorization': `Basic ${this.auth}`
                }
            }
        );
        return mediaResponse.data.id;
    }

    async getCategoryIds(categoryNames) {
        let categoryIds = [];
        for (let categoryName of categoryNames) {
            try {
                // Check if the category already exists
                let response = await axios.get(`${this.WP_BASE_URL}/categories?search=${categoryName}`, {
                    headers: { Authorization: this.WP_AUTH }
                });
    
                if (response.data.length > 0) {
                    // If the category exists, push its ID
                    categoryIds.push(response.data[0].id);
                } else {
                    // If the category doesn't exist, create it
                    response = await axios.post(`${this.WP_BASE_URL}/categories`, {
                        name: categoryName
                    }, {
                        headers: { Authorization: this.WP_AUTH }
                    });
                    // Push the newly created category's ID
                    categoryIds.push(response.data.id);
                }
            } catch (error) {
                console.error(`Error fetching/creating category (${categoryName}):`, error);
            }
        }
    
        return categoryIds;
    }

    async getTagIds(tagsArray) {
        let tagIds = [];
        
        for (let tag of tagsArray) {
            try {
                let response = await axios.get(`${this.WP_BASE_URL}/tags?search=${tag}`, {
                    headers: { Authorization: this.WP_AUTH }
                });

                if (response.data.length > 0) {
                    tagIds.push(response.data[0].id);
                } else {
                    response = await axios.post(`${this.WP_BASE_URL}/tags`, {
                        name: tag
                    }, {
                        headers: { Authorization: this.WP_AUTH }
                    });
                    tagIds.push(response.data.id);
                }
            } catch (error) {
                // console.error(`Error fetching/creating tag (${tag}):`, error.response?.data || error.message);
            }
        }

        return tagIds;
    }

    async createPost() {
        try {
            // Generate SEO data
            const { keywords, optimized_title, meta_description } = await this.generateSEOData();
            console.log('Agent Found: ');
            console.log("\tSEO Keywords:", keywords);
            console.log("\tMeta Description:", meta_description);
            console.log('Agent action: To summarize the content.');
            // Generate summary
            const summary = await this.generateSummary();
            console.log('Agent generated the summary');
            // Generate image prompt and image
            const imagePrompt = await this.generateImagePrompt();

            const imageBuffer = await this.generateImage(imagePrompt);
            let featuredMediaId = null;
            if (imageBuffer) {
                featuredMediaId = await this.uploadImage(imageBuffer);
            }
            
            // Get category and tags
            const categoryId = await this.getCategoryIds(this.category);
            const tagNames = keywords.split(", ");
            const tagIds = await this.getTagIds(tagNames);

            // Create post
            const postData = {
                title: optimized_title,
                content: summary,
                status: "publish",
                categories: categoryId.length >0? categoryId : [], 
                tags: tagIds.length > 0 ? tagIds : [],
                featured_media: featuredMediaId
            };

            const response = await axios.post(
                `${this.siteUrl}/wp-json/wp/v2/posts`,
                postData,
                {
                    headers: { 'Authorization': `Basic ${this.auth}` }
                }
            );
            console.log("Agent made the Post successfully.");
        } catch (error) {
            console.error("Agent found error creating post:", error.response?.data || error.message);
        }
    }
}
