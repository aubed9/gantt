import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import { db } from './client.js';
import * as migration001 from './migrations/001_initial_schema.js';

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001_initial_schema': {
        up: migration001.up,
        down: migration001.down,
      },
    };
  }
}

export function createMigrator() {
  return new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });
}

export async function migrateToLatest() {
  const migrator = createMigrator();
  console.log('Running Kysely migrations...');
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✓ Migration "${it.migrationName}" applied successfully`);
    } else if (it.status === 'Error') {
      console.error(`✗ Migration "${it.migrationName}" failed`);
    }
  });

  if (error) {
    console.error('Migration failed with error:', error);
    throw error;
  }

  console.log('✓ All migrations applied successfully.');
}

export async function migrateDown() {
  const migrator = createMigrator();
  console.log('Reverting last migration...');
  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✓ Migration "${it.migrationName}" reverted successfully`);
    } else if (it.status === 'Error') {
      console.error(`✗ Migration "${it.migrationName}" failed to revert`);
    }
  });

  if (error) {
    console.error('Revert failed with error:', error);
    throw error;
  }
}

// CLI runner
if (process.argv[1]?.endsWith('migrator.ts') || process.argv[1]?.endsWith('migrator.js')) {
  const action = process.argv[2] || 'latest';
  const run = action === 'down' ? migrateDown() : migrateToLatest();
  run
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
