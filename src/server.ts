import { watch } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public");
const SRC = join(ROOT, "src");
const ENTRY = join(SRC, "app.ts");
const PORT = Number(process.env.PORT ?? 5173);

let buildCache: { js: string; map: string | null; mtime: number } | null = null;

async function buildBundle(): Promise<{ js: string; map: string | null }> {
    const result = await Bun.build({
        entrypoints: [ENTRY],
        target: "browser",
        format: "esm",
        sourcemap: "external",
        minify: false,
        define: {
            "process.env.NODE_ENV": '"development"',
            global: "globalThis",
        },
    });

    if (!result.success) {
        const log = result.logs.map((l) => l.message).join("\n");
        throw new Error(`build failed:\n${log}`);
    }

    let js = "";
    let map: string | null = null;
    for (const out of result.outputs) {
        const text = await out.text();
        if (out.kind === "sourcemap") map = text;
        else js = text;
    }
    buildCache = { js, map, mtime: Date.now() };
    return { js, map };
}

async function getBundle(): Promise<{ js: string; map: string | null }> {
    if (buildCache) return buildCache;
    return await buildBundle();
}

void (async () => {
    try {
        await buildBundle();
        console.log("[server] initial build ok");
    } catch (err) {
        console.error("[server] initial build failed:", err);
    }
})();

void (async () => {
    try {
        const watcher = watch(SRC, { recursive: true });
        for await (const event of watcher) {
            if (event.filename && /\.(ts|json)$/.test(event.filename)) {
                buildCache = null;
                try {
                    await buildBundle();
                    console.log(`[server] rebuilt (${event.filename})`);
                } catch (err) {
                    console.error("[server] rebuild failed:", err);
                }
            }
        }
    } catch (err) {
        console.warn("[server] watcher exited:", err);
    }
})();

function mime(path: string): string {
    if (path.endsWith(".html")) return "text/html; charset=utf-8";
    if (path.endsWith(".css")) return "text/css; charset=utf-8";
    if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
    if (path.endsWith(".json")) return "application/json; charset=utf-8";
    if (path.endsWith(".svg")) return "image/svg+xml";
    if (path.endsWith(".map")) return "application/json; charset=utf-8";
    return "application/octet-stream";
}

const server = Bun.serve({
    port: PORT,
    development: true,
    fetch: async (req) => {
        const url = new URL(req.url);
        let path = url.pathname;
        if (path === "/") path = "/index.html";

        if (path === "/dist/app.js") {
            try {
                const { js } = await getBundle();
                return new Response(js, { headers: { "content-type": mime(path), "cache-control": "no-store" } });
            } catch (err) {
                return new Response(`/* build error */\nconsole.error(${JSON.stringify(String(err))});`, {
                    status: 500,
                    headers: { "content-type": "application/javascript" },
                });
            }
        }
        if (path === "/dist/app.js.map") {
            const { map } = await getBundle();
            return new Response(map ?? "", { headers: { "content-type": "application/json" } });
        }

        const filePath = join(PUBLIC, path);
        if (!filePath.startsWith(PUBLIC)) return new Response("forbidden", { status: 403 });

        const file = Bun.file(filePath);
        if (!(await file.exists())) return new Response("not found", { status: 404 });
        return new Response(file, { headers: { "content-type": mime(path) } });
    },
});

console.log(`[server] cometa rescue running at http://localhost:${server.port}`);
