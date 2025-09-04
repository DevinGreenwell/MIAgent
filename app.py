import os
import streamlit as st
import openai
import pandas as pd
from qdrant_client import QdrantClient
from datetime import datetime
import time

# Initialize OpenAI with API key from environment
if "OPENAI_API_KEY" not in os.environ:
    with open("API.txt", "r") as f:
        os.environ["OPENAI_API_KEY"] = f.read().strip()

openai.api_key = os.environ["OPENAI_API_KEY"]

# Initialize Qdrant client
@st.cache_resource
def init_qdrant():
    return QdrantClient(host="localhost", port=6333)

qdrant = init_qdrant()
cfr_collection = "46_cfr_chunks"
ref_collection = "reference_documents"

def search_all_documents(query, search_limit=10):
    """Search both CFR and reference documents"""
    try:
        # Step 1: Embed the query
        embedded_query = openai.embeddings.create(
            input=[query],
            model="text-embedding-3-small"
        ).data[0].embedding

        all_results = []
        collections_searched = []
        
        # Step 2: Search CFR collection
        try:
            cfr_results = qdrant.search(
                collection_name=cfr_collection,
                query_vector=embedded_query,
                limit=search_limit,
                with_payload=True
            )
            
            for res in cfr_results:
                all_results.append({
                    "text": res.payload["text"],
                    "source": "CFR Title 46",
                    "label": res.payload.get("label", "CFR Section"),
                    "score": res.score,
                    "collection": "CFR"
                })
            collections_searched.append(f"CFR ({len(cfr_results)} results)")
            
        except Exception as e:
            st.warning(f"CFR search failed: {e}")

        # Step 3: Search reference documents collection
        try:
            ref_results = qdrant.search(
                collection_name=ref_collection,
                query_vector=embedded_query,
                limit=search_limit,
                with_payload=True
            )
            
            for res in ref_results:
                all_results.append({
                    "text": res.payload["text"],
                    "source": f"{res.payload.get('document_type', 'Reference')} - {res.payload.get('document_name', 'Unknown')}",
                    "label": res.payload.get("document_name", "Reference Document"),
                    "score": res.score,
                    "collection": "Reference"
                })
            collections_searched.append(f"References ({len(ref_results)} results)")
            
        except Exception as e:
            st.warning(f"Reference search failed: {e}")

        # Step 4: Sort by relevance score and take top results
        all_results.sort(key=lambda x: x["score"], reverse=True)
        top_results = all_results[:15]  # Take top 15 overall

        # Step 5: Build context string with source attribution
        context_parts = []
        for res in top_results:
            context_parts.append(f"[{res['source']}]: {res['text']}")
        
        context = "\n\n".join(context_parts)

        # Step 6: Ask GPT-4 to answer using the comprehensive context
        response = openai.chat.completions.create(
            model="gpt-5-2025-08-07",
            messages=[
                {
                    "role": "system",
                    "content": """You are a maritime regulatory expert with access to CFR Title 46 (Shipping regulations) and related reference documents including ABS standards, Marine Safety Manual, SOLAS, and NVIC guidelines. 

Use the provided context to give comprehensive answers that may draw from:
- CFR Title 46 sections (official regulations)
- ABS Standards (American Bureau of Shipping)
- Marine Safety Manual (MSM)
- SOLAS (Safety of Life at Sea)
- NVIC (Navigation and Vessel Inspection Circulars)
- Coast Guard Policy Letters

Cite specific sources when available and explain how different documents relate to each other."""
                },
                {
                    "role": "user",
                    "content": f"Context from multiple maritime regulatory sources:\n\n{context}\n\nQuestion: {query}"
                }
            ]
        )

        return {
            "answer": response.choices[0].message.content,
            "context": context,
            "citations": len(top_results),
            "sources_searched": collections_searched,
            "cfr_results": len([r for r in top_results if r["collection"] == "CFR"]),
            "ref_results": len([r for r in top_results if r["collection"] == "Reference"])
        }

    except Exception as e:
        return {
            "answer": f"Error: {str(e)}",
            "context": "",
            "citations": 0,
            "sources_searched": [],
            "cfr_results": 0,
            "ref_results": 0
        }

# Streamlit UI
st.set_page_config(
    page_title="CFR Legal Assistant", 
    page_icon="⚖️",
    layout="wide"
)

st.title("⚖️ Maritime Regulatory Assistant")
st.caption("Ask questions about maritime regulations including CFR Title 46, ABS Standards, SOLAS, Marine Safety Manual, and NVIC guidelines")

# Initialize session state for chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Sidebar with info
with st.sidebar:
    st.header("About")
    st.write("This AI assistant searches multiple maritime regulatory sources to provide comprehensive answers about shipping and maritime safety regulations.")
    
    st.header("Database Status")
    cfr_status = "❌ Not connected"
    ref_status = "❌ Not connected"
    cfr_count = 0
    ref_count = 0
    
    try:
        cfr_info = qdrant.get_collection(cfr_collection)
        cfr_status = "✅ CFR Connected"
        cfr_count = cfr_info.points_count
    except:
        pass
        
    try:
        ref_info = qdrant.get_collection(ref_collection)
        ref_status = "✅ References Connected"
        ref_count = ref_info.points_count
    except:
        pass
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("CFR Sections", f"{cfr_count:,}")
        st.caption(cfr_status)
    with col2:
        st.metric("Reference Docs", f"{ref_count:,}")
        st.caption(ref_status)

    st.header("Document Sources")
    st.write("**CFR Title 46**: Official shipping regulations")
    st.write("**ABS Standards**: American Bureau of Shipping")
    st.write("**MSM**: Marine Safety Manual")
    st.write("**SOLAS**: Safety of Life at Sea")
    st.write("**NVIC**: Navigation & Vessel Inspection Circulars")
    
    st.header("Example Questions")
    st.write("• What are the requirements for life jackets on recreational boats?")
    st.write("• What are the inspection requirements for commercial vessels?")
    st.write("• What ABS standards apply to hull construction?")
    st.write("• What SOLAS requirements apply to passenger ships?")

# Chat interface
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        if message["role"] == "assistant":
            st.write(message["content"])
            if "context" in message and st.button("Show Citations", key=f"citations_{len(st.session_state.messages)}"):
                with st.expander("📄 Retrieved CFR Sections"):
                    st.text(message["context"])
        else:
            st.write(message["content"])

# Chat input
if prompt := st.chat_input("Ask a question about maritime regulations..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    # Display user message
    with st.chat_message("user"):
        st.write(prompt)

    # Display assistant response
    with st.chat_message("assistant"):
        with st.spinner("Searching maritime regulatory databases and generating response..."):
            result = search_all_documents(prompt)
            
            st.write(result["answer"])
            
            # Store full result in session state
            st.session_state.messages.append({
                "role": "assistant", 
                "content": result["answer"],
                "context": result["context"],
                "citations": result["citations"],
                "cfr_results": result.get("cfr_results", 0),
                "ref_results": result.get("ref_results", 0)
            })

            # Show detailed citations info
            if result["citations"] > 0:
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Total Sources", result["citations"])
                with col2:
                    st.metric("CFR Sections", result.get("cfr_results", 0))
                with col3:
                    st.metric("Reference Docs", result.get("ref_results", 0))
                
                if result.get("sources_searched"):
                    st.info(f"🔍 Searched: {', '.join(result['sources_searched'])}")
                
                with st.expander("📄 View All Retrieved Sources"):
                    st.text(result["context"])

# Clear chat button
if st.sidebar.button("🗑️ Clear Chat History"):
    st.session_state.messages = []
    st.rerun()