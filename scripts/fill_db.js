import { pool } from '../src/db.js';
const BATCH_SIZE = 1000;
const TOTAL_USERS = 100_000;
const TOTAL_PRODUCTS = 10_000;
const TOTAL_ORDERS = 2_500_000;

function randomDate(){
  const start = new Date(2023, 0, 1).getTime();
  const end = Date.now();
  return new Date(start + Math.random() * (end - start));
}

async function insert_users() {
  for(let i = 0; i < TOTAL_USERS; i += BATCH_SIZE){
    const values = [];
    for(let j = 0; j < BATCH_SIZE; j++){
      const email = `user${i+j+1}@gmail.com`;
      values.push(`('${email}', NOW())`);
    }
    const query = `INSERT INTO users (email, created_at) VALUES ${values.join(',')}`;
    await pool.query(query);
  }
}
async function insert_products() {
  for(let i = 0; i < TOTAL_PRODUCTS; i += BATCH_SIZE){
    const values = [];
    for(let j = 0; j < BATCH_SIZE; j++){
      const name = `Product ${i+j+1}`;
      const price = (Math.random() * 500).toFixed(2);
      values.push(`('${name}', ${price})`);
    }
    const query = `INSERT INTO products (name, price) VALUES ${values.join(',')}`; 
    await pool.query(query);
  }
}
async function insert_orders() {
  for(let i = 0; i < TOTAL_ORDERS; i += BATCH_SIZE){
    const values = [];
    for(let j = 0; j < BATCH_SIZE; j++){
      const user_id = Math.floor(Math.random() * TOTAL_USERS) + 1;
      const created_at = randomDate();
      values.push(`(${user_id}, '${created_at.toISOString()}', 'completed')`);
    }
    const query = `INSERT INTO orders (user_id, created_at, status) VALUES ${values.join(',')}`; 
    await pool.query(query);
  }
}
async function insert_orderitems() {
  const TOTAL_ITEMS = TOTAL_ORDERS * 3;
  for(let i = 0; i < TOTAL_ITEMS; i += BATCH_SIZE){
    const values = [];
    for(let j = 0; j < BATCH_SIZE; j++){
      const order_id = Math.floor(Math.random() * TOTAL_ORDERS) + 1;
      const product_id = Math.floor(Math.random() * TOTAL_PRODUCTS) + 1;
      const quantity = Math.floor(Math.random() * 10) + 1;
      const price = (Math.random() * 500).toFixed(2);
      values.push(`(${order_id}, ${product_id}, ${quantity}, ${price})`);
    }
    const query = `INSERT INTO orderitems (order_id, product_id, quantity, price) VALUES ${values.join(',')}`; 
    await pool.query(query);
  }
}

async function run(){
  await insert_users();
  await insert_products();
  await insert_orders();
  await insert_orderitems();

  await pool.end();
}

run();