import os
from openai import OpenAI
import pandas as pd
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, VectorParams, Distance
import uuid

# Connect to Qdrant
qdrant = QdrantClient(host="localhost", port=6333)

# Load processed reference data
df = pd.read_csv("references_chunks.csv")
print(f"Loaded {len(df)} reference document chunks")

# Create the vector collection for references
collection_name = "reference_documents"
if not qdrant.collection_exists(collection_name=collection_name):
    print(f"Creating collection: {collection_name}")
    qdrant.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    )
else:
    print(f"Collection {collection_name} already exists")

# Initialize OpenAI client
client = OpenAI()

# Embed and insert in batches
batch_size = 50
total_batches = (len(df) + batch_size - 1) // batch_size

print(f"Processing {total_batches} batches of {batch_size} chunks each...")

for i in range(0, len(df), batch_size):
    batch_num = (i // batch_size) + 1
    print(f"Processing batch {batch_num}/{total_batches}...")
    
    batch = df.iloc[i:i+batch_size]
    texts = batch["text"].tolist()

    try:
        # Create embeddings
        embeddings = client.embeddings.create(
            input=texts,
            model="text-embedding-3-small"
        ).data

        # Create points for Qdrant
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=emb.embedding,
                payload={
                    "identifier": row["identifier"],
                    "document_name": row["document_name"],
                    "document_type": row["document_type"],
                    "filename": row["filename"],
                    "chunk_index": int(row["chunk_index"]),
                    "text": row["text"],
                    "processed_on": row["processed_on"]
                }
            )
            for row, emb in zip(batch.to_dict("records"), embeddings)
        ]

        # Insert into Qdrant
        qdrant.upsert(collection_name=collection_name, points=points)
        
    except Exception as e:
        print(f"Error processing batch {batch_num}: {e}")
        continue

print("✅ Embedding and storage complete.")

# Get final count
try:
    count_result = qdrant.count(collection_name=collection_name, exact=True)
    print(f"Total points in {collection_name}: {count_result.count}")
    
    # Show collection info
    collection_info = qdrant.get_collection(collection_name)
    print(f"Collection status: {collection_info.status}")
    
except Exception as e:
    print(f"Error getting collection info: {e}")

print("\n📊 Reference document types embedded:")
doc_types = df['document_type'].value_counts()
for doc_type, count in doc_types.items():
    print(f"  {doc_type}: {count:,} chunks")