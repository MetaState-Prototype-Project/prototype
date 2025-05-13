import { BeeperDbReader } from './beeperDbReader';
// import { MetaStateTransformer } from './metaStateTransformer';
// import { EvaultWriter } from './evaultWriter';

async function main() {
  console.log('Beeper Connector Service starting...');

  const beeperDbPath = process.env.BEEPER_DB_PATH;
  if (!beeperDbPath) {
    console.error('Error: BEEPER_DB_PATH environment variable is not set.');
    process.exit(1);
  }
  console.log(`Attempting to connect to Beeper DB at: ${beeperDbPath}`);

  let dbReader: BeeperDbReader | null = null;

  try {
    dbReader = new BeeperDbReader(beeperDbPath);

    console.log('Fetching users...');
    const users = await dbReader.getUsers();
    console.log(`Found ${users.length} users:`, users.slice(0, 5));

    const firstUser = users[0];
    if (firstUser && firstUser.accountID) {
      const firstUserAccountId = firstUser.accountID;
      console.log(`Fetching threads for accountID: ${firstUserAccountId} ...`);
      const threads = await dbReader.getThreads(firstUserAccountId);
      console.log(`Found ${threads.length} threads for account ${firstUserAccountId}:`, threads.slice(0, 3));

      const firstThread = threads[0];
      if (firstThread && firstThread.threadID) {
        const firstThreadId = firstThread.threadID;
        console.log(`Fetching messages for threadID: ${firstThreadId} ...`);
        const messages = await dbReader.getMessages(firstThreadId, undefined, 20);
        console.log(`Found ${messages.length} messages for thread ${firstThreadId}:`, messages.slice(0, 5));
      } else {
        console.log('Skipping message fetching as no threads or threadID found for the first user account.');
      }
    } else {
      console.log('Skipping thread and message fetching as no users with an accountID found.');
    }

    // TODO: Implement MetaStateTransformer logic
    // const transformer = new MetaStateTransformer();
    // const metaStateObjects = transformer.transform(users, threads, messages);

    // TODO: Implement EvaultWriter logic
    // const evaultEndpoint = process.env.EVAULT_ENDPOINT;
    // const evaultAuthToken = process.env.EVAULT_AUTH_TOKEN;
    // if (!evaultEndpoint) {
    //   console.error('Error: EVAULT_ENDPOINT environment variable is not set.');
    //   process.exit(1);
    // }
    // const writer = new EvaultWriter(evaultEndpoint, evaultAuthToken);
    // await writer.storeBatch(metaStateObjects);

    console.log('Beeper Connector Service finished its run (data fetching test complete).');

  } catch (error) {
    console.error('Error in Beeper Connector Service:', error);
    process.exit(1);
  } finally {
    if (dbReader) {
      dbReader.close();
    }
  }
}

main().catch(error => {
  // This catch is redundant if main already handles errors and process.exit
  // However, it's good practice for top-level async calls.
  console.error('Unhandled error in main execution:', error);
  process.exit(1);
});
