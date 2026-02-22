import path from 'node:path';
import { createSnapshotSerializer } from 'path-serializer';
import { expect } from 'vitest';

const ROOT = path.resolve(import.meta.dirname);

// Normalize paths in snapshots to ensure consistent results across different environments
expect.addSnapshotSerializer(
  createSnapshotSerializer({
    root: ROOT,
  }),
);
