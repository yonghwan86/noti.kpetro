import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Use process.cwd() for bundled production code where __dirname may not work correctly
  const distPath = path.resolve(process.cwd(), "dist", "public");
  console.log(`[STATIC] Serving static files from: ${distPath}`);
  
  if (!fs.existsSync(distPath)) {
    console.error(`[STATIC] Build directory not found: ${distPath}`);
    console.error(`[STATIC] Current working directory: ${process.cwd()}`);
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
