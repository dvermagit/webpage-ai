import axios from "axios";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { google } from "@ai-sdk/google";
import { ChromaClient } from "chromadb";

dotenv.config();

const chroma = new ChromaClient({ path: "http://localhost:8000" });
chroma.heartbeat();
// try {
//   const heartbeat = await chroma.heartbeat();
//   console.log("ChromaDB is running:", heartbeat);
// } catch (error) {
//   console.error("ChromaDB connection failed:", error.message);
// }

const WEB_COLLECTION = `WEB_SCRAPED_DATA_COLLECTION`;

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
  const model = google.textEmbeddingModel("text-embedding-004", {
    taskType: "RETRIEVAL_DOCUMENT",
  });
  const response = await model.doEmbed({
    text: `${text}`,
    url: url,
  });
  return response.embeddings[0];
}

async function insertIntoChromaDB({ embedding, url, head, body = "" }) {
  const collection = await chroma.createCollection({ name: WEB_COLLECTION });

  await collection.add({
    ids: [url],
    embeddings: [embedding],
    metadatas: [{ url, head, body }],
  });
}

async function ingest(url = "") {
  console.log(`✨ Ingesting URL: ${url}`);
  const { head, body, internalLinks } = await scrapeWebpage(url);
  const bodyChunks = chunkText(body, 2000); // Chunk the body text into 1000-word segments
  const headEmbedding = await generateVectorEmbeddings({ text: head });
  await insertIntoChromaDB({
    embedding: headEmbedding,
    url,
  });
  for (const chunk of bodyChunks) {
    const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
    await insertIntoChromaDB({
      embedding: bodyEmbedding,
      url,
      head,
      body: chunk,
    });
  }

  for (const link of internalLinks) {
    const _url = `${url}${link}`;
    await ingest(_url);
  }
  console.log(`✅ Ingesting Success URL: ${url}`);
}

ingest("https://www.piyushgarg.dev");

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
