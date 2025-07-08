import axios from "axios";
import * as cheerio from "cheerio";
import { google } from "ai-sdk/google";
async function scrapeWebpage(url = "") {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const pageHead = $("head").html();
  const pageBody = $("body").html();

  const internalLinks = [];
  const externalLinks = [];

  $("a").each((_, el) => {
    const link = $(el).attr("href");
    if (link === "/") return; // Ignore root link
    if (link.startsWith("http") || link.startsWith("https")) {
      externalLinks.push(link);
    } else {
      internalLinks.push(link);
    }
  });

  return { head: pageHead, body: pageBody, internalLinks, externalLinks };
}

export async function generateVectorEmbeddings({ url, text }) {
  const model = google.textEmbeddingModel("text-embedding-004");
  const response = await model.embedText({
    text: `${text}`,
    url: url,
  });
  return response.embeddings[0];
}

scrapeWebpage("https://piyushgarg.dev").then(console.log);
