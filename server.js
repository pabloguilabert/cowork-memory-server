import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MEMORY_API_KEY;
if (!API_KEY) { console.error("ERROR: MEMORY_API_KEY required."); process.exit(1); }
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const MEMORIES_FILE = join(DATA_DIR, "memories.json");
function loadMemories() { if (!existsSync(MEMORIES_FILE)) return { version: 1, lastUpdated: "", memories: [] }; return JSON.parse(readFileSync(MEMORIES_FILE, "utf-8")); }
function saveMemories(data) { data.lastUpdated = new Date().toISOString(); writeFileSync(MEMORIES_FILE, JSON.stringify(data, null, 2), "utf-8"); }
app.use(express.json({ limit: "1mb" }));
app.use("/api", (req, res, next) => { const key = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", ""); if (key !== API_KEY) return res.status(401).json({ error: "Invalid API key" }); next(); });
app.get("/", (_req, res) => res.json({ service: "cowork-memory-server", status: "running", version: "1.0.0" }));
app.get("/api/memories", (_req, res) => res.json(loadMemories()));
app.get("/api/memories/search", (req, res) => { const { q, category } = req.query; let results = loadMemories().memories; if (category) results = results.filter(m => m.category.toLowerCase() === category.toLowerCase()); if (q) { const query = q.toLowerCase(); results = results.filter(m => m.content.toLowerCase().includes(query) || (m.context && m.context.toLowerCase().includes(query))); } res.json({ count: results.length, memories: results }); });
app.post("/api/memories", (req, res) => { const data = loadMemories(); const input = Array.isArray(req.body) ? req.body : [req.body]; const added = []; for (const mem of input) { if (!mem.content) continue; const entry = { id: mem.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, category: mem.category || "notes", content: mem.content, context: mem.context || "", importance: mem.importance || "medium", createdAt: mem.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }; data.memories.push(entry); added.push(entry); } saveMemories(data); res.status(201).json({ added: added.length, memories: added }); });
app.put("/api/memories/:id", (req, res) => { const data = loadMemories(); const idx = data.memories.findIndex(m => m.id === req.params.id); if (idx === -1) return res.status(404).json({ error: "Memory not found" }); const mem = data.memories[idx]; if (req.body.content !== undefined) mem.content = req.body.content; if (req.body.category !== undefined) mem.category = req.body.category; if (req.body.context !== undefined) mem.context = req.body.context; if (req.body.importance !== undefined) mem.importance = req.body.importance; mem.updatedAt = new Date().toISOString(); saveMemories(data); res.json({ updated: mem }); });
app.delete("/api/memories/:id", (req, res) => { const data = loadMemories(); const idx = data.memories.findIndex(m => m.id === req.params.id); if (idx === -1) return res.status(404).json({ error: "Memory not found" }); const removed = data.memories.splice(idx, 1)[0]; saveMemories(data); res.json({ deleted: removed }); });
app.delete("/api/memories", (req, res) => { const { q, category } = req.query; if (!q && !category) return res.status(400).json({ error: "Provide ?q= or ?category= to filter" }); const data = loadMemories(); const before = data.memories.length; data.memories = data.memories.filter(m => { let match = false; if (category && m.category.toLowerCase() === category.toLowerCase()) match = true; if (q && m.content.toLowerCase().includes(q.toLowerCase())) match = true; return !match; }); saveMemories(data); res.json({ deleted: before - data.memories.length, remaining: data.memories.length }); });
app.put("/api/memories", (req, res) => { if (!req
