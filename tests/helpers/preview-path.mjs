import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve from this module so running a test from another directory is safe.
const directory = fileURLToPath(new URL('../../artifacts/previews/', import.meta.url));
mkdirSync(directory, { recursive: true });

export const previewPath = filename => join(directory, filename);
