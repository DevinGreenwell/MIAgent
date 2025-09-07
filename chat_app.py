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

def is_follow_up_question(current_message, conversation_history):
    """Determine if current message is a follow-up question"""
    if len(conversation_history) < 2:
        return False
    
    follow_up_indicators = [
        "what about", "how about", "and", "also", "additionally", "furthermore",
        "can you explain", "tell me more", "elaborate", "clarify", "expand",
        "yes", "no", "thanks", "thank you", "ok", "okay", "i see",
        "what if", "suppose", "consider", "compare", "contrast", "difference",
        "similar", "related", "connected", "regarding", "concerning"
    ]
    
    message_lower = current_message.lower()
    return any(indicator in message_lower for indicator in follow_up_indicators)

def get_conversation_context(conversation_history, limit=4):
    """Get recent conversation context for continuity"""
    if not conversation_history:
        return ""
    
    # Get last few exchanges
    recent_messages = conversation_history[-limit:]
    context_parts = []
    
    for msg in recent_messages:
        if msg["role"] == "user":
            context_parts.append(f"User previously asked: {msg['content']}")
        elif msg["role"] == "assistant":
            # Truncate long responses for context
            content = msg['content'][:300] + "..." if len(msg['content']) > 300 else msg['content']
            context_parts.append(f"Assistant responded: {content}")
    
    return "\n".join(context_parts)

def search_with_context(query, conversation_history, search_limit=10):
    """Enhanced search that considers conversation context"""
    try:
        # Check if this is a follow-up question
        is_follow_up = is_follow_up_question(query, conversation_history)
        
        # If it's a follow-up, expand the query with context
        search_query = query
        if is_follow_up and conversation_history:
            last_user_msg = None
            for msg in reversed(conversation_history):
                if msg["role"] == "user":
                    last_user_msg = msg["content"]
                    break
            
            if last_user_msg:
                search_query = f"{last_user_msg} {query}"
        
        # Step 1: Embed the search query
        embedded_query = openai.embeddings.create(
            input=[search_query],
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
                # Extract detailed CFR citation
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
                # Create detailed reference citation
                doc_type = res.payload.get('document_type', 'Reference')
                doc_name = res.payload.get('document_name', 'Unknown')
                filename = res.payload.get('filename', '')
                
                # Create more specific citation based on document type
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

        # Step 5: Build context string with source attribution and citation list
        context_parts = []
        citation_list = []
        
        for res in top_results:
            context_parts.append(f"[{res['source']}]: {res['text']}")
            citation_list.append(res['source'])
        
        context = "\n\n".join(context_parts)
        citations_display = list(dict.fromkeys(citation_list))  # Remove duplicates while preserving order

        return {
            "context": context,
            "citations": len(top_results),
            "citations_list": citations_display,
            "sources_searched": collections_searched,
            "cfr_results": len([r for r in top_results if r["collection"] == "CFR"]),
            "ref_results": len([r for r in top_results if r["collection"] == "Reference"]),
            "is_follow_up": is_follow_up,
            "expanded_query": search_query != query
        }

    except Exception as e:
        return {
            "context": "",
            "citations": 0,
            "citations_list": [],
            "sources_searched": [],
            "cfr_results": 0,
            "ref_results": 0,
            "is_follow_up": False,
            "expanded_query": False,
            "error": str(e)
        }

def generate_conversational_response(user_input, search_results, conversation_history, temperature_override: float | None = None):
    """Generate a conversational response using context and conversation history"""
    try:
        # Build conversation context
        conversation_context = get_conversation_context(conversation_history)
        
        # Prepare messages for GPT
        messages = [
            {
                "role": "system",
                "content": """You are an expert maritime regulatory consultant engaging in natural conversation about maritime regulations.

CONVERSATION STYLE:
- Speak naturally and conversationally, as if chatting with a colleague
- Provide comprehensive answers with detailed explanations
- Reference previous parts of our conversation when relevant
- Ask follow-up questions to keep the conversation flowing
- Offer additional insights or related topics

CITATION APPROACH:
- Weave specific regulatory citations naturally into your explanations
- End your response with a "Sources:" section listing the exact citations used
- Use precise section numbers (e.g., "46 CFR §117.78", "SOLAS Chapter III-2", "ABS Part 4 Section 3")
- Make citations actionable - users should know exactly where to look

RESPONSE STRUCTURE:
1. Conversational answer with integrated references
2. Additional context or insights
3. Follow-up question or conversation continuation
4. "Sources:" section with numbered, precise citations

Remember: You're having a professional conversation, not writing a formal report. Be engaging, helpful, and precise with your sources."""
            }
        ]
        
        # Add conversation history (last few exchanges)
        if conversation_history:
            for msg in conversation_history[-6:]:  # Last 3 exchanges
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"] if msg["role"] == "user" else msg["content"][:500]  # Truncate long assistant responses
                })
        
        # Add current user input with context
        context_info = ""
        if search_results["citations"] > 0:
            context_info = f"\n\nRelevant regulatory information:\n{search_results['context']}"
            
        if search_results.get("is_follow_up"):
            context_info += f"\n\n[Note: This appears to be a follow-up question to our previous discussion]"
        
        messages.append({
            "role": "user", 
            "content": f"{user_input}{context_info}"
        })

        # Generate response with fallback
        try:
            # Try GPT-5 Mini first
            response = openai.chat.completions.create(
                model="gpt-5-mini-2025-08-07",
                messages=messages,
                max_completion_tokens=800,
                temperature=temperature_override if temperature_override is not None else 0.7,
            )
            
            # Check if response has content
            if not response.choices or not response.choices[0].message.content:
                raise Exception("GPT-5 Mini returned empty response")
                
        except Exception as gpt5_error:
            # Fallback to GPT-4o-mini
            try:
                response = openai.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    max_tokens=800,
                    temperature=temperature_override if temperature_override is not None else 0.7,
                )
                
                if not response.choices or not response.choices[0].message.content:
                    return {
                        "answer": f"Both GPT-5 Mini and GPT-4 failed to generate responses. GPT-5 Mini error: {str(gpt5_error)}",
                        "context": search_results["context"],
                        "citations": search_results["citations"],
                        "citations_list": search_results.get("citations_list", []),
                        "sources_searched": search_results["sources_searched"],
                        "cfr_results": search_results["cfr_results"],
                        "ref_results": search_results["ref_results"],
                        "is_follow_up": search_results.get("is_follow_up", False)
                    }
                    
            except Exception as gpt4_error:
                return {
                    "answer": f"Error: Both models failed. GPT-5 Mini: {str(gpt5_error)}, GPT-4: {str(gpt4_error)}",
                    "context": search_results["context"],
                    "citations": search_results["citations"],
                    "citations_list": search_results.get("citations_list", []),
                    "sources_searched": search_results["sources_searched"],
                    "cfr_results": search_results["cfr_results"],
                    "ref_results": search_results["ref_results"],
                    "is_follow_up": search_results.get("is_follow_up", False)
                }

        return {
            "answer": response.choices[0].message.content,
            "context": search_results["context"],
            "citations": search_results["citations"],
            "citations_list": search_results.get("citations_list", []),
            "sources_searched": search_results["sources_searched"],
            "cfr_results": search_results["cfr_results"],
            "ref_results": search_results["ref_results"],
            "is_follow_up": search_results.get("is_follow_up", False)
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return {
            "answer": f"I apologize, but I encountered an error while generating the response: {str(e)}\n\nDebug details: {error_details}",
            "context": "",
            "citations": 0,
            "citations_list": [],
            "sources_searched": [],
            "cfr_results": 0,
            "ref_results": 0,
            "is_follow_up": False
        }

# Streamlit UI
st.set_page_config(
    page_title="MIAgent", 
    layout="wide"
)

# Custom CSS to remove header padding and hide default elements
st.markdown("""
<style>
    .block-container {
        padding-top: 1rem;
        padding-bottom: 0rem;
        padding-left: 5rem;
        padding-right: 5rem;
    }
    .element-container:has(iframe[height="0"]) {
        display: none;
    }
    div[data-testid="metric-container"] {
        display: none;
    }
</style>
""", unsafe_allow_html=True)

st.title("MIAgent")
st.caption("Have a conversation about maritime regulations - ask questions, get clarifications, and explore related topics")

# Additional UI polish CSS
st.markdown(
    """
    <style>
        /* Chat message subtle backgrounds */
        [data-testid="stChatMessage"] div:nth-child(1)[class*="content"] {
            background: transparent !important;
        }
        [data-testid="stChatMessage"] .stMarkdown {
            padding: 0.25rem 0;
        }

        /* Responsive padding for small screens */
        @media (max-width: 900px) {
            .block-container { padding-left: 1rem; padding-right: 1rem; }
        }
    </style>
    """,
    unsafe_allow_html=True,
)

# Initialize session state for chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Initialize session state for chat management
if "chat_history" not in st.session_state:
    st.session_state.chat_history = {}
    
if "current_chat_id" not in st.session_state:
    st.session_state.current_chat_id = f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
if "chat_counter" not in st.session_state:
    st.session_state.chat_counter = 1

# Optional queued prompt support (for example chips)
if "queued_prompt" not in st.session_state:
    st.session_state.queued_prompt = None

# Helper: format source type badges
def classify_source(source: str):
    s = (source or "").lower()
    if s.startswith("46 cfr") or "cfr" in s:
        return ("CFR", "#1D4ED8")  # blue-700
    if s.startswith("abs"):
        return ("ABS", "#0E7490")  # teal-600
    if s.startswith("solas"):
        return ("SOLAS", "#7C3AED")  # violet-600
    if s.startswith("nvi"):
        return ("NVIC", "#DB2777")  # pink-600
    if s.startswith("msm"):
        return ("MSM", "#059669")  # emerald-600
    if s.startswith("uscg"):
        return ("USCG", "#DC2626")  # red-600
    return ("REF", "#334155")      # slate-700

# Helper: export current chat as markdown
def chat_to_markdown(messages):
    lines = ["# MIAgent Conversation\n"]
    for m in messages:
        role = "User" if m.get("role") == "user" else "Assistant"
        content = m.get("content", "").rstrip()
        lines.append(f"**{role}:**\n\n{content}\n")
    return "\n".join(lines)

# Save current chat before switching
def save_current_chat():
    if st.session_state.messages:
        # Create a title from the first user message
        first_message = next((msg["content"] for msg in st.session_state.messages if msg["role"] == "user"), "New Chat")
        title = first_message[:50] + "..." if len(first_message) > 50 else first_message
        
        st.session_state.chat_history[st.session_state.current_chat_id] = {
            "title": title,
            "messages": st.session_state.messages.copy(),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")
        }

def load_chat(chat_id):
    save_current_chat()  # Save current before switching
    st.session_state.current_chat_id = chat_id
    if chat_id in st.session_state.chat_history:
        st.session_state.messages = st.session_state.chat_history[chat_id]["messages"].copy()
    else:
        st.session_state.messages = []

def start_new_chat():
    save_current_chat()  # Save current before starting new
    st.session_state.chat_counter += 1
    st.session_state.current_chat_id = f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{st.session_state.chat_counter}"
    st.session_state.messages = []

# Sidebar with chat management
with st.sidebar:
    st.header("💬 Chats")
    
    # New Chat button
    if st.button("🆕 New Chat", use_container_width=True):
        start_new_chat()
        st.rerun()
    
    st.markdown("---")
    
    # Chat history
    if st.session_state.chat_history:
        st.subheader("Chat History")
        
        # Sort chats by timestamp (most recent first)
        sorted_chats = sorted(
            st.session_state.chat_history.items(), 
            key=lambda x: x[1]["timestamp"], 
            reverse=True
        )
        
        for chat_id, chat_data in sorted_chats:
            # Create a container for each chat item
            with st.container():
                col1, col2 = st.columns([4, 1])
                
                with col1:
                    # Make the title clickable
                    if st.button(
                        f"💬 {chat_data['title']}", 
                        key=f"load_{chat_id}",
                        help=f"Created: {chat_data['timestamp']}",
                        use_container_width=True
                    ):
                        load_chat(chat_id)
                        st.rerun()
                
                with col2:
                    # Delete button
                    if st.button("🗑️", key=f"delete_{chat_id}", help="Delete chat"):
                        del st.session_state.chat_history[chat_id]
                        if chat_id == st.session_state.current_chat_id:
                            start_new_chat()
                        st.rerun()
                
                st.caption(f"📅 {chat_data['timestamp']}")
    else:
        st.info("No previous chats")

    st.markdown("---")

    # Database status (from app.py pattern)
    st.subheader("🗄️ Database Status")
    cfr_status = "❌ Not connected"
    ref_status = "❌ Not connected"
    cfr_count = 0
    ref_count = 0
    try:
        cfr_info = qdrant.get_collection("46_cfr_chunks")
        cfr_status = "✅ CFR Connected"
        cfr_count = getattr(cfr_info, "points_count", 0)
    except Exception:
        pass
    try:
        ref_info = qdrant.get_collection("reference_documents")
        ref_status = "✅ References Connected"
        ref_count = getattr(ref_info, "points_count", 0)
    except Exception:
        pass

    c1, c2 = st.columns(2)
    with c1:
        st.metric("CFR Sections", f"{cfr_count:,}")
        st.caption(cfr_status)
    with c2:
        st.metric("Reference Docs", f"{ref_count:,}")
        st.caption(ref_status)

    st.markdown("---")

    # Settings
    st.subheader("⚙️ Settings")
    top_k = st.slider("Top results to use", min_value=5, max_value=30, value=15, step=1)
    temperature = st.slider("Creativity (temperature)", min_value=0.0, max_value=1.0, value=0.7, step=0.05)

# Add conversation tips
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
                st.markdown(message["content"])  # render markdown naturally
                # Copy button via simple HTML/JS clipboard
                safe = message["content"].replace("`", "\u0060")
                st.markdown(
                    f"<button onclick=\"navigator.clipboard.writeText(`{safe}`)\" style='margin-top:8px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;'>Copy answer</button>",
                    unsafe_allow_html=True,
                )
                # Export controls
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
                # Sources
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
                # Context
                if message.get("context"):
                    with st.expander("View retrieved context", expanded=False):
                        st.text(message["context"])
                else:
                    st.caption("No context captured for this message.")
            with tabs[3]:
                # Debug info
                if message.get("is_follow_up"):
                    st.success("🔄 Follow-up question - used conversation context")
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
        with st.spinner("Thinking and searching regulatory databases..."):
            # Search with conversation context
            search_results = search_with_context(prompt_text, st.session_state.messages[:-1], search_limit=top_k)  # Exclude current user message
            
            # Generate conversational response
            result = generate_conversational_response(
                prompt_text,
                search_results,
                st.session_state.messages[:-1],
                temperature_override=temperature,
            )
            
            # Debug: Check if we have an answer
            if result.get("answer"):
                st.markdown(result["answer"])
            else:
                st.error("No response generated. Please try again.")
                st.write(f"Debug - Search results: {search_results.get('citations', 0)} sources found")
            
            # Store full result in session state
            st.session_state.messages.append({
                "role": "assistant", 
                "content": result.get("answer", ""),
                "context": result.get("context", ""),
                "citations": result.get("citations", 0),
                "citations_list": result.get("citations_list", []),
                "sources_searched": result.get("sources_searched", []),
                "cfr_results": result.get("cfr_results", 0),
                "ref_results": result.get("ref_results", 0),
                "is_follow_up": result.get("is_follow_up", False)
            })

            # Show if it was a follow-up
            if result.get("is_follow_up"):
                st.success("🔄 Follow-up question - used conversation context")

# Process queued prompt from example chips
if st.session_state.queued_prompt:
    qp = st.session_state.queued_prompt
    st.session_state.queued_prompt = None
    handle_prompt(qp)

# Chat input
if prompt := st.chat_input("Continue our conversation about maritime regulations..."):
    handle_prompt(prompt)

# Auto-save current chat when messages are added
if st.session_state.messages:
    save_current_chat()
