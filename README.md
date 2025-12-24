# Database Performance Testing & Optimization

This project demonstrates creating a database, populating it with test data, executing common analytical queries, and analyzing their performance with optimizations in PostgreSQL.

---

## 1. Database Schema

```
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
```

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
| Q6    | Revenue per product | 2.4s |
| Q7    | Number of orders per user in the last 30 days | 0.5s |
| Q8    | Orders with total price exceeding 2000 | 11s |
| Q9    | Products never sold | 0.9s |
| Q10   | Users created per month (growth trend) | 0.1s |

---

### Query Examples

#### 1. Top 5 Spending Customers in 2023

```
SELECT u.id, u.email, COUNT(DISTINCT o.id) AS total_orders, SUM(oi.price * oi.quantity) AS total_spent
FROM Users u 
JOIN Orders o ON u.id = o.user_id 
JOIN OrderItems oi ON o.id = oi.order_id 
WHERE EXTRACT(YEAR FROM o.created_at) = 2023 AND o.status = 'completed'
GROUP BY u.id, u.email
ORDER BY total_spent DESC
LIMIT 5;
```

#### 2. Top 10 Sold Products

```
SELECT p.name, SUM(oi.quantity) AS total_sold
FROM OrderItems oi 
JOIN Products p ON oi.product_id = p.id
GROUP BY p.id, p.name
ORDER BY total_sold DESC
LIMIT 10;
```

#### 3. Orders Count per Month

```
SELECT DATE_TRUNC('month', o.created_at) AS month_start,
       COUNT(o.id) AS total_orders,
       SUM(oi.quantity * oi.price) AS total_revenue
FROM Orders o
JOIN OrderItems oi ON o.id = oi.order_id
GROUP BY month_start
ORDER BY month_start;
```

---

## 4. Query Performance Analysis

- Slow Queries: Q1, Q3, Q4, Q8  
- Medium Performance: Q2, Q6  
- Fast Queries: Q5, Q7, Q9, Q10  

The next step is to optimize the remaining queries. It is assumed that all of these queries are used in a **live dashboard**, not for monthly or offline reports. Therefore, the goal is to achieve the **lowest possible execution time**.

For queries that are executed in real time, techniques such as summary tables or materialized views are preferred to ensure fast responses.

However, if any of these queries are executed infrequently (for example, once per month for reporting purposes), then **adding proper indexes and rewriting the queries** is usually sufficient, without the need for additional storage or maintenance overhead.

---

### 4.1. Optimizing Query 1

Original Query 1 execution: 8s  

**Optimization Steps:**

1. Create an index on order_id in OrderItems.  
2. Create a composite index on (status, created_at) in Orders.  
3. Use a date range instead of EXTRACT(YEAR ...) to leverage the index.  

**Optimized Query:**
```
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
```

- Execution time after index and query rewrite: 3.5s  

**Further Optimization Options:**

1. Summary Table: Precompute order_spent and update on new orders.  
   - Execution time: 0.5s  
   - Trade-off: Uses extra storage and requires updates.  

2. Materialized View: Store order_spent as a materialized view.  
   - Execution time: 0.05s  
   - Trade-off: Similar to summary table, but easier to refresh periodically.

---

### 4.2. Optimizing Query 2

Original Query 2 execution: 1.5s  

**Optimization Steps:**

1. Create an index on the product_id column in OrderItems to speed up the join.

- Execution time after index: almost no improvement.  
- Reason: Even with an index on product_id, PostgreSQL still needs to scan and aggregate all rows in the OrderItems table to calculate total quantities. Indexing alone does not reduce the number of rows to process.

**Further Optimization Options:**

1. Create a summary table (product_sold) that stores total quantity sold per product.  
   - Execution time: 0.04s  
   - Trade-off: Requires additional storage and maintenance.  

2. Create a materialized view (product_sold).  
   - Execution time: 0.04s  
   - Trade-off: Similar storage and maintenance costs, easier to refresh periodically.

---

### 4.3. Optimizing Query 3

Original Query 3 execution: 13s  

**Bottlenecks:**

1. Joining Orders and OrderItems  
   - Indexes on join columns are not very effective due to full-table aggregations.  
   - Computations on `created_at` prevent index usage.  

2. Grouping by a computed value (`DATE_TRUNC('month', o.created_at)`)  
   - Creating an index on `DATE_TRUNC(...)` has negligible effect.  

**Final Optimization:**

Create a **materialized view** storing precomputed monthly orders and revenue:

```
CREATE MATERIALIZED VIEW month_orders_revenue AS
SELECT DATE_TRUNC('month', o.created_at) AS month_start,
       COUNT(o.id) AS total_orders,
       SUM(oi.quantity * oi.price) AS total_revenue
FROM Orders o
JOIN OrderItems oi ON o.id = oi.order_id
GROUP BY month_start;
```

- Execution time after optimization: **0.04s**  

> Provides fast dashboard queries at the cost of extra storage and periodic refresh.

---

### 4.4. Optimizing Query 4

Original Query 4 execution: 16s  

**Bottlenecks:**

- Joining Orders and OrderItems over millions of rows  
- Nested aggregation: per-order totals, then per-user average  
- Joining with Users adds additional aggregation overhead  

**Final Optimization:**

Step 1: Materialized view for per-order totals

```
CREATE MATERIALIZED VIEW order_total AS
WITH order_totals AS (
    SELECT o.id, o.user_id, SUM(oi.quantity * oi.price) AS order_total
    FROM Orders o
    JOIN OrderItems oi ON o.id = oi.order_id
    GROUP BY o.id
)
SELECT *
FROM order_totals;
```

- Execution time: 1.4s  

Step 2: Index on `user_id` column of the view

```
CREATE INDEX idx_order_total_user_id ON order_total(user_id);
```

- Execution time: 1.2s  

Step 3: Precompute per-user average in a new materialized view

```
CREATE MATERIALIZED VIEW user_order_stats AS
WITH order_totals AS (
    SELECT o.user_id, SUM(oi.quantity * oi.price) AS order_total
    FROM Orders o
    JOIN OrderItems oi ON o.id = oi.order_id
    GROUP BY o.id
)
SELECT user_id, AVG(order_total) AS avg_order_val
FROM order_totals
GROUP BY user_id;
```

- Execution time: 0.1s  

**Notes:**

- Indexes improve joins, but the **largest performance gains come from precomputing aggregates**.  
- This approach supports near-instant dashboard queries while requiring extra storage and periodic refresh.

### 4.5. Optimizing Query 6

Original Query 6 execution: 2.4s  

**Observation:**

- Creating an index on `product_id` in `OrderItems` does **not significantly improve performance**.  
- PostgreSQL still needs to perform a sequential scan and aggregate all rows to compute revenue per product.

**Final Optimization:**

Create a **materialized view** storing revenue per product:

```
CREATE MATERIALIZED VIEW product_revenue AS
SELECT p.id, p.name, SUM(oi.quantity * oi.price) AS revenue
FROM Products p
JOIN OrderItems oi ON p.id = oi.product_id
GROUP BY p.id, p.name;
```

- Execution time after using the view: **0.04s**  

**Usage Example:**

```
SELECT *
FROM product_revenue
WHERE revenue > 2000;
```

---

### 4.6. Optimizing Query 8

Original Query 8 execution: 11s  

**Observation:**

- The query calculates total price per order on-the-fly over millions of rows.  
- Indexes on join columns help very little because the aggregation still requires scanning all `OrderItems`.

**Final Optimization:**

Reuse the **materialized view `order_total`** created in Query 4:

```
SELECT *
FROM order_total
WHERE order_total >= 2000;
```

- Execution time after using the materialized view: **0.3s**  

**Notes:**

- Precomputing order totals reduces expensive runtime aggregation.  
- Indexes could further improve filtering, but the materialized view alone already provides a large performance gain.

