import os
from openai import OpenAI
import pandas as pd
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, VectorParams, Distance
import uuid

# Set your OpenAI API Key

# Connect to Qdrant (local or remote)
qdrant = QdrantClient(host="localhost", port=6333)

# Load pre-chunked CFR data (make sure you saved it from earlier as a CSV)
df = pd.read_csv("46_cfr_chunks.csv")

# Create the vector collection if not already present
collection_name = "46_cfr_chunks"
if not qdrant.collection_exists(collection_name=collection_name):
    qdrant.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    )

# Embed and insert in batches
batch_size = 50
for i in range(0, len(df), batch_size):
    batch = df.iloc[i:i+batch_size]
    texts = batch["text"].tolist()

    from openai import OpenAI

    client = OpenAI()

    embeddings = client.embeddings.create(
        input=texts,
        model="text-embedding-3-small"
    ).data

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=emb.embedding,
            payload={
                "identifier": row["identifier"],
                "label": row["label"],
                "path": row["path"],
                "chunk_index": int(row["chunk_index"]),
                "text": row["text"],
                "received_on": row["received_on"]
            }
        )
        for row, emb in zip(batch.to_dict("records"), embeddings)
    ]

    qdrant.upsert(collection_name=collection_name, points=points)

print("✅ Embedding and storage complete.")
print(f"Total points in collection: {qdrant.count(collection_name=collection_name, exact=True).count}")