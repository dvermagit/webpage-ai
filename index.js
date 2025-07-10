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
    values: [text],
  });
  return response.embeddings[0];
}

async function insertIntoChromaDB({ embedding, url, head, body = "" }) {
  const collection = await chroma.getOrCreateCollection({
    name: WEB_COLLECTION,
  });

  await collection.add({
    ids: [url],
    embeddings: [embedding],
    metadatas: [{ url, head, body }],
  });
}

async function ingest(url = "") {
  console.log(`✨ Ingesting URL: ${url}`);
  const { head, body, internalLinks } = await scrapeWebpage(url);
  const bodyChunks = chunkText(body, 1000); // Chunk the body text into 1000-word segments
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

// import axios from "axios";
// import dotenv from "dotenv";
// import * as cheerio from "cheerio";
// import { google } from "@ai-sdk/google";
// import { ChromaClient } from "chromadb";

// dotenv.config();

// const chroma = new ChromaClient({ path: "http://localhost:8000" });

// // Test ChromaDB connection
// try {
//   const heartbeat = await chroma.heartbeat();
//   console.log("ChromaDB is running:", heartbeat);
// } catch (error) {
//   console.error("ChromaDB connection failed:", error.message);
//   process.exit(1);
// }

// const WEB_COLLECTION = `WEB_SCRAPED_DATA_COLLECTION`;

// // Set this to true if you want to delete and recreate the collection
// const RESET_COLLECTION = false;

// async function resetCollection() {
//   try {
//     await chroma.deleteCollection({ name: WEB_COLLECTION });
//     console.log(`🗑️  Deleted existing collection: ${WEB_COLLECTION}`);
//   } catch (error) {
//     console.log(
//       `ℹ️  Collection ${WEB_COLLECTION} doesn't exist or already deleted`
//     );
//   }
// }

// async function scrapeWebpage(url = "") {
//   try {
//     const { data } = await axios.get(url);
//     const $ = cheerio.load(data);

//     const pageHead = $("head").html();
//     const pageBody = $("body").html();

//     const internalLinks = [];
//     const externalLinks = [];

//     $("a").each((_, el) => {
//       const link = $(el).attr("href");
//       if (!link || link === "/") return; // Ignore root link and empty links
//       if (link.startsWith("http") || link.startsWith("https")) {
//         externalLinks.push(link);
//       } else if (link.startsWith("/")) {
//         internalLinks.push(link);
//       }
//     });

//     return { head: pageHead, body: pageBody, internalLinks, externalLinks };
//   } catch (error) {
//     console.error(`Error scraping ${url}:`, error.message);
//     throw error;
//   }
// }

// export async function generateVectorEmbeddings({ text }) {
//   try {
//     const model = google.textEmbeddingModel("text-embedding-004", {
//       taskType: "RETRIEVAL_DOCUMENT",
//     });

//     // Fix: Pass an array of strings to doEmbed
//     const response = await model.doEmbed({
//       values: [text], // This is what the SDK expects
//     });

//     return response.embeddings[0];
//   } catch (error) {
//     console.error("Error generating embeddings:", error.message);
//     throw error;
//   }
// }

// // Create a global collection reference to avoid repeated creation attempts
// let globalCollection = null;

// async function getOrCreateCollection() {
//   if (globalCollection) {
//     return globalCollection;
//   }

//   try {
//     // Try to get existing collection first
//     globalCollection = await chroma.getCollection({ name: WEB_COLLECTION });
//     console.log(`📦 Using existing collection: ${WEB_COLLECTION}`);
//   } catch (error) {
//     // If collection doesn't exist, create it
//     try {
//       globalCollection = await chroma.createCollection({
//         name: WEB_COLLECTION,
//       });
//       console.log(`📦 Created new collection: ${WEB_COLLECTION}`);
//     } catch (createError) {
//       // If creation fails due to race condition, try to get it again
//       globalCollection = await chroma.getCollection({ name: WEB_COLLECTION });
//       console.log(
//         `📦 Retrieved collection after race condition: ${WEB_COLLECTION}`
//       );
//     }
//   }

//   return globalCollection;
// }

// async function insertIntoChromaDB({ embedding, url, head, body = "" }) {
//   try {
//     const collection = await getOrCreateCollection();

//     // Create unique ID for each chunk
//     const id = `${url}_${Date.now()}_${Math.random()
//       .toString(36)
//       .substr(2, 9)}`;

//     await collection.add({
//       ids: [id],
//       embeddings: [embedding],
//       metadatas: [{ url, head, body }],
//     });
//   } catch (error) {
//     console.error("Error inserting into ChromaDB:", error.message);
//     throw error;
//   }
// }

// async function ingest(url = "", visited = new Set()) {
//   // Prevent infinite loops
//   if (visited.has(url)) {
//     console.log(`🔄 Already visited: ${url}`);
//     return;
//   }
//   visited.add(url);

//   console.log(`✨ Ingesting URL: ${url}`);

//   try {
//     const { head, body, internalLinks } = await scrapeWebpage(url);

//     // Clean and validate text content
//     const cleanHead = head ? head.replace(/<[^>]*>/g, "").trim() : "";
//     const cleanBody = body ? body.replace(/<[^>]*>/g, "").trim() : "";

//     if (!cleanHead && !cleanBody) {
//       console.log(`⚠️  No content found for ${url}`);
//       return;
//     }

//     // Process head content
//     if (cleanHead) {
//       const headEmbedding = await generateVectorEmbeddings({ text: cleanHead });
//       await insertIntoChromaDB({
//         embedding: headEmbedding,
//         url,
//         head: cleanHead,
//         body: "",
//       });
//     }

//     // Process body content in chunks
//     if (cleanBody) {
//       const bodyChunks = chunkText(cleanBody, 1000);
//       for (const chunk of bodyChunks) {
//         const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
//         await insertIntoChromaDB({
//           embedding: bodyEmbedding,
//           url,
//           head: cleanHead,
//           body: chunk,
//         });
//       }
//     }

//     // Process internal links (limit to prevent infinite recursion)
//     const baseUrl = new URL(url).origin;
//     for (const link of internalLinks.slice(0, 10)) {
//       // Limit to first 10 links
//       const fullUrl = `${baseUrl}${link}`;
//       await ingest(fullUrl, visited);
//     }

//     console.log(`✅ Ingesting Success URL: ${url}`);
//   } catch (error) {
//     console.error(`❌ Error ingesting ${url}:`, error.message);
//   }
// }

// function chunkText(text, chunkSize) {
//   if (!text || typeof text !== "string") {
//     throw new Error("Text must be a non-empty string");
//   }

//   if (!chunkSize || chunkSize <= 0) {
//     throw new Error("Chunk size must be a positive number");
//   }

//   // Split text into words (tokens)
//   const words = text.trim().split(/\s+/);
//   const chunks = [];

//   for (let i = 0; i < words.length; i += chunkSize) {
//     const chunk = words.slice(i, i + chunkSize).join(" ");
//     chunks.push(chunk);
//   }

//   return chunks;
// }

// // Start the ingestion process
// async function main() {
//   // Reset collection if requested
//   if (RESET_COLLECTION) {
//     await resetCollection();
//   }

//   await ingest("https://www.piyushgarg.dev");
//   console.log("🎉 Ingestion completed successfully!");
// }

// main().catch((error) => {
//   console.error("💥 Ingestion failed:", error.message);
//   process.exit(1);
// });
