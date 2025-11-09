const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const USERS_FILE = path.join(__dirname, 'users.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupUsers() {
  const users = {};

  console.log('\n=== Claude UI Backend - User Setup ===\n');

  // Setup Mike
  const mikePassword = await new Promise(resolve => {
    rl.question('Enter password for mike: ', resolve);
  });
  users['mike'] = {
    passwordHash: await bcrypt.hash(mikePassword, 10),
    createdAt: new Date().toISOString()
  };

  // Setup Maricar
  const maricarPassword = await new Promise(resolve => {
    rl.question('Enter password for maricar: ', resolve);
  });
  users['maricar'] = {
    passwordHash: await bcrypt.hash(maricarPassword, 10),
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log('\n✅ Users created successfully!');
  console.log('Users file:', USERS_FILE);

  rl.close();
}

setupUsers().catch(console.error);
