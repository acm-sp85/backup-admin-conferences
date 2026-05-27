require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env.local");
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('nanoge-production');
    
    // 1. Find all users without a country but with an entity
    const users = await db.collection('users').find({
      country: { $in: [null, ""] },
      entity: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`Found ${users.length} users with missing country but present entity.`);
    
    let updatedCount = 0;
    
    // 2. Iterate and update
    for (const user of users) {
      const entity = await db.collection('entities').findOne({ _id: user.entity });
      if (entity && entity.country) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { 
            $set: { 
              country: entity.country,
              country_inferred: true 
            } 
          }
        );
        updatedCount++;
      }
    }
    
    console.log(`Successfully backfilled ${updatedCount} users with inferred countries.`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
