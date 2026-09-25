import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const revision = "751bff37182d3f1213fa05d7196b954e230abad9";
const root = new URL("./models/Xenova/all-MiniLM-L6-v2/", import.meta.url);
for (const name of [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "vocab.txt",
  "onnx/model_quantized.onnx",
]) {
  const response = await fetch(
    `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${revision}/${name}`,
  );
  if (!response.ok) throw new Error(`Model download failed: ${name} ${response.status}`);
  const target = new URL(name, root);
  await mkdir(fileURLToPath(new URL(".", target)), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${name}`);
}
await writeFile(
  new URL("NOTICE.txt", root),
  `Xenova/all-MiniLM-L6-v2, revision ${revision}. Apache-2.0.\nhttps://huggingface.co/Xenova/all-MiniLM-L6-v2\n`,
);
