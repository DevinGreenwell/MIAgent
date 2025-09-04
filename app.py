import os
import streamlit as st
import openai
import pandas as pd
from qdrant_client import QdrantClient
from datetime import datetime
import time

# Initialize OpenAI with API key from Streamlit secrets or environment
if "OPENAI_API_KEY" not in os.environ:
    try:
        # Try Streamlit secrets first (for cloud deployment)
        os.environ["OPENAI_API_KEY"] = st.secrets["OPENAI_API_KEY"]
    except:
        try:
            # Fallback to local API.txt file (for local development)
            with open("API.txt", "r") as f:
                os.environ["OPENAI_API_KEY"] = f.read().strip()
        except FileNotFoundError:
            st.error("⚠️ OpenAI API key not found. Please add OPENAI_API_KEY to Streamlit secrets or create API.txt file.")
            st.stop()

openai.api_key = os.environ["OPENAI_API_KEY"]

# Initialize Qdrant client
@st.cache_resource
def init_qdrant():
    try:
        # Try cloud configuration from Streamlit secrets
        if "qdrant" in st.secrets:
            return QdrantClient(
                host=st.secrets["qdrant"]["host"],
                port=st.secrets["qdrant"].get("port", 6333),
                api_key=st.secrets["qdrant"].get("api_key", None)
            )
        elif "QDRANT_HOST" in st.secrets:
            return QdrantClient(
                host=st.secrets["QDRANT_HOST"],
                api_key=st.secrets.get("QDRANT_API_KEY", None)
            )
    except:
        pass
    
    # Fallback to localhost (for local development)
    try:
        return QdrantClient(host="localhost", port=6333)
    except Exception as e:
        st.error(f"⚠️ Cannot connect to Qdrant database. Please check your configuration. Error: {e}")
        st.info("💡 For local development: Start Qdrant with `docker run -p 6333:6333 qdrant/qdrant`")
        st.info("💡 For cloud deployment: Add Qdrant Cloud credentials to Streamlit secrets")
        st.stop()

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

def generate_conversational_response(user_input, search_results, conversation_history):
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
                max_completion_tokens=800
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
                    temperature=0.7
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

# Add conversation tips
if len(st.session_state.messages) == 0:
    with st.container():
        st.info("💡 **Tips for better conversations:**\n"
                "- Ask follow-up questions like 'What about commercial vessels?' or 'Can you explain that further?'\n"
                "- Reference previous topics: 'How does this relate to what we discussed about life jackets?'\n"
                "- Request clarification: 'I don't understand the difference between...'\n"
                "- Ask for examples: 'Can you give me a specific scenario?'")

# Chat interface
for i, message in enumerate(st.session_state.messages):
    with st.chat_message(message["role"]):
        if message["role"] == "assistant":
            st.write(message["content"])
            
            # Show if it was a follow-up
            if message.get("is_follow_up"):
                st.success("🔄 Follow-up question - used conversation context")
        else:
            st.write(message["content"])

# Chat input
if prompt := st.chat_input("Continue our conversation about maritime regulations..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    # Display user message
    with st.chat_message("user"):
        st.write(prompt)

    # Display assistant response
    with st.chat_message("assistant"):
        with st.spinner("Thinking and searching regulatory databases..."):
            # Search with conversation context
            search_results = search_with_context(prompt, st.session_state.messages[:-1])  # Exclude current user message
            
            # Generate conversational response
            result = generate_conversational_response(prompt, search_results, st.session_state.messages[:-1])
            
            # Debug: Check if we have an answer
            if result["answer"]:
                st.write(result["answer"])
            else:
                st.error("No response generated. Please try again.")
                st.write(f"Debug - Search results: {search_results.get('citations', 0)} sources found")
            
            # Store full result in session state
            st.session_state.messages.append({
                "role": "assistant", 
                "content": result["answer"],
                "context": result["context"],
                "citations": result["citations"],
                "citations_list": result.get("citations_list", []),
                "cfr_results": result.get("cfr_results", 0),
                "ref_results": result.get("ref_results", 0),
                "is_follow_up": result.get("is_follow_up", False)
            })

            # Show if it was a follow-up
            if result.get("is_follow_up"):
                st.success("🔄 Follow-up question - used conversation context")

# Auto-save current chat when messages are added
if st.session_state.messages:
    save_current_chat()