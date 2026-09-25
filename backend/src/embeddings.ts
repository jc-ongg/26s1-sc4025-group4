import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
env.allowRemoteModels = false;
env.localModelPath = fileURLToPath(new URL("../models/", import.meta.url));
const modelId = "Xenova/all-MiniLM-L6-v2";
export const modelVersion = "MiniLM-L6-v2 / q8 / 751bff3";
let model: Promise<FeatureExtractionPipeline> | undefined;
// Serialize CPU inference to avoid competing sessions allocating model buffers at once.
let queue: Promise<unknown> = Promise.resolve();
// A model-version change invalidates stored vectors as well as text edits.
export function embeddingHash(text: string) {
  return createHash("sha256")
    .update(modelVersion + text)
    .digest("hex");
}
export function embed(text: string): Promise<number[]> {
  const job = queue.then(async () => {
    model ??= pipeline<"feature-extraction">("feature-extraction", modelId, {
      dtype: "q8",
      device: "cpu",
    });
    try {
      const output = await (await model)(text, { pooling: "mean", normalize: true });
      const vector = Array.from(output.data, Number);
      if (vector.length !== 384 || vector.some((v) => !Number.isFinite(v)))
        throw new Error("Invalid embedding");
      return vector;
    } catch (error) {
      model = undefined;
      throw error;
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
