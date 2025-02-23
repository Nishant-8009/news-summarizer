
import scrapeBBCNews from "./BBCnews.js";
import TOIArticles from "./TOInews.js";
let isScraping = false;

async function runNewsScrapers() {
  if (isScraping) {
    console.log("Scraping is already in progress. Skipping this run.");
    return;
  }

  isScraping = true;
  console.log("Starting news scraping...");

  try {
    await scrapeBBCNews();
    await TOIArticles();
  } catch (error) {
    console.error("Error running news scrapers:", error);
  }

  isScraping = false;
  console.log("Scraping finished. Waiting for next run...");
}
  
// Run the scrapers every 10 minutes (600,000 ms) only if previous scraping is done
setInterval(runNewsScrapers, 10 * 60 * 1000);

// Start immediately when the script runs
runNewsScrapers();
