# Database Performance Testing & Optimization

This project demonstrates creating a database, populating it with test data, executing common analytical queries, and analyzing their performance with optimizations in PostgreSQL.

---

## 1. Database Schema

CREATE TABLE Users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE Orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE Products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    price NUMERIC NOT NULL
);

CREATE TABLE OrderItems (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL
);

---

## 2. Database Population

A JavaScript script was used to randomly generate data. The final dataset contains:

- 100,000 Users  
- 10,000 Products  
- 2,500,000 Orders
- 7,500,000 Order Items

---

## 3. Sample Queries & Performance

| Query | Description | Execution Time |
|-------|-------------|----------------|
| Q1    | Top 5 spending customers in 2023 | 8s |
| Q2    | Top 10 sold products | 1.5s |
| Q3    | Orders count per month | 13s |
| Q4    | Average order value per user | 16.2s |
| Q5    | Users with orders not completed | 0.8s |
| Q6    | Revenue per product | 0.2s |
| Q7    | Number of orders per user in the last 30 days | 0.5s |
| Q8    | Orders with total price exceeding 2000 | 11s |
| Q9    | Products never sold | 0.9s |
| Q10   | Users created per month (growth trend) | 0.1s |

---

### Query Examples

#### 1. Top 5 Spending Customers in 2023

SELECT u.id, u.email, COUNT(DISTINCT o.id) AS total_orders, SUM(oi.price * oi.quantity) AS total_spent
FROM Users u 
JOIN Orders o ON u.id = o.user_id 
JOIN OrderItems oi ON o.id = oi.order_id 
WHERE EXTRACT(YEAR FROM o.created_at) = 2023 AND o.status = 'completed'
GROUP BY u.id, u.email
ORDER BY total_spent DESC
LIMIT 5;

#### 2. Top 10 Sold Products

SELECT p.name, SUM(oi.quantity) AS total_sold
FROM OrderItems oi 
JOIN Products p ON oi.product_id = p.id
GROUP BY p.id, p.name
ORDER BY total_sold DESC
LIMIT 10;

#### 3. Orders Count per Month

SELECT DATE_TRUNC('month', o.created_at) AS month_start,
       COUNT(o.id) AS total_orders,
       SUM(oi.quantity * oi.price) AS total_revenue
FROM Orders o
JOIN OrderItems oi ON o.id = oi.order_id
GROUP BY month_start
ORDER BY month_start;

---

## 4. Query Performance Analysis

- Slow Queries: Q1, Q3, Q4, Q8  
- Medium Performance: Q2, Q6  
- Fast Queries: Q5, Q7, Q9, Q10  

---

## 5. Optimizing Query 1

Original Query 1 execution: 8s  

**Optimization Steps:**

1. Create an index on order_id in OrderItems.  
2. Create a composite index on (status, created_at) in Orders.  
3. Use a date range instead of EXTRACT(YEAR ...) to leverage the index.  

**Optimized Query:**

WITH order_spent AS (
    SELECT o.id, o.user_id, SUM(oi.price * oi.quantity) AS spent
    FROM Orders o 
    JOIN OrderItems oi ON o.id = oi.order_id
    WHERE o.created_at >= '2023-01-01' AND o.created_at < '2024-01-01'
      AND o.status = 'completed'
    GROUP BY o.id
)
SELECT u.id, u.email, COUNT(os.id) AS total_orders, SUM(spent) AS total_spent
FROM Users u
JOIN order_spent os ON os.user_id = u.id
GROUP BY u.id, u.email
ORDER BY total_spent DESC
LIMIT 5;

- Execution time after index and query rewrite: 3.5s  

**Further Optimization Options:**

1. Summary Table: Precompute order_spent and update on new orders.  
   - Execution time: 0.5s  
   - Trade-off: Uses extra storage and requires updates.  

2. Materialized View: Store order_spent as a materialized view.  
   - Execution time: 0.05s  
   - Trade-off: Similar to summary table, but easier to refresh periodically.

---

