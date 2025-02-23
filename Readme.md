# News AI Agent

## Overview
This project is an AI-driven news summarizer agent that autonomously scrapes news articles from multiple sources (BBC News and TOI News) every 10 minutes. It ensures efficient processing by skipping runs if the previous scraping is not yet completed. The agent filters duplicate URLs and uses Google's Gemini AI to check for similar topics in the database. If a similar article exists, it is skipped; otherwise, the agent categorizes the post, generates SEO metadata, a summary, and finally publishes the article.

## Features
- Automated news scraping every 10 minutes
- Skips duplicate URLs to prevent redundant data
- AI-powered similarity check using Google Gemini API
- Categorizes news articles automatically
- Generates SEO-friendly metadata and summaries
- Posts only unique, well-processed articles

## Installation
### Prerequisites
Ensure you have the following installed:
- Node.js (v18+ recommended)

### Clone the Repository
```sh
git clone https://github.com/your-repo/news-summarizer.git
cd news-summarizer
```

### Install Dependencies
```sh
npm install
```

## Configuration
1. Create a `.env` file in the root directory and add the following environment variables:
```env
HF_API_KEY=<huggingface_api>
GEMINI_API_KEY=<gemini_api>
WORDPRESS_URL=<your_wordpress_url>
WORDPRESS_USERNAME=<your_wordpress_username>
WORDPRESS_APP_PASSWORD=<your_wordpress_app_password>
MONGODB_URI=<your_mongodb_uri>
```

2. Ensure your MongoDB instance is running.

## Running the AI News Agent
Start the news summarizer using:
```sh
npm start
```

## Project Structure
```
news-summarizer/
│-- index.js          # Main entry point (controls scheduling)
│-- planner.js        # AI-powered duplicate check, categorization, SEO, and summary generation
│-- BBCnews.js        # BBC News scraper
│-- TOInews.js        # TOI News scraper
|-- generator.js      # To generate SEO, Summary, Posting to Wordpress 
│-- models/           # Database models (MongoDB Schema)
│-- .sample_env       # Sample of environment file
│-- package.json      # Project dependencies and scripts
```

## How It Works
1. **Scheduled Execution**: Runs every 10 minutes (skipping if the previous run is still in progress).
2. **Scraping**: Extracts articles from BBC and TOI.
3. **Filtering**:
   - If the URL exists in the database, it is skipped.
   - If the title and description are similar to existing articles (checked via Google Gemini AI), it is skipped.
4. **Processing**:
   - Categorizes the article using AI.
   - Generates an SEO-friendly title, description, and keywords.
   - Creates a short summary.
5. **Publishing**: Saves the final article in the database for display on the website.

## Notes
- The Google Gemini API has a rate limit of 4 requests per second; batch processing is optimized accordingly.
- If an article takes longer than 120 seconds to post, it is automatically skipped and deleted.

## License
This project is licensed under the MIT License.

## Author
[Nishant Malhotra](mailto:nishantmalhotra8009@gmail.com)

## Contributions
Feel free to submit pull requests or open issues to improve the project!

---

