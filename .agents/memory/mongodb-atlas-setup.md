---
name: MongoDB Atlas Setup Requirements
description: Required Atlas configuration steps for FounderAI to work — IP whitelist and vector search index
---

## IP Whitelist (required for any connection)

MongoDB Atlas blocks all IPs by default. The Replit server gets a TLS SSL alert 80 error unless you add `0.0.0.0/0` to Network Access.

Steps: Atlas dashboard → Network Access → Add IP Address → Allow Access from Anywhere → Confirm.

**Why:** Replit uses dynamic IPs; whitelisting is the only reliable option.

## Vector Search Index (required for semantic recall)

The `memories` collection needs a vector search index named `vector_index` on the `embedding` field.

- Model: `text-embedding-004` produces 768-dimensional embeddings
- Index config: `{ "fields": [{ "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" }] }`

Steps: Atlas dashboard → your cluster → Search Indexes → Create Index → JSON Editor → paste config → name it `vector_index` → target `founderai.memories` collection.

**Why:** Without this, `$vectorSearch` aggregation fails and the app falls back to recency-sorted text search (still works, just not semantic).

## Connection string format
MongoDB URI should be `mongodb+srv://...` format (Atlas SRV). The MongoClient is configured with `tls: true` and `serverSelectionTimeoutMS: 15000`.
