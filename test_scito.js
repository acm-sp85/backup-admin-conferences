const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  await mongoClient.connect();
  const dbScito = mongoClient.db('scito-prod');
  const colScito = dbScito.collection('All-Events-ScitoEvents');
  const withAcronym = await colScito.countDocuments({ acronym: { $exists: true, $ne: "" } });
  console.log('SCITO with acronym:', withAcronym);
  const total = await colScito.countDocuments();
  console.log('SCITO total:', total);
  
  const dbNanoge = mongoClient.db('nanoge-production');
  const colNanoge = dbNanoge.collection('All-Conferences');
  const nanogeWithAcronym = await colNanoge.countDocuments({ acronym: { $exists: true, $ne: "" } });
  console.log('NANOGE with acronym:', nanogeWithAcronym);
  
  await mongoClient.close();
}
run();
