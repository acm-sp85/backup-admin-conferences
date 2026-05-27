require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env.local");
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('nanoge-production');
    
    // 1. Fetch ONLY the participants from the current conference view
    const records = await db.collection('Participants ANGEL 2026').find({}).toArray();
    console.log(`Found ${records.length} total participants in this conference.`);
    
    let updatedCount = 0;
    
    // 2. Filter records that have NO country but HAVE an entity
    for (const record of records) {
      if (!record.user_country_id && record.user_entity && record.user_id) {
        
        // Find the user's entity in the database to get its country
        const userDoc = await db.collection('users').findOne({ _id: record.user_id });
        if (userDoc && userDoc.entity) {
          const entityDoc = await db.collection('entities').findOne({ _id: userDoc.entity });
          
          if (entityDoc && entityDoc.country) {
            // Update ONLY this specific user
            await db.collection('users').updateOne(
              { _id: record.user_id },
              { 
                $set: { 
                  country: entityDoc.country,
                  country_inferred: true 
                } 
              }
            );
            updatedCount++;
          }
        }
      }
    }
    
    console.log(`Successfully backfilled ${updatedCount} users for the ANGEL26 conference.`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
