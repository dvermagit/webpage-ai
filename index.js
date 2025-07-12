// import axios from "axios";
// import dotenv from "dotenv";
// import * as cheerio from "cheerio";
// import { google } from "@ai-sdk/google";
// import { ChromaClient } from "chromadb";

// dotenv.config();

// const chroma = new ChromaClient({ path: "http://localhost:8000" });
// chroma.heartbeat();
// // try {
// //   const heartbeat = await chroma.heartbeat();
// //   console.log("ChromaDB is running:", heartbeat);
// // } catch (error) {
// //   console.error("ChromaDB connection failed:", error.message);
// // }

// const WEB_COLLECTION = `WEB_SCRAPED_DATA_COLLECTION`;

// async function scrapeWebpage(url = "") {
//   const { data } = await axios.get(url);
//   const $ = cheerio.load(data);

//   const pageHead = $("head").html();
//   const pageBody = $("body").html();

//   const internalLinks = new Set();
//   const externalLinks = new Set();

//   $("a").each((_, el) => {
//     const link = $(el).attr("href");
//     if (link === "/") return; // Ignore root link
//     if (link.startsWith("http") || link.startsWith("https")) {
//       externalLinks.add(link);
//     } else {
//       internalLinks.add(link);
//     }
//   });

//   return {
//     head: pageHead,
//     body: pageBody,
//     internalLinks: Array.from(internalLinks),
//     externalLinks: Array.from(externalLinks),
//   };
// }

// export async function generateVectorEmbeddings({ url, text }) {
//   const model = google.textEmbeddingModel("text-embedding-004", {
//     taskType: "RETRIEVAL_DOCUMENT",
//   });
//   const response = await model.doEmbed({
//     values: [text],
//   });
//   return response.embeddings[0];
// }

// // async function insertIntoChromaDB({ embedding, url, head, body = "" }) {
// //   const collection = await chroma.getOrCreateCollection({
// //     name: WEB_COLLECTION,
// //   });

// //   await collection.add({
// //     ids: [url],
// //     embeddings: [embedding],
// //     metadatas: [{ url, head, body }],
// //   });
// // }

// async function getOrCreateCollection() {
//   try {
//     // Try to get existing collection first
//     const collection = await chroma.getCollection({
//       name: WEB_COLLECTION,
//       embeddingFunction: {
//         // Explicitly tell ChromaDB we'll provide our own embeddings
//         generate: async () => [],
//       },
//     });
//     // console.log(`📦 Using existing collection: ${WEB_COLLECTION}`);
//     return collection;
//   } catch (error) {
//     // If collection doesn't exist, create it
//     try {
//       const collection = await chroma.createCollection({
//         name: WEB_COLLECTION,
//         embeddingFunction: {
//           generate: async () => [],
//         },
//       });
//       // console.log(`📦 Created new collection: ${WEB_COLLECTION}`);
//       return collection;
//     } catch (createError) {
//       // console.error("❌ Failed to create collection:", createError.message);
//       throw createError;
//     }
//   }
// }

// async function insertIntoChromaDB({ embedding, url, head, body = "" }) {
//   const collection = await getOrCreateCollection();

//   // Create unique ID for each chunk
//   const id = `${url}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//   try {
//     await collection.add({
//       ids: [id],
//       embeddings: [embedding],
//       metadatas: [{ url, head, body }],
//     });
//     // console.log(`✅ Added document to ChromaDB: ${url}`);
//   } catch (error) {
//     // console.error("❌ Failed to insert into ChromaDB:", error.message);
//     throw error;
//   }
// }

// async function resetCollection() {
//   try {
//     await chroma.deleteCollection({ name: WEB_COLLECTION });
//     console.log(`🗑️ Deleted collection: ${WEB_COLLECTION}`);
//   } catch (error) {
//     console.log(
//       // `ℹ️ Collection ${WEB_COLLECTION} doesn't exist or already deleted`
//       error
//     );
//   }
// }

// async function ingest(url = "") {
//   console.log(`✨ Ingesting URL: ${url}`);
//   const { head, body, internalLinks } = await scrapeWebpage(url);
//   const bodyChunks = chunkText(body, 1000); // Chunk the body text into 1000-word segments
//   const headEmbedding = await generateVectorEmbeddings({ text: head });
//   await insertIntoChromaDB({
//     embedding: headEmbedding,
//     url,
//   });
//   for (const chunk of bodyChunks) {
//     if (chunk.trim()) {
//       // Only process non-empty chunks
//       const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
//       await insertIntoChromaDB({
//         embedding: bodyEmbedding,
//         url,
//         head,
//         body: chunk,
//       });
//     }
//   }

//   // for (const link of internalLinks) {
//   //   const _url = `${url}${link}`;
//   //   await ingest(_url);
//   // }
//   console.log(`✅ Ingesting Success URL: ${url}`);
// }

// await resetCollection(); // Reset the collection before starting
// ingest("https://www.piyushgarg.dev");
// // ingest("https://www.piyushgarg.dev/about");
// // ingest("https://www.piyushgarg.dev/cohort");

// async function chat(question = " ") {
//   const questionEmbedding = await generateVectorEmbeddings({
//     text: question,
//   });
//   const collection = await getOrCreateCollection();

//   const collectionResults = await collection.query({
//     nResults: 3,
//     queryEmbeddings: [questionEmbedding],
//   });

//   const bodyResults = collectionResults.metadatas[0]
//     .map((doc) => doc.body)
//     .filter((body) => body && body.trim() !== "");

//   const headResults = collectionResults.metadatas[0]
//     .map((doc) => doc.head)
//     .filter((head) => head && head.trim() !== "");

//   console.log("📄 Body results:", bodyResults);
//   console.log(
//     "📋 Head results:",
//     headResults.length > 0 ? ["<head content found>"] : []
//   );

//   return {
//     bodyResults,
//     headResults: collectionResults.metadatas[0].map((doc) => doc.head),
//     distances: collectionResults.distances[0],
//     urls: collectionResults.metadatas[0].map((doc) => doc.url),
//   };
// }

// chat("What is the purpose of this website?");
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

import axios from "axios";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { google } from "@ai-sdk/google";
import { ChromaClient } from "chromadb";
import { generateText } from "ai";

dotenv.config();

const chroma = new ChromaClient({ path: "http://localhost:8000" });
chroma.heartbeat();

const WEB_COLLECTION = `WEB_SCRAPED_DATA_COLLECTION`;

async function scrapeWebpage(url = "") {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const pageHead = $("head").html();
  const pageBody = $("body").html();

  const internalLinks = new Set();
  const externalLinks = new Set();

  $("a").each((_, el) => {
    const link = $(el).attr("href");
    if (link === "/") return; // Ignore root link
    if (link.startsWith("http") || link.startsWith("https")) {
      externalLinks.add(link);
    } else {
      internalLinks.add(link);
    }
  });

  return {
    head: pageHead,
    body: pageBody,
    internalLinks: Array.from(internalLinks),
    externalLinks: Array.from(externalLinks),
  };
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

async function getOrCreateCollection() {
  try {
    // Try to get existing collection first
    const collection = await chroma.getCollection({
      name: WEB_COLLECTION,
      embeddingFunction: {
        // Explicitly tell ChromaDB we'll provide our own embeddings
        generate: async () => [],
      },
    });
    // console.log(`📦 Using existing collection: ${WEB_COLLECTION}`);
    return collection;
  } catch (error) {
    // If collection doesn't exist, create it
    try {
      const collection = await chroma.createCollection({
        name: WEB_COLLECTION,
        embeddingFunction: {
          generate: async () => [],
        },
      });
      // console.log(`📦 Created new collection: ${WEB_COLLECTION}`);
      return collection;
    } catch (createError) {
      // console.error("❌ Failed to create collection:", createError.message);
      throw createError;
    }
  }
}

async function insertIntoChromaDB({ embedding, url, head, body = "" }) {
  const collection = await getOrCreateCollection();

  // Create unique ID for each chunk
  const id = `${url}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    await collection.add({
      ids: [id],
      embeddings: [embedding],
      metadatas: [{ url, head, body }],
    });
    // console.log(`✅ Added document to ChromaDB: ${url}`);
  } catch (error) {
    // console.error("❌ Failed to insert into ChromaDB:", error.message);
    throw error;
  }
}

async function resetCollection() {
  try {
    await chroma.deleteCollection({ name: WEB_COLLECTION });
    console.log(`🗑️ Deleted collection: ${WEB_COLLECTION}`);
  } catch (error) {
    console.log(
      `ℹ️ Collection ${WEB_COLLECTION} doesn't exist or already deleted`
    );
  }
}

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

async function ingest(url = "") {
  console.log(`✨ Ingesting URL: ${url}`);

  try {
    const { head, body, internalLinks } = await scrapeWebpage(url);

    // Process head content
    if (head && head.trim()) {
      const headEmbedding = await generateVectorEmbeddings({ text: head });
      await insertIntoChromaDB({
        embedding: headEmbedding,
        url,
        head,
        body: "", // Empty body for head chunks
      });
    }

    // Process body content in chunks
    if (body && body.trim()) {
      const bodyChunks = chunkText(body, 1000);

      for (const chunk of bodyChunks) {
        if (chunk.trim()) {
          // Only process non-empty chunks
          const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
          await insertIntoChromaDB({
            embedding: bodyEmbedding,
            url,
            head,
            body: chunk,
          });
        }
      }
    }

    console.log(`✅ Ingesting Success URL: ${url}`);
  } catch (error) {
    // console.error(`❌ Error ingesting ${url}:`, error.message);
    throw error;
  }
}

async function chat(question = " ") {
  console.log(`🤖 Searching for: "${question}"`);

  try {
    const questionEmbedding = await generateVectorEmbeddings({
      text: question,
    });

    const collection = await getOrCreateCollection();

    const collectionResults = await collection.query({
      nResults: 3,
      queryEmbeddings: [questionEmbedding],
    });

    console.log(`📊 Found ${collectionResults.metadatas[0].length} results`);

    const bodyResults = collectionResults.metadatas[0]
      .map((doc) => doc.body)
      .filter((body) => body && body.trim() !== "");

    const headResults = collectionResults.metadatas[0]
      .map((doc) => doc.head)
      .filter((head) => head && head.trim() !== "");

    const urls = collectionResults.metadatas[0].map((doc) => doc.url);
    // console.log("📄 Body results:", bodyResults);
    // console.log(
    //   "📋 Head results:",
    //   headResults.length > 0 ? ["<head content found>"] : []
    // );

    const combinedContext = [
      ...bodyResults,
      ...headResults.map((head) => `HEAD_CONTENT: ${head}`),
    ].join("\n\n");

    const response = await generateText({
      model: google("gemini-2.5-pro"),
      messages: [
        {
          role: "system",
          content:
            "You are an AI support agent expert in providing support to user on behalf of a website. Given the context about page context,reply the user accordingly",
        },
        {
          role: "user",
          content: `
            Query: ${question}

            Sources: ${urls.join(", ")}

            Retrieved Context: ${combinedContext}

            Please answer the user's question based on the provided context.`,
        },
      ],
    });

    console.log(`🤖: ${response.text}`);

    return {
      bodyResults,
      headResults,
      distances: collectionResults.distances[0],
      urls: collectionResults.metadatas[0].map((doc) => doc.url),
      response: response.text,
    };
  } catch (error) {
    // console.error("❌ Error in chat function:", error.message);
    throw error;
  }
}

// Main execution function
async function main() {
  try {
    // Reset and ingest data
    await resetCollection();
    await ingest("https://www.piyushgarg.dev");

    // Wait a moment for data to be fully indexed
    console.log("⏳ Waiting for data to be indexed...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Now query the data
    const results = await chat("What is the purpose of this website?");

    console.log("\n🎯 Final Results:");
    console.log("Body chunks found:", results.bodyResults.length);
    console.log("Head content found:", results.headResults.length);
    console.log("Search distances:", results.distances);
  } catch (error) {
    // console.error("❌ Main execution error:", error.message);
    throw error;
  }
}

// Run the main function
main();
