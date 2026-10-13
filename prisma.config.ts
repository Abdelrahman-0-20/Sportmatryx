import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts', // Adjust this to your seed command
  },
  // If you use a separate driver adapter, you can configure the datasource here
  // datasource: {
  //   url: env('DATABASE_URL'),
  // },
});
