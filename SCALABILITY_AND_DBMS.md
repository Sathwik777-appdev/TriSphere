# TriSphere: DBMS & Scalability Architecture Note

## 1. Database Management System (DBMS)
**TriSphere uses Google Cloud Firestore (Firebase)** as its primary database. Firestore is a flexible, scalable NoSQL cloud database designed for mobile, web, and server development.

### Why Firestore?
*   **Massive Scalability**: Firestore automatically handles sharding and replication. As your data grows, Firestore scales horizontally without manual intervention or downtime.
*   **Real-time Updates**: Essential for features like chat, live notifications, and instantaneous UI updates without page refreshes.
*   **Serverless**: No servers to provision or manage. It handles spikes in traffic gracefully.
*   **Flexible Data Model**: Uses a document-collection model that fits diverse data structures (Users, Quizzes, Submissions) better than rigid SQL tables.

### Data Modeling & Performance
*   **Denormalization**: To optimize read performance, we often duplicate key data (e.g., User Profile info inside a `Post` document) to avoid complex "joins" which are expensive in distributed systems.
*   **Indexing**: We use custom indexes (defined in `firestore.indexes.json`) to ensure complex queries (e.g., filtering `activityLogs` by timestamp and user) remain fast regardless of dataset size.

---

## 2. Scalability Strategy

The application is architected to scale from 10 users to 10 million users with minimal architectural changes.

### A. Backend Compute (Google Cloud Run)
The Node.js backend (`server.js`) is deployed on **Google Cloud Run**, a fully managed compute platform.
*   **Auto-scaling**: Cloud Run automatically scales the number of container instances up or down based on incoming traffic. If traffic spikes, it spins up more instances instantly. If traffic drops, it scales down to zero to save costs.
*   **Statelessness**: The backend is designed to be stateless (no local session storage), allowing any request to be handled by any available instance.

### B. Caching Strategy
Database reads are the primary cost and performance bottleneck in cloud apps. We mitigate this with strategic caching:
*   **Leaderboard Caching**: The Leaderboard API (which requires aggregating 4 different collections: Users, Quizzes, Submissions, Activity) is cached **in-memory** for 15 minutes.
    *   *Benefit*: Reduces Firestore reads by ~99% for this high-traffic endpoint.
    *   *Mechanism*: The server holds the calculated leaderboard in memory and serves it instantly to subsequent requests until cache expiry.
*   **Frontend Edge Caching**: Deployed on **Vercel**, static assets and frontend chunks are cached at the Edge (CDN), ensuring fast load times globally.

### C. Code-Level Optimizations
*   **Parallel Execution**: Critical backend operations use `Promise.all()` to fetch independent data concurrently (e.g., fetching Users and Quiz Results at the same time), significantly reducing API latency.
*   **Rate Limiting**: Implemented (`express-rate-limit`) to prevent abuse (DDoS) and ensure fair usage of resources.
*   **Efficient Querying**: Queries are specific and indexed. We avoid "full table scans" by using precise `where()` clauses and limits.

### D. Future Scalability Considerations
As the app grows beyond 100k+ active users, we can introduce:
1.  **Redis (Memorystore)**: Replace in-memory caching with a distributed Redis cache to share state across all Cloud Run instances.
2.  **CDN for API**: Cache public API responses (like Leaderboard) at the CDN level.
3.  **Algolia / ElasticSearch**: Offload complex search requirements from Firestore to a dedicated search engine.
