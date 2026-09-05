import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const apiKey = process.env.GOOGLE_API_KEY || "AIzaSyCU7dt4g8ROrusQVoimrr2G-FXQZQvoEps";
const google = createGoogleGenerativeAI({ apiKey });

const models = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];

for (const modelId of models) {
  console.log(`\n=== Testing ${modelId} ===`);
  try {
    const start = Date.now();
    const result = await generateText({
      model: google(modelId),
      prompt: "Скажи Привет по-русски одним коротким предложением.",
      maxTokens: 100,
      temperature: 0.7,
    });
    const elapsed = Date.now() - start;
    console.log(`  Status: OK (${elapsed}ms)`);
    console.log(`  Response: ${result.text}`);
    console.log(`  Tokens: prompt=${result.usage?.promptTokens}, completion=${result.usage?.completionTokens}, total=${result.usage?.totalTokens}`);
  } catch (error) {
    console.log(`  Status: FAIL`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
