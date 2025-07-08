import axios from "axios";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { google } from "@ai-sdk/google";

dotenv.config();
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

async function ingest(url = "") {
  const { head, body, internalLinks } = await scrapeWebpage(url);
  const bodyChunks = chunkText(body, 1000); // Chunk the body text into 1000-word segments
  const headEmbedding = await generateVectorEmbeddings({ text: head });
  for (const chunk of bodyChunks) {
    const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
    console.log("Chunk Embedding:", bodyEmbedding);
  }

  console.log("Head Embedding:", headEmbedding);
  console.log("Body Embedding:", bodyEmbedding);
}
scrapeWebpage("https://piyushgarg.dev").then(console.log);

function chunkText(text, chunkSize) {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string");
  }

  if (!chunkSize || chunkSize <= 0) {
    throw new Error("Chunk size must be a positive number");
  }

  // Split text into words (tokens)
  const words = text.trim().split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    chunks.push(chunk);
  }

  return chunks;
}
