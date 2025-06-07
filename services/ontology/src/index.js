const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Schema directory path
const SCHEMAS_DIR = path.join(__dirname, '../schemas');

// In-memory schema index
let schemaIndex = new Map();

// Load all schemas into memory
async function loadSchemas() {
    try {
        const files = await fs.readdir(SCHEMAS_DIR);
        const schemaFiles = files.filter(file => file.endsWith('.json'));
        
        for (const file of schemaFiles) {
            const content = await fs.readFile(path.join(SCHEMAS_DIR, file), 'utf8');
            const schema = JSON.parse(content);
            
            if (!schema.schemaId) {
                console.warn(`Warning: Schema in ${file} is missing schemaId`);
                continue;
            }
            
            schemaIndex.set(schema.schemaId, schema);
        }
        
        console.log(`Loaded ${schemaIndex.size} schemas`);
    } catch (error) {
        console.error('Error loading schemas:', error);
        throw error;
    }
}

// Ensure schemas directory exists
async function ensureSchemasDirectory() {
    try {
        await fs.access(SCHEMAS_DIR);
    } catch {
        await fs.mkdir(SCHEMAS_DIR, { recursive: true });
    }
}

// Get schema by UUID
app.get('/schemas/:uuid', async (req, res) => {
    try {
        const schemaId = req.params.uuid;
        const schema = schemaIndex.get(schemaId);
        
        if (!schema) {
            return res.status(404).json({ error: 'Schema not found' });
        }
        
        res.json(schema);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List all available schemas
app.get('/schemas', async (req, res) => {
    try {
        const schemas = Array.from(schemaIndex.entries()).map(([id, schema]) => ({
            id,
            title: schema.title
        }));
        
        res.json(schemas);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
async function startServer() {
    await ensureSchemasDirectory();
    await loadSchemas();
    
    app.listen(PORT, () => {
        console.log(`Schema service running on port ${PORT}`);
    });
}

startServer(); 