import Database from 'better-sqlite3';

const db = new Database('./data/echosensei11.db');

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database:', tables.map(t => t.name));
  
  // Check each table structure
  for (const table of tables) {
    console.log(`\nTable: ${table.name}`);
    try {
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
      console.log('Columns:', columns.map(c => c.name));
    } catch (e) {
      console.log('Error getting columns:', e.message);
    }
  }
  
  if (tables.length === 0) {
    console.log('No tables found! Database setup failed.');
  } else {
    console.log('\nDatabase setup successful!');
  }
} catch (error) {
  console.error('Error checking database:', error);
}

db.close();
