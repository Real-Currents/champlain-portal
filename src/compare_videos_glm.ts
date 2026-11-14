/**
 * Compare two videos using GLM-5V-Turbo via OpenRouter.
 * Sends both videos as base64 data URLs in a single message and asks
 * for a quality comparison focusing on water, trees, and terrain.
 */
import { readFileSync } from "node:fs";
import { OpenRouter } from "@openrouter/sdk";

const VIDEO_A = process.argv[2] ?? "/home/revlin/Videos/Lake_Champlain_av1_16_9.mp4";
const VIDEO_B = process.argv[3] ?? "/home/revlin/Videos/Lake_Champlain_hermes_test.mp4";
const MODEL = process.env.GLM_MODEL ?? "z-ai/glm-5v-turbo";
const PROMPT = process.argv[4] ??
  "I am showing you two videos of Lake Champlain. " +
  "Video A (first) is the original reference footage. " +
  "Video B (second) is a VR180 fisheye stereo render from a Blender 3D scene. " +
  "Please compare the quality of the following elements between the two videos:\n" +
  "1. WATER: Compare the appearance, motion, and realism of the water surface.\n" +
  "2. TREES: Compare the dead trees / branches — their shape, texture, and placement.\n" +
  "3. TERRAIN: Compare the landscape / ground — elevation, texture, and naturalness.\n" +
  "For each element, describe what you see in both videos and assess how closely " +
  "the Blender render (Video B) matches the reference footage (Video A). " +
  "Be specific about differences in color, detail, and realism.";

function loadVideoDataUrl(path: string): { url: string; bytes: number } {
  const buf = readFileSync(path);
  const b64 = buf.toString("base64");
  return { url: `data:video/mp4;base64,${b64}`, bytes: buf.length };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  console.log(`Model:    ${MODEL}`);
  console.log(`Video A:  ${VIDEO_A}`);
  console.log(`Video B:  ${VIDEO_B}`);

  const a = loadVideoDataUrl(VIDEO_A);
  const b = loadVideoDataUrl(VIDEO_B);
  console.log(`Video A:  ${(a.bytes / 1024 / 1024).toFixed(1)} MB (${(a.url.length / 1024).toFixed(0)} KB base64 payload)`);
  console.log(`Video B:  ${(b.bytes / 1024 / 1024).toFixed(1)} MB (${(b.url.length / 1024).toFixed(0)} KB base64 payload)`);
  console.log("Sending non-streaming request...\n");

  const client = new OpenRouter({ apiKey });

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: PROMPT },
        { type: "text", text: "Video A (reference footage):" },
        { type: "video_url", videoUrl: { url: a.url } },
        { type: "text", text: "Video B (Blender VR180 render):" },
        { type: "video_url", videoUrl: { url: b.url } },
      ],
    },
  ] as any;

  const t0 = Date.now();
  try {
    const response = await client.chat.send({
      chatRequest: { model: MODEL, messages, stream: false },
    } as any);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`SUCCESS in ${elapsed}s\n`);
    console.log("=== GLM-5V-Turbo Comparison ===\n");
    console.log((response as any).choices?.[0]?.message?.content);
    console.log("\nUsage:", JSON.stringify((response as any).usage ?? {}, null, 2));
  } catch (err: any) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`FAILED in ${elapsed}s`);
    console.error("name:   ", err?.name);
    console.error("message:", err?.message);
    console.error("status: ", err?.status ?? err?.statusCode);
    if (err?.response) {
      try {
        console.error("response body:", JSON.stringify(err.response, null, 2));
      } catch {
        console.error("response body (raw):", err.response);
      }
    }
    if (err?.error) console.error("error detail:", JSON.stringify(err.error, null, 2));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exitCode = 1;
});
