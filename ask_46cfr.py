import os
import openai
import pandas as pd
from qdrant_client import QdrantClient
# (No additional qdrant models needed)
import argparse

# Initialize OpenAI with API key from environment
openai.api_key = os.getenv("OPENAI_API_KEY")

qdrant = QdrantClient(host="localhost", port=6333)
collection_name = "46_cfr_chunks"

# Get user query from command line
parser = argparse.ArgumentParser()
parser.add_argument("question", type=str, help="Your legal or regulatory question")
args = parser.parse_args()
query = args.question

# Step 1: Embed the query
embedded_query = openai.embeddings.create(
    input=[query],
    model="text-embedding-3-small"
).data[0].embedding

# Step 2: Search Qdrant for top-k matches
search_results = qdrant.search(
    collection_name=collection_name,
    query_vector=embedded_query,
    limit=15,
    with_payload=True
)

# Step 3: Build a context string from retrieved chunks
context = "\n\n".join([
    f'{res.payload.get("label", "")}: {res.payload["text"]}' for res in search_results
])

# Step 4: Ask GPT-4 to answer using only the provided CFR chunks
print("\n📄 Retrieved Context:\n")
print(context)
response = openai.chat.completions.create(
    model="gpt-4.1-nano-2025-04-14",
    messages=[
        {
            "role": "system",
            "content": "You are a CFR expert. Use the provided context to identify which sections of the Code of Federal Regulations apply. If exact section numbers are not present, make your best judgment based on the content."
        },
        {
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion:\n{query}"
        }
    ]
)

# Step 5: Print answer
print("\n🧠 Answer:\n")
print(response.choices[0].message.content)