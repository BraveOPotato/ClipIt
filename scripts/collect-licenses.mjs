import { readFile, writeFile, copyFile } from "node:fs/promises";

const packages = ["react", "react-dom", "scheduler", "lucide-react", "json5"];
const notices = await Promise.all(
  packages.map(async (name) => {
    const meta = JSON.parse(
      await readFile(`node_modules/${name}/package.json`, "utf8"),
    );
    const text = await readFile(
      `node_modules/${name}/${name === "json5" ? "LICENSE.md" : "LICENSE"}`,
      "utf8",
    );
    return `${name} ${meta.version}\n${"=".repeat(60)}\n${text}`;
  }),
);
notices.push(await readFile("public/ffmpeg-wrapper-LICENSE.txt", "utf8"));
await writeFile("public/DEPENDENCY_LICENSES.txt", notices.join("\n\n"));
await copyFile("LICENSE", "public/COPYING");
