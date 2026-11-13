const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 6767;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(cors());
app.use(express.json());

// Schema directory path
const SCHEMAS_DIR = path.join(__dirname, '../schemas');
// The domain list is published as an ordinary schema, so it is versioned,
// browsable and fetchable like every other type rather than living in a file
// of its own.
const DOMAIN_SCHEMA_TITLE = 'Domain';

// In-memory schema index
let schemaIndex = new Map();

// The domains every schema belongs to, and that platforms are granted access
// to one by one. Loaded once at boot alongside the schemas.
let domains = [];
let domainsById = new Map();

/**
 * Reads the domain list out of the Domain schema's enum. Each permitted value
 * carries its own title and description, which is the JSON Schema way to give
 * an enum human-readable labels.
 */
function loadDomains() {
    const schema = Array.from(schemaIndex.values()).find(
        (s) => s.title === DOMAIN_SCHEMA_TITLE
    );
    const options = schema?.properties?.id?.oneOf;
    domains = Array.isArray(options)
        ? options
              .filter((o) => typeof o.const === 'string')
              .map((o) => ({
                  id: o.const,
                  label: o.title || o.const,
                  description: o.description || ''
              }))
        : [];
    domainsById = new Map(domains.map((d) => [d.id, d]));
    console.log(
        `Loaded ${domains.length} domains from the ${DOMAIN_SCHEMA_TITLE} schema`
    );
}

/** A schema's domain, resolved to its full record for display. */
function domainOf(schema) {
    if (!schema || !schema.domain) return null;
    return domainsById.get(schema.domain) || { id: schema.domain, label: schema.domain, description: '' };
}

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
        loadDomains();
    } catch (error) {
        console.error('Error loading schemas:', error);
        throw error;
    }
}

// Build schema list for UI (optionally filtered by search query)
function getSchemaList(q) {
    const list = Array.from(schemaIndex.entries()).map(([id, schema]) => ({
        id,
        title: schema.title == null ? '' : String(schema.title),
        domain: domainOf(schema)
    }));
    if (!q || typeof q !== 'string' || q.trim() === '') return list;
    const lower = q.toLowerCase().trim();
    // Searching a domain name finds everything in that domain.
    return list.filter(
        (s) =>
            (s.title || '').toLowerCase().includes(lower) ||
            (s.id || '').toLowerCase().includes(lower) ||
            (s.domain ? `${s.domain.id} ${s.domain.label}`.toLowerCase().includes(lower) : false)
    );
}

// Ensure schemas directory exists
async function ensureSchemasDirectory() {
    try {
        await fs.access(SCHEMAS_DIR);
    } catch {
        await fs.mkdir(SCHEMAS_DIR, { recursive: true });
    }
}

// Ontology viewer page (list + search + optional detail)
app.get('/', async (req, res) => {
    try {
        const searchQuery = req.query.q || '';
        const schemaId = req.query.schema;
        const schemas = getSchemaList(searchQuery);
        let selectedSchema = null;
        if (schemaId) {
            selectedSchema = schemaIndex.get(schemaId) || null;
        }
        res.render('index', {
            schemas,
            searchQuery,
            selectedSchema,
            selectedDomain: domainOf(selectedSchema),
            domains
        });
    } catch (error) {
        console.error('Error rendering ontology viewer:', error);
        res.status(500).send('Internal server error');
    }
});

// Permalink to one schema (same page with detail)
app.get('/schema/:uuid', async (req, res) => {
    try {
        const schemaId = req.params.uuid;
        const selectedSchema = schemaIndex.get(schemaId);
        if (!selectedSchema) {
            return res.status(404).send('Schema not found');
        }
        const schemas = getSchemaList('');
        res.render('index', {
            schemas,
            searchQuery: '',
            selectedSchema,
            selectedDomain: domainOf(selectedSchema),
            domains
        });
    } catch (error) {
        console.error('Error rendering schema page:', error);
        res.status(500).send('Internal server error');
    }
});

// Get schema by UUID (raw JSON)
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
            title: schema.title,
            domain: schema.domain || null
        }));
        
        res.json(schemas);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// The domain list: what a platform can be granted access to, and what every
// schema is tagged with. Consumed by the Post Platforms Association.
app.get('/domains', async (req, res) => {
    const schema = Array.from(schemaIndex.values()).find(
        (s) => s.title === DOMAIN_SCHEMA_TITLE
    );
    res.json({ schemaId: schema ? schema.schemaId : null, domains });
});

// Which schemas fall under one domain — the practical question when deciding
// whether to grant a platform access to it.
app.get('/domains/:id/schemas', async (req, res) => {
    const domain = domainsById.get(req.params.id);
    if (!domain) {
        return res.status(404).json({ error: 'Domain not found' });
    }
    const schemas = Array.from(schemaIndex.entries())
        .filter(([, schema]) => schema.domain === domain.id)
        .map(([id, schema]) => ({ id, title: schema.title }));
    res.json({ domain, schemas });
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