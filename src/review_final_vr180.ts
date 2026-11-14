/**
 * Review the final VR180 encode using GLM-5V-Turbo via OpenRouter.
 */
import { readFileSync } from "node:fs";
import { OpenRouter } from "@openrouter/sdk";

const VIDEO_PATH =
  "/home/revlin/Projects/Currents/webxr-champlain-portal/public/assets/Lake_Champlain_hermes_test.mp4";
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
  console.log(`Video file bytes: ${bytes} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Base64 chars:     ${url.length} (~${(url.length / 1024 / 1024).toFixed(1)} MB payload)`);
  console.log("Sending non-streaming request...\n");

  const client = new OpenRouter({ apiKey });

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "This is a 30-second VR180 stereo SBS fisheye render of a Lake Champlain 3D scene " +
            "rendered in Blender with Cycles. The left and right halves are left-eye and right-eye " +
            "fisheye views. Please review: " +
            "1) Does the water surface show visible animation/motion across the clip? " +
            "2) Is the fisheye projection correct (circular images with black corners)? " +
            "3) Are there any rendering artifacts, black frames, or blown-out surfaces? " +
            "4) Does the scene read as a natural lake environment? " +
            "5) Any issues with the stereo 3D offset between the two eye views? " +
            "Be specific and concise.",
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
    console.log(`SUCCESS in ${elapsed}s\n`);
    console.log("=== GLM-5V-Turbo Video Review ===\n");
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
