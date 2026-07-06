const { spawn } = require('child_process');

require('dotenv').config({ path: '.env.local' });

const mongoSshHost = process.env.MONGO_SSH_HOST;

if (!mongoSshHost) {
  console.error("❌ ERROR: Please add MONGO_SSH_HOST to your .env.local file!");
  process.exit(1);
}

console.log(`🚀 Starting SSH tunnel for MongoDB (49153) and Migration DB (3308) to ${mongoSshHost}...`);
console.log("Keep this terminal window open during migration! Press Ctrl+C to close.\n");

// ssh -L 49153:127.0.0.1:49153 -L 3308:127.0.0.1:3306 <host> -N
const tunnel = spawn('ssh', [
  '-L', '49153:127.0.0.1:49153',
  '-L', '3308:127.0.0.1:3306',
  mongoSshHost,
  '-N'
], { stdio: 'inherit' });

tunnel.on('close', (code) => {
  console.log(`\n🛑 Mongo/Migration Tunnel closed with code ${code}`);
});

tunnel.on('error', (err) => {
  console.error('Failed to start Mongo tunnel:', err.message);
});
