import os
import streamlit as st
import openai
import pandas as pd
from qdrant_client import QdrantClient
from datetime import datetime
import time

# Secrets/env helpers
def get_secret(name: str, default=None):
    if name in st.secrets:
        return st.secrets[name]
    return os.getenv(name, default)

def get_openai_key() -> str:
    key = get_secret("OPENAI_API_KEY")
    if not key:
        st.error("Missing OPENAI_API_KEY. Set it in Streamlit secrets or environment.")
        st.stop()
    return key

openai.api_key = get_openai_key()

# Initialize Qdrant client
@st.cache_resource
def init_qdrant():
    url = get_secret("QDRANT_URL")
    api_key = get_secret("QDRANT_API_KEY")
    if url:
        return QdrantClient(url=url, api_key=api_key) if api_key else QdrantClient(url=url)
    host = get_secret("QDRANT_HOST", "localhost")
    port = int(get_secret("QDRANT_PORT", "6333"))
    return QdrantClient(host=host, port=port)

qdrant = init_qdrant()
cfr_collection = "46_cfr_chunks"
ref_collection = "reference_documents"

def search_all_documents(query, search_limit=10, temperature=0.7):
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
                cfr_label = res.payload.get("label", "CFR Section")
                detailed_citation = f"46 CFR {cfr_label}" if cfr_label != "CFR Section" else "46 CFR"
                all_results.append({
                    "text": res.payload["text"],
                    "source": detailed_citation,
                    "label": cfr_label,
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
                doc_type = res.payload.get('document_type', 'Reference')
                doc_name = res.payload.get('document_name', 'Unknown')
                if doc_type == "ABS Standard":
                    detailed_citation = f"ABS {doc_name}"
                elif doc_type == "Safety of Life at Sea":
                    detailed_citation = f"SOLAS - {doc_name}"
                elif doc_type == "Navigation and Vessel Inspection Circular":
                    detailed_citation = f"NVIC - {doc_name}"
                elif doc_type == "Marine Safety Manual":
                    detailed_citation = f"MSM {doc_name}"
                elif doc_type == "Coast Guard Policy Letter":
                    detailed_citation = f"USCG Policy - {doc_name}"
                else:
                    detailed_citation = f"{doc_type} - {doc_name}"
                all_results.append({
                    "text": res.payload["text"],
                    "source": detailed_citation,
                    "label": doc_name,
                    "score": res.score,
                    "collection": "Reference"
                })
            collections_searched.append(f"References ({len(ref_results)} results)")
            
        except Exception as e:
            st.warning(f"Reference search failed: {e}")

        # Step 4: Sort by relevance score and take top results
        all_results.sort(key=lambda x: x["score"], reverse=True)
        top_results = all_results[:15]  # Take top 15 overall

        # Step 5: Build context string and citation list
        context_parts = []
        citation_list = []
        for res in top_results:
            context_parts.append(f"[{res['source']}]: {res['text']}")
            citation_list.append(res['source'])
        context = "\n\n".join(context_parts)
        citations_display = list(dict.fromkeys(citation_list))

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
        , temperature=temperature)

        return {
            "answer": response.choices[0].message.content,
            "context": context,
            "citations": len(top_results),
            "citations_list": citations_display,
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
            "citations_list": [],
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

# Additional UI polish CSS
st.markdown(
    """
    <style>
        [data-testid=\"stChatMessage\"] .stMarkdown { padding: 0.25rem 0; }
        @media (max-width: 900px) {
            .block-container { padding-left: 1rem; padding-right: 1rem; }
        }
    </style>
    """,
    unsafe_allow_html=True,
)

# Helpers
def classify_source(source: str):
    s = (source or "").lower()
    if s.startswith("46 cfr") or "cfr" in s:
        return ("CFR", "#1D4ED8")
    if s.startswith("abs"):
        return ("ABS", "#0E7490")
    if s.startswith("solas"):
        return ("SOLAS", "#7C3AED")
    if s.startswith("nvi"):
        return ("NVIC", "#DB2777")
    if s.startswith("msm"):
        return ("MSM", "#059669")
    if s.startswith("uscg"):
        return ("USCG", "#DC2626")
    return ("REF", "#334155")

def chat_to_markdown(messages):
    lines = ["# Maritime Regulatory Assistant Conversation\n"]
    for m in messages:
        role = "User" if m.get("role") == "user" else "Assistant"
        content = m.get("content", "").rstrip()
        lines.append(f"**{role}:**\n\n{content}\n")
    return "\n".join(lines)

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
    
    st.header("Settings")
    top_k = st.slider("Top results to use", 5, 30, 15)
    temperature = st.slider("Creativity (temperature)", 0.0, 1.0, 0.7, 0.05)

# Example chips on empty state
if "queued_prompt" not in st.session_state:
    st.session_state.queued_prompt = None

if len(st.session_state.messages) == 0:
    st.info("💡 Click a sample to start quickly")
    examples = [
        "What are the 46 CFR requirements for life jackets on small passenger vessels?",
        "Compare SOLAS abandon-ship drill requirements with 46 CFR for passenger ships.",
        "Which ABS standards apply to steel hull construction for tugs?",
        "What inspections are required for a 100 GT domestic passenger vessel?",
    ]
    ecols = st.columns(len(examples))
    for idx, (col, ex) in enumerate(zip(ecols, examples)):
        with col:
            if st.button(ex, key=f"ex_{idx}"):
                st.session_state.queued_prompt = ex
                st.rerun()

# Chat interface
for i, message in enumerate(st.session_state.messages):
    with st.chat_message(message["role"]):
        if message["role"] == "assistant":
            tabs = st.tabs(["Answer", "Sources", "Context", "Debug"])
            with tabs[0]:
                st.markdown(message["content"])
                safe = message["content"].replace("`", "\u0060")
                st.markdown(
                    f"<button onclick=\"navigator.clipboard.writeText(`{safe}`)\" style='margin-top:8px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;'>Copy answer</button>",
                    unsafe_allow_html=True,
                )
                colx1, colx2 = st.columns(2)
                with colx1:
                    md_content = f"## Answer\n\n{message['content']}\n\n"
                    st.download_button(
                        "Export answer (Markdown)",
                        data=md_content,
                        file_name=f"miagent_answer_{i+1}.md",
                        mime="text/markdown",
                        key=f"dl_md_{i}",
                        use_container_width=True,
                    )
                with colx2:
                    import json
                    msg_json = json.dumps(message, ensure_ascii=False, indent=2)
                    st.download_button(
                        "Export message (JSON)",
                        data=msg_json,
                        file_name=f"miagent_message_{i+1}.json",
                        mime="application/json",
                        key=f"dl_json_{i}",
                        use_container_width=True,
                    )
            with tabs[1]:
                clist = message.get("citations_list") or []
                if not clist:
                    st.info("No sources to display for this answer.")
                else:
                    st.caption(f"Total unique sources: {len(clist)}")
                    for j, src in enumerate(clist, start=1):
                        label, color = classify_source(src)
                        st.markdown(
                            f"<span style='display:inline-block;padding:2px 8px;border-radius:999px;background:{color};color:white;font-size:12px;margin-right:8px;'>{label}</span> {j}. {src}",
                            unsafe_allow_html=True,
                        )
            with tabs[2]:
                if message.get("context"):
                    with st.expander("View retrieved context", expanded=False):
                        st.text(message["context"])
                else:
                    st.caption("No context captured for this message.")
            with tabs[3]:
                st.write({
                    "citations": message.get("citations"),
                    "sources_searched": message.get("sources_searched"),
                    "cfr_results": message.get("cfr_results"),
                    "ref_results": message.get("ref_results"),
                })
        else:
            st.write(message["content"])

# Chat input
def handle_prompt(prompt_text: str):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt_text})
    
    # Display user message
    with st.chat_message("user"):
        st.write(prompt_text)

    # Display assistant response
    with st.chat_message("assistant"):
        with st.spinner("Searching maritime regulatory databases and generating response..."):
            result = search_all_documents(prompt_text, search_limit=top_k, temperature=temperature)
            st.markdown(result.get("answer", ""))
            # Store full result in session state
            st.session_state.messages.append({
                "role": "assistant", 
                "content": result.get("answer", ""),
                "context": result.get("context", ""),
                "citations": result.get("citations", 0),
                "citations_list": result.get("citations_list", []),
                "sources_searched": result.get("sources_searched", []),
                "cfr_results": result.get("cfr_results", 0),
                "ref_results": result.get("ref_results", 0)
            })

# Process example chip queued prompt
if st.session_state.queued_prompt:
    qp = st.session_state.queued_prompt
    st.session_state.queued_prompt = None
    handle_prompt(qp)

# Chat input
if prompt := st.chat_input("Ask a question about maritime regulations..."):
    handle_prompt(prompt)

# Clear chat button
if st.sidebar.button("🗑️ Clear Chat History"):
    st.session_state.messages = []
    st.rerun()
