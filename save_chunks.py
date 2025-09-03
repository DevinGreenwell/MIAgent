import json
import pandas as pd
import re

# Load the original JSON file
with open("/Users/devingreenwell/Desktop/Devin/Projects/MIAgent/title-46.json", "r") as file:
    data = json.load(file)

# Recursively extract CFR sections
def extract_sections(item, parent_path=""):
    chunks = []
    current_label = item.get("label", "")
    current_id = item.get("identifier", "")
    current_type = item.get("type", "")
    full_path = f"{parent_path} > {current_label}" if parent_path else current_label

    if current_type == "section":
        chunks.append({
            "path": full_path,
            "identifier": current_id,
            "label": current_label,
            "description": item.get("label_description", ""),
            "size": item.get("size", 0),
            "received_on": item.get("received_on", ""),
        })

    for child in item.get("children", []):
        chunks.extend(extract_sections(child, full_path))

    return chunks

# Create initial DataFrame
sections = extract_sections(data)
df_sections = pd.DataFrame(sections)

# Chunk descriptions for embedding
def chunk_text(text, max_tokens=1000):
    max_chars = max_tokens * 4
    sentences = re.split(r'(?<=[.?!])\s+', text)
    
    chunks = []
    current_chunk = ""
    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= max_chars:
            current_chunk += sentence + " "
        else:
            chunks.append(current_chunk.strip())
            current_chunk = sentence + " "
    if current_chunk:
        chunks.append(current_chunk.strip())
    return chunks

# Generate chunked DataFrame
chunked_data = []
for _, row in df_sections.iterrows():
    if row["description"]:
        chunks = chunk_text(row["description"])
        for i, chunk in enumerate(chunks):
            chunked_data.append({
                "path": row["path"],
                "identifier": row["identifier"],
                "label": row["label"],
                "chunk_index": i,
                "text": chunk,
                "received_on": row["received_on"]
            })

df_chunks = pd.DataFrame(chunked_data)

# Save to CSV
df_chunks.to_csv("46_cfr_chunks.csv", index=False)
print("✅ Saved as 46_cfr_chunks.csv")