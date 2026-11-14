/**
 * Probe: does z-ai/glm-5v-turbo actually ingest a base64-inlined mp4 via OpenRouter?
 *
 * Deliberately avoids the pitfalls that sank the GLM-5.2 attempt:
 *   - uses the video-capable model (glm-5v-turbo), not the general glm-5.2
 *   - inlines the file as a real base64 data URL (not a local path string)
 *   - NON-streaming, so an upstream failure returns a readable JSON error
 *     instead of an "empty stream with no finish_reason"
 *   - surfaces the full error body / status for diagnosis
 */
import { readFileSync } from "node:fs";
import { OpenRouter } from "@openrouter/sdk";

const VIDEO_PATH =
  "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/renders/water/water_test.mp4";
const MODEL = process.env.GLM_MODEL ?? "z-ai/glm-5v-turbo";

function loadVideoDataUrl(path: string): { url: string; bytes: number } {
  const buf = readFileSync(path);
  const b64 = buf.toString("base64");
  return { url: `data:video/mp4;base64,${b64}`, bytes: buf.length };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const { url, bytes } = loadVideoDataUrl(VIDEO_PATH);
  console.log(`Model:            ${MODEL}`);
  console.log(`Video file bytes: ${bytes} (${(bytes / 1024).toFixed(0)} KB)`);
  console.log(`Base64 chars:     ${url.length} (~${(url.length / 1024).toFixed(0)} KB payload)`);
  console.log("Sending non-streaming request...\n");

  const client = new OpenRouter({ apiKey });

  // `video_url` is an OpenRouter-specific content part the SDK types may not
  // enumerate, so the content array is cast to bypass compile-time narrowing.
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "This is a 2.5s render of an animated water surface. Describe the " +
            "motion you observe across the clip: is the surface moving, how fast, " +
            "in what direction, and how would you characterize the ripples/waves?",
        },
        { type: "video_url", videoUrl: { url } },
      ],
    },
  ] as any;

  const t0 = Date.now();
  try {
    const response = await client.chat.send({
      chatRequest: { model: MODEL, messages, stream: false },
    } as any);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ SUCCESS in ${elapsed}s\n`);
    console.log("Reply:\n" + (response as any).choices?.[0]?.message?.content);
    console.log("\nUsage:", JSON.stringify((response as any).usage ?? {}, null, 2));
  } catch (err: any) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`❌ FAILED in ${elapsed}s`);
    console.error("name:   ", err?.name);
    console.error("message:", err?.message);
    console.error("status: ", err?.status ?? err?.statusCode);
    // OpenRouter/SDK errors often carry the upstream body here:
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
