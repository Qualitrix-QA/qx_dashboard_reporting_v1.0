import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: "jira-proxy-middleware",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith("/api/jira-proxy")) {
            try {
              const targetHost = req.headers["x-jira-target"];
              if (typeof targetHost !== "string") {
                res.statusCode = 400;
                res.end("Missing x-jira-target header");
                return;
              }

              // Strip /api/jira-proxy from the url to get the rest of the path
              const restPath = req.url.replace(/^\/api\/jira-proxy/, "");
              const targetUrl = `${targetHost.replace(/\/$/, "")}${restPath}`;

              // Forward the request using Node's native fetch
              const headers: Record<string, string> = {
                "accept": "application/json",
              };
              if (req.headers["authorization"]) {
                headers["authorization"] = req.headers["authorization"] as string;
              }

              const response = await fetch(targetUrl, {
                method: req.method || "GET",
                headers,
              });

              res.statusCode = response.status;
              const contentType = response.headers.get("content-type");
              if (contentType) {
                res.setHeader("content-type", contentType);
              }
              res.setHeader("Access-Control-Allow-Origin", "*");

              const bodyText = await response.text();
              res.end(bodyText);
            } catch (err: any) {
              console.error("[Jira Proxy Middleware Error]:", err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
