import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MEMORY_API_KEY || 'default-key';
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

const MEMORIES_FILE = join(DATA_DIR, 'memories.json');

// Middleware
app.use(express.json({ limit: '10mb' }));

// API Key authentication
function authenticate(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.key;
    if (key !== API_KEY) {
          return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
}

// Load memories from file
function loadMemories() {
    try {
          if (existsSync(MEMORIES_FILE)) {
                  const data = readFileSync(MEMORIES_FILE, 'utf-8');
                  return JSON.parse(data);
          }
    } catch (err) {
          console.error('Error loading memories:', err.message);
    }
    return [];
}

// Save memories to file
function saveMemories(memories) {
    try {
          writeFileSync(MEMORIES_FILE, JSON.stringify(memories, null, 2));
    } catch (err) {
          console.error('Error saving memories:', err.message);
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all memories
app.get('/memories', authenticate, (req, res) => {
    const memories = loadMemories();
    res.json({ memories, count: memories.length });
});

// POST - add a memory
app.post('/memories', authenticate, (req, res) => {
    const { content, category, tags } = req.body;
    if (!content) {
          return res.status(400).json({ error: 'Content is required' });
    }

           const memories = loadMemories();
    const memory = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          content,
          category: category || 'general',
          tags: tags || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
    };

           memories.push(memory);
    saveMemories(memories);
    res.status(201).json({ memory });
});

// PUT - update a memory
app.put('/memories/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const { content, category, tags } = req.body;
    const memories = loadMemories();
    const index = memories.findIndex(m => m.id === id);

          if (index === -1) {
                return res.status(404).json({ error: 'Memory not found' });
          }

          if (content) memories[index].content = content;
    if (category) memories[index].category = category;
    if (tags) memories[index].tags = tags;
    memories[index].updatedAt = new Date().toISOString();

          saveMemories(memories);
    res.json({ memory: memories[index] });
});

// DELETE - remove a memory
app.delete('/memories/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const memories = loadMemories();
    const index = memories.findIndex(m => m.id === id);

             if (index === -1) {
                   return res.status(404).json({ error: 'Memory not found' });
             }

             const deleted = memories.splice(index, 1)[0];
    saveMemories(memories);
    res.json({ deleted });
});

// POST - bulk sync (replace all memories)
app.post('/memories/sync', authenticate, (req, res) => {
    const { memories } = req.body;
    if (!Array.isArray(memories)) {
          return res.status(400).json({ error: 'Memories must be an array' });
    }

           saveMemories(memories);
    res.json({ synced: memories.length });
});

// GET - search memories
app.get('/memories/search', authenticate, (req, res) => {
    const { q, category, tag } = req.query;
    let memories = loadMemories();

          if (q) {
                const query = q.toLowerCase();
                memories = memories.filter(m =>
                        m.content.toLowerCase().includes(query) ||
                        (m.category && m.category.toLowerCase().includes(query))
                                               );
          }

          if (category) {
                memories = memories.filter(m => m.category === category);
          }

          if (tag) {
                memories = memories.filter(m => m.tags && m.tags.includes(tag));
          }

          res.json({ memories, count: memories.length });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Memory server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
