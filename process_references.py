import os
import pandas as pd
from pypdf import PdfReader
import re
from datetime import datetime
import uuid

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file"""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
        return ""

def chunk_text(text, chunk_size=1000, overlap=200):
    """Split text into overlapping chunks"""
    if not text or len(text) < chunk_size:
        return [text] if text else []
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        
        if end >= len(text):
            chunks.append(text[start:])
            break
        
        # Try to break at sentence end
        chunk = text[start:end]
        last_period = chunk.rfind('.')
        last_newline = chunk.rfind('\n')
        
        break_point = max(last_period, last_newline)
        
        if break_point > start + chunk_size // 2:
            end = start + break_point + 1
        
        chunks.append(text[start:end])
        start = end - overlap
    
    return chunks

def process_references_folder(folder_path):
    """Process all documents in references folder"""
    documents = []
    
    for filename in os.listdir(folder_path):
        if filename.lower().endswith('.pdf'):
            print(f"Processing {filename}...")
            
            filepath = os.path.join(folder_path, filename)
            text = extract_text_from_pdf(filepath)
            
            if not text:
                continue
            
            # Clean filename for use as identifier
            doc_name = filename.replace('.pdf', '')
            
            # Determine document type
            doc_type = "Unknown"
            if "ABS" in filename:
                doc_type = "ABS Standard"
            elif "MSM" in filename:
                doc_type = "Marine Safety Manual"
            elif "NVIC" in filename:
                doc_type = "Navigation and Vessel Inspection Circular"
            elif "SOLAS" in filename:
                doc_type = "Safety of Life at Sea"
            elif "CG-INV" in filename:
                doc_type = "Coast Guard Policy Letter"
            
            # Chunk the text
            chunks = chunk_text(text, chunk_size=1000, overlap=200)
            
            for i, chunk in enumerate(chunks):
                if len(chunk.strip()) < 50:  # Skip very short chunks
                    continue
                
                documents.append({
                    'identifier': f"{doc_name}_{i}",
                    'document_name': doc_name,
                    'document_type': doc_type,
                    'filename': filename,
                    'chunk_index': i,
                    'text': chunk.strip(),
                    'processed_on': datetime.now().isoformat()
                })
    
    return documents

def save_to_csv(documents, output_file):
    """Save processed documents to CSV"""
    df = pd.DataFrame(documents)
    df.to_csv(output_file, index=False)
    print(f"Saved {len(documents)} chunks to {output_file}")
    
    # Print summary
    doc_types = df['document_type'].value_counts()
    print("\nDocument summary:")
    for doc_type, count in doc_types.items():
        print(f"  {doc_type}: {count} chunks")

if __name__ == "__main__":
    print("Processing reference documents...")
    
    references_folder = "references"
    output_file = "references_chunks.csv"
    
    if not os.path.exists(references_folder):
        print(f"Error: {references_folder} folder not found")
        exit(1)
    
    documents = process_references_folder(references_folder)
    
    if documents:
        save_to_csv(documents, output_file)
        print(f"\n✅ Processing complete! {len(documents)} chunks ready for embedding.")
    else:
        print("❌ No documents processed.")