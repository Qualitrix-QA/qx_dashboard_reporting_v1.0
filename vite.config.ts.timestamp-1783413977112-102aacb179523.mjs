// vite.config.ts
import { defineConfig } from "file:///C:/Users/Admin/Documents/qx_dashboard_reporting_v1.0/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Admin/Documents/qx_dashboard_reporting_v1.0/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\Admin\\Documents\\qx_dashboard_reporting_v1.0";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
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
              const restPath = req.url.replace(/^\/api\/jira-proxy/, "");
              const targetUrl = `${targetHost.replace(/\/$/, "")}${restPath}`;
              const headers = {
                "accept": "application/json"
              };
              if (req.headers["authorization"]) {
                headers["authorization"] = req.headers["authorization"];
              }
              const response = await fetch(targetUrl, {
                method: req.method || "GET",
                headers
              });
              res.statusCode = response.status;
              const contentType = response.headers.get("content-type");
              if (contentType) {
                res.setHeader("content-type", contentType);
              }
              res.setHeader("Access-Control-Allow-Origin", "*");
              const bodyText = await response.text();
              res.end(bodyText);
            } catch (err) {
              console.error("[Jira Proxy Middleware Error]:", err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
          next();
        });
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBZG1pblxcXFxEb2N1bWVudHNcXFxccXhfZGFzaGJvYXJkX3JlcG9ydGluZ192MS4wXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBZG1pblxcXFxEb2N1bWVudHNcXFxccXhfZGFzaGJvYXJkX3JlcG9ydGluZ192MS4wXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9BZG1pbi9Eb2N1bWVudHMvcXhfZGFzaGJvYXJkX3JlcG9ydGluZ192MS4wL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gICAgaG1yOiB7XHJcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICB7XHJcbiAgICAgIG5hbWU6IFwiamlyYS1wcm94eS1taWRkbGV3YXJlXCIsXHJcbiAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcclxuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICAgICAgaWYgKHJlcS51cmw/LnN0YXJ0c1dpdGgoXCIvYXBpL2ppcmEtcHJveHlcIikpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zdCB0YXJnZXRIb3N0ID0gcmVxLmhlYWRlcnNbXCJ4LWppcmEtdGFyZ2V0XCJdO1xyXG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0SG9zdCAhPT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDA7XHJcbiAgICAgICAgICAgICAgICByZXMuZW5kKFwiTWlzc2luZyB4LWppcmEtdGFyZ2V0IGhlYWRlclwiKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgIC8vIFN0cmlwIC9hcGkvamlyYS1wcm94eSBmcm9tIHRoZSB1cmwgdG8gZ2V0IHRoZSByZXN0IG9mIHRoZSBwYXRoXHJcbiAgICAgICAgICAgICAgY29uc3QgcmVzdFBhdGggPSByZXEudXJsLnJlcGxhY2UoL15cXC9hcGlcXC9qaXJhLXByb3h5LywgXCJcIik7XHJcbiAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0VXJsID0gYCR7dGFyZ2V0SG9zdC5yZXBsYWNlKC9cXC8kLywgXCJcIil9JHtyZXN0UGF0aH1gO1xyXG5cclxuICAgICAgICAgICAgICAvLyBGb3J3YXJkIHRoZSByZXF1ZXN0IHVzaW5nIE5vZGUncyBuYXRpdmUgZmV0Y2hcclxuICAgICAgICAgICAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xyXG4gICAgICAgICAgICAgICAgXCJhY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXHJcbiAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICBpZiAocmVxLmhlYWRlcnNbXCJhdXRob3JpemF0aW9uXCJdKSB7XHJcbiAgICAgICAgICAgICAgICBoZWFkZXJzW1wiYXV0aG9yaXphdGlvblwiXSA9IHJlcS5oZWFkZXJzW1wiYXV0aG9yaXphdGlvblwiXSBhcyBzdHJpbmc7XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHRhcmdldFVybCwge1xyXG4gICAgICAgICAgICAgICAgbWV0aG9kOiByZXEubWV0aG9kIHx8IFwiR0VUXCIsXHJcbiAgICAgICAgICAgICAgICBoZWFkZXJzLFxyXG4gICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1cztcclxuICAgICAgICAgICAgICBjb25zdCBjb250ZW50VHlwZSA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpO1xyXG4gICAgICAgICAgICAgIGlmIChjb250ZW50VHlwZSkge1xyXG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcImNvbnRlbnQtdHlwZVwiLCBjb250ZW50VHlwZSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIiwgXCIqXCIpO1xyXG5cclxuICAgICAgICAgICAgICBjb25zdCBib2R5VGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICAgICAgICByZXMuZW5kKGJvZHlUZXh0KTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0ppcmEgUHJveHkgTWlkZGxld2FyZSBFcnJvcl06XCIsIGVycik7XHJcbiAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XHJcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICBdLmZpbHRlcihCb29sZWFuKSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdWLFNBQVMsb0JBQW9CO0FBQ3JYLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixnQkFBZ0IsUUFBUTtBQUN0QixlQUFPLFlBQVksSUFBSSxPQUFPLEtBQUssS0FBSyxTQUFTO0FBQy9DLGNBQUksSUFBSSxLQUFLLFdBQVcsaUJBQWlCLEdBQUc7QUFDMUMsZ0JBQUk7QUFDRixvQkFBTSxhQUFhLElBQUksUUFBUSxlQUFlO0FBQzlDLGtCQUFJLE9BQU8sZUFBZSxVQUFVO0FBQ2xDLG9CQUFJLGFBQWE7QUFDakIsb0JBQUksSUFBSSw4QkFBOEI7QUFDdEM7QUFBQSxjQUNGO0FBR0Esb0JBQU0sV0FBVyxJQUFJLElBQUksUUFBUSxzQkFBc0IsRUFBRTtBQUN6RCxvQkFBTSxZQUFZLEdBQUcsV0FBVyxRQUFRLE9BQU8sRUFBRSxDQUFDLEdBQUcsUUFBUTtBQUc3RCxvQkFBTSxVQUFrQztBQUFBLGdCQUN0QyxVQUFVO0FBQUEsY0FDWjtBQUNBLGtCQUFJLElBQUksUUFBUSxlQUFlLEdBQUc7QUFDaEMsd0JBQVEsZUFBZSxJQUFJLElBQUksUUFBUSxlQUFlO0FBQUEsY0FDeEQ7QUFFQSxvQkFBTSxXQUFXLE1BQU0sTUFBTSxXQUFXO0FBQUEsZ0JBQ3RDLFFBQVEsSUFBSSxVQUFVO0FBQUEsZ0JBQ3RCO0FBQUEsY0FDRixDQUFDO0FBRUQsa0JBQUksYUFBYSxTQUFTO0FBQzFCLG9CQUFNLGNBQWMsU0FBUyxRQUFRLElBQUksY0FBYztBQUN2RCxrQkFBSSxhQUFhO0FBQ2Ysb0JBQUksVUFBVSxnQkFBZ0IsV0FBVztBQUFBLGNBQzNDO0FBQ0Esa0JBQUksVUFBVSwrQkFBK0IsR0FBRztBQUVoRCxvQkFBTSxXQUFXLE1BQU0sU0FBUyxLQUFLO0FBQ3JDLGtCQUFJLElBQUksUUFBUTtBQUFBLFlBQ2xCLFNBQVMsS0FBVTtBQUNqQixzQkFBUSxNQUFNLGtDQUFrQyxHQUFHO0FBQ25ELGtCQUFJLGFBQWE7QUFDakIsa0JBQUksSUFBSSxLQUFLLFVBQVUsRUFBRSxPQUFPLElBQUksUUFBUSxDQUFDLENBQUM7QUFBQSxZQUNoRDtBQUNBO0FBQUEsVUFDRjtBQUNBLGVBQUs7QUFBQSxRQUNQLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUFBLEVBQ0YsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
