import dotenv from 'dotenv';
dotenv.config();
import { app } from './app.js';
import { DBConnect } from './db/DBConnect.js';
import { User } from './models/User.js';

const port = process.env.PORT;

await DBConnect();

try {
  const indexes = await User.collection.indexes();
  const hasOldRfidIndex = indexes.some(
    index => index.name === 'rfidTag_1' && !index.partialFilterExpression
  );

  if (hasOldRfidIndex) {
    await User.collection.dropIndex('rfidTag_1');
    console.log('Dropped stale rfidTag_1 index');
  }

  await User.syncIndexes();
  console.log('User indexes synced');
} catch (error) {
  console.error('Index sync failed:', error.message);
}

app.listen(port, () => {
  console.log(`Server is Running at http://localhost:${port}`);
});
