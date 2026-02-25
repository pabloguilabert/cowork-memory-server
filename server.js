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
app.get('/', (req, res) => {
        res.json({ status: 'ok', service: 'cowork-memory-server', version: '1.1.0', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all memories (both /memories and /api/memories)
function getMemories(req, res) {
        const memories = loadMemories();
        res.json(memories);
}
app.get('/memories', authenticate, getMemories);
app.get('/api/memories', authenticate, getMemories);

// POST - add a memory
function postMemory(req, res) {
        const { content, category, importance, context, tags } = req.body;
        if (!content) {
                    return res.status(400).json({ error: 'Content is required' });
        }
        const memories = loadMemories();
        const memory = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    content,
                    category: category || 'general',
                    importance: importance || 'medium',
                    context: context || '',
                    tags: tags || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
        };
        memories.push(memory);
        saveMemories(memories);
        res.status(201).json(memory);
}
app.post('/memories', authenticate, postMemory);
app.post('/api/memories', authenticate, postMemory);

// PUT - update a memory
function putMemory(req, res) {
        const { id } = req.params;
        const { content, category, importance, context, tags } = req.body;
        const memories = loadMemories();
        const index = memories.findIndex(m => m.id === id);
        if (index === -1) {
                    return res.status(404).json({ error: 'Memory not found' });
        }
        if (content) memories[index].content = content;
        if (category) memories[index].category = category;
        if (importance) memories[index].importance = importance;
        if (context) memories[index].context = context;
        if (tags) memories[index].tags = tags;
        memories[index].updatedAt = new Date().toISOString();
        saveMemories(memories);
        res.json({ memory: memories[index] });
}
app.put('/memories/:id', authenticate, putMemory);
app.put('/api/memories/:id', authenticate, putMemory);

// DELETE - remove a memory
function deleteMemory(req, res) {
        const { id } = req.params;
        const memories = loadMemories();
        const index = memories.findIndex(m => m.id === id);
        if (index === -1) {
                    return res.status(404).json({ error: 'Memory not found' });
        }
        const [deleted] = memories.splice(index, 1);
        saveMemories(memories);
        res.json({ deleted });
}
app.delete('/memories/:id', authenticate, deleteMemory);
app.delete('/api/memories/:id', authenticate, deleteMemory);

// POST - bulk sync
function syncMemories(req, res) {
        const { memories } = req.body;
        if (!Array.isArray(memories)) {
                    return res.status(400).json({ error: 'Memories must be an array' });
        }
        saveMemories(memories);
        res.json({ synced: memories.length });
}
app.post('/memories/sync', authenticate, syncMemories);
app.post('/api/memories/sync', authenticate, syncMemories);

// GET - search memories
function searchMemories(req, res) {
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
        res.json(memories);
}
app.get('/memories/search', authenticate, searchMemories);
app.get('/api/memories/search', authenticate, searchMemories);

app.listen(PORT, '0.0.0.0', () => {
        console.log(`Memory server running on port ${PORT}`);
        console.log(`Data directory: ${DATA_DIR}`);
});
