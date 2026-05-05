const { spawn } = require('child_process');
require('dotenv').config({ path: '.env.local' });

// Expect SSH_HOST (e.g., root@51.38.81.167) in .env.local
const sshHost = process.env.SSH_HOST;

if (!sshHost) {
  console.error("❌ ERROR: Please add SSH_HOST to your .env.local file!");
  console.error("   Example: SSH_HOST=root@51.38.81.167\n");
  process.exit(1);
}

console.log(`🚀 Starting SSH tunnel for MariaDB (3307) to ${sshHost}...`);
console.log("Keep this terminal window open! Press Ctrl+C to close the tunnel when you're done.\n");

// Use the exact command style the user prefers: ssh -L 3307:127.0.0.1:3306 <host> -N
const tunnel = spawn('ssh', [
  '-L', '3307:127.0.0.1:3306',
  sshHost,
  '-N'
], { stdio: 'inherit' });

tunnel.on('close', (code) => {
  console.log(`\n🛑 Tunnel closed with code ${code}`);
});

tunnel.on('error', (err) => {
  console.error('Failed to start SSH tunnel:', err.message);
});
