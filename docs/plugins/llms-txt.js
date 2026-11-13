/**
 * Publishes machine-readable views of this site for AI coding agents:
 *
 *   /llms.txt            an index of every page, with URLs and one-line summaries
 *   /llms-full.txt       the whole corpus in one file
 *   /skill/SKILL.md      the W3DS agent skill, fetchable without installing anything
 *   /skill/reference/*   its reference files
 *   /skill/w3ds-full.txt the skill concatenated, for agents that read a single file
 *
 * The docs site is the authoritative source for W3DS, so an agent that can fetch
 * needs a way in that does not depend on having the repository checked out.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs/docs');
const SKILL_DIR = path.join(REPO_ROOT, 'skills/w3ds');

/** Frontmatter is a leading `---` block; return it parsed shallowly, plus the body. */
function splitFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) return { data: {}, body: raw };
    const data = {};
    for (const line of match[1].split(/\r?\n/)) {
        const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
    return { data, body: raw.slice(match[0].length) };
}

/** First real prose paragraph, collapsed to one line — the fallback summary. */
function firstParagraph(body) {
    const lines = body.split(/\r?\n/);
    const buf = [];
    let inFence = false;
    for (const line of lines) {
        if (line.startsWith('```')) inFence = !inFence;
        if (inFence) continue;
        const t = line.trim();
        if (!t) {
            if (buf.length) break;
            continue;
        }
        if (t.startsWith('#') || t.startsWith(':::') || t.startsWith('|') || t.startsWith('<')) {
            if (buf.length) break;
            continue;
        }
        buf.push(t);
    }
    return (
        buf
            .join(' ')
            // Links and emphasis are noise in a one-line summary; inline code is not,
            // so backticks stay.
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2')
            .replace(/\s+/g, ' ')
            .trim()
    );
}

function truncate(s, n) {
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const lastSpace = cut.lastIndexOf(' ');
    return `${cut.slice(0, lastSpace > n * 0.6 ? lastSpace : cut.length).trimEnd()}…`;
}

/** Category label and position come from `_category_.json`, as in the sidebar. */
function readCategory(dir, name) {
    const file = path.join(dir, '_category_.json');
    if (!fs.existsSync(file)) return { label: name, position: Number.MAX_SAFE_INTEGER };
    try {
        const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
        return {
            label: meta.label || name,
            position: typeof meta.position === 'number' ? meta.position : Number.MAX_SAFE_INTEGER,
        };
    } catch {
        return { label: name, position: Number.MAX_SAFE_INTEGER };
    }
}

/** Every doc page, grouped by category, in sidebar order. */
function collectDocs(baseUrl) {
    const categories = [];

    const readPage = (absPath, relPath) => {
        const raw = fs.readFileSync(absPath, 'utf8');
        const { data, body } = splitFrontmatter(raw);
        const h1 = body.match(/^#\s+(.+)$/m);
        const title = (data.title || (h1 && h1[1]) || path.basename(relPath, '.md')).trim();
        const slug = relPath.replace(/\.md$/, '');
        return {
            title,
            url: `${baseUrl}/docs/${slug.split('/').map(encodeURIComponent).join('/')}`,
            description: truncate(data.description || firstParagraph(body), 200),
            position:
                data.sidebar_position !== undefined
                    ? Number(data.sidebar_position)
                    : Number.MAX_SAFE_INTEGER,
            body: body.trim(),
        };
    };

    const rootPages = [];
    for (const entry of fs.readdirSync(DOCS_DIR, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            const dir = path.join(DOCS_DIR, entry.name);
            const meta = readCategory(dir, entry.name);
            const pages = fs
                .readdirSync(dir)
                .filter((f) => f.endsWith('.md'))
                .map((f) => readPage(path.join(dir, f), `${entry.name}/${f}`))
                .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
            if (pages.length) categories.push({ ...meta, pages });
        } else if (entry.name.endsWith('.md')) {
            rootPages.push(readPage(path.join(DOCS_DIR, entry.name), entry.name));
        }
    }

    categories.sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
    if (rootPages.length) {
        categories.unshift({ label: 'Documentation', position: -1, pages: rootPages });
    }
    return categories;
}

/** SKILL.md first, then reference files alphabetically. */
function collectSkillFiles() {
    if (!fs.existsSync(path.join(SKILL_DIR, 'SKILL.md'))) {
        throw new Error(
            `[llms-txt] expected the W3DS skill at ${SKILL_DIR}. The docs site publishes it at /skill/; ` +
                'shipping an empty /skill/ would silently break every zero-install agent.'
        );
    }
    const files = [{ rel: 'SKILL.md', abs: path.join(SKILL_DIR, 'SKILL.md') }];
    const refDir = path.join(SKILL_DIR, 'reference');
    if (fs.existsSync(refDir)) {
        for (const f of fs.readdirSync(refDir).filter((n) => n.endsWith('.md')).sort()) {
            files.push({ rel: `reference/${f}`, abs: path.join(refDir, f) });
        }
    }
    return files;
}

module.exports = function llmsTxtPlugin() {
    return {
        name: 'llms-txt',

        async postBuild({ outDir, siteConfig }) {
            const baseUrl = String(siteConfig.url).replace(/\/$/, '');
            const categories = collectDocs(baseUrl);
            const skillFiles = collectSkillFiles();

            // --- /llms.txt: the index -------------------------------------------------
            const index = [
                `# ${siteConfig.title}`,
                '',
                `> ${siteConfig.tagline}. W3DS lets users own their data in a personal eVault while platforms act as interchangeable frontends. This site is the authoritative source for the protocol, its services, and how to build on it.`,
                '',
                'The eVault is the source of truth; anything a platform stores is a projection of it. Read Data Ownership Rules before designing a platform.',
                '',
            ];
            for (const cat of categories) {
                index.push(`## ${cat.label}`, '');
                for (const p of cat.pages) {
                    index.push(`- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ''}`);
                }
                index.push('');
            }
            index.push(
                '## Agent skill',
                '',
                'The packaged W3DS skill, for coding agents. Fetch directly, or install with `npx skills add MetaState-Prototype-Project/prototype@w3ds`.',
                ''
            );
            for (const f of skillFiles) {
                index.push(`- [${f.rel}](${baseUrl}/skill/${f.rel})`);
            }
            index.push(
                `- [w3ds-full.txt](${baseUrl}/skill/w3ds-full.txt): the whole skill in one file`,
                '',
                '## Optional',
                '',
                `- [llms-full.txt](${baseUrl}/llms-full.txt): every page on this site concatenated`,
                ''
            );
            fs.writeFileSync(path.join(outDir, 'llms.txt'), index.join('\n'));

            // --- /llms-full.txt: the corpus ------------------------------------------
            const full = [
                `# ${siteConfig.title}`,
                '',
                `Every page of ${baseUrl}, concatenated. Generated at build time.`,
                '',
            ];
            for (const cat of categories) {
                for (const p of cat.pages) {
                    full.push('---', '', `# ${p.title}`, '', `Source: ${p.url}`, '', p.body, '');
                }
            }
            fs.writeFileSync(path.join(outDir, 'llms-full.txt'), full.join('\n'));

            // --- /skill/**: the skill, fetchable ---------------------------------------
            const skillOut = path.join(outDir, 'skill');
            fs.mkdirSync(path.join(skillOut, 'reference'), { recursive: true });
            const concat = [];
            for (const f of skillFiles) {
                const raw = fs.readFileSync(f.abs, 'utf8');
                fs.writeFileSync(path.join(skillOut, f.rel), raw);
                concat.push(`---\n\n# ${f.rel}\n\n${splitFrontmatter(raw).body.trim()}\n`);
            }
            fs.writeFileSync(
                path.join(skillOut, 'w3ds-full.txt'),
                [
                    '# W3DS agent skill',
                    '',
                    `Source: ${baseUrl}/skill/SKILL.md. Authoritative docs: ${baseUrl}.`,
                    '',
                    ...concat,
                ].join('\n')
            );

            const pageCount = categories.reduce((n, c) => n + c.pages.length, 0);
            console.log(
                `[llms-txt] wrote llms.txt (${pageCount} pages), llms-full.txt, and /skill/ (${skillFiles.length} files)`
            );
        },
    };
};
