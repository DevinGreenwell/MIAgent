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
            st.error("OpenAI API key not found. Please add OPENAI_API_KEY to Streamlit secrets or create API.txt file.")
            st.stop()

openai.api_key = os.environ["OPENAI_API_KEY"]

# Initialize Qdrant client
@st.cache_resource
def init_qdrant():
    try:
        # Try cloud configuration from Streamlit secrets
        if "QDRANT_HOST" in st.secrets:
            qdrant_host = st.secrets["QDRANT_HOST"]
            qdrant_api_key = st.secrets.get("QDRANT_API_KEY", None)
            
            # Parse URL to handle different formats
            if qdrant_host.startswith("https://"):
                # For cloud URLs like https://cluster.region.cloud.qdrant.io
                return QdrantClient(
                    url=qdrant_host,
                    api_key=qdrant_api_key,
                    timeout=30.0
                )
            else:
                # For host:port format
                return QdrantClient(
                    host=qdrant_host,
                    port=6333,
                    api_key=qdrant_api_key,
                    timeout=30.0
                )
                
        elif "qdrant" in st.secrets:
            return QdrantClient(
                host=st.secrets["qdrant"]["host"],
                port=st.secrets["qdrant"].get("port", 6333),
                api_key=st.secrets["qdrant"].get("api_key", None),
                timeout=30.0
            )
    except Exception as cloud_error:
        st.warning(f"Cloud Qdrant connection failed: {cloud_error}")
    
    # Fallback to localhost (for local development)
    try:
        return QdrantClient(host="localhost", port=6333, timeout=10.0)
    except Exception as local_error:
        st.error(f"Cannot connect to any Qdrant database.")
        st.error(f"Cloud error: {cloud_error if 'cloud_error' in locals() else 'No cloud config'}")
        st.error(f"Local error: {local_error}")
        st.info("For local development: Start Qdrant with `docker run -p 6333:6333 qdrant/qdrant`")
        st.info("For cloud deployment: Add Qdrant Cloud credentials to Streamlit secrets")
        st.info("Required secrets: QDRANT_HOST and QDRANT_API_KEY")
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
                "content": f"""You are an experienced Officer-in-Charge of Marine Inspection (OCMI) providing regulatory guidance to a Marine Inspector in the field. Your role is to support inspection activities with authoritative regulatory interpretation and practical guidance.

RESPONSE STYLE:
- Be CONCISE and FIELD-READY - inspectors need quick, actionable answers
- Lead with the direct answer, then provide essential details only
- Keep responses under 150 words unless specifically asked for more detail
- Focus on what the inspector needs to know RIGHT NOW for their inspection

{f"VESSEL FOCUS: The inspector is currently working with {st.session_state.vessel_context['type']} ({st.session_state.vessel_context['category']}). Tailor your regulatory guidance specifically to this vessel type and applicable subchapter requirements." if st.session_state.vessel_context['type'] else ""}

REGULATORY APPROACH:
- Give the specific requirement or answer first
- Mention key inspection points or common deficiencies if relevant
- Note critical compliance evidence to look for
- End with precise regulatory citations

RESPONSE FORMAT:
1. Direct answer (1-2 sentences)
2. Key inspection guidance (if applicable)
3. Sources: [List specific CFR sections, SOLAS chapters, etc.]

Remember: Inspectors can always ask for more detail. Keep it streamlined for field use."""
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

# Add MIAgent title at the very top of the sidebar
with st.sidebar:
    st.title("MIAgent")

# Custom CSS for reduced padding and mobile optimization
st.markdown("""
<style>
    /* Reduced padding for header and main container */
    .block-container {
        padding-top: 0.5rem;
        padding-bottom: 0rem;
        padding-left: 2rem;
        padding-right: 2rem;
    }
    
    /* Hide unwanted elements */
    .element-container:has(iframe[height="0"]) {
        display: none;
    }
    div[data-testid="metric-container"] {
        display: none;
    }
    
    /* Hide mobile title on desktop */
    .mobile-title {
        display: none;
        margin: 0;
        padding: 0;
    }
    
    /* Mobile optimization */
    @media (max-width: 768px) {
        .block-container {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            padding-top: 2rem;
        }
        
        /* Make sidebar collapsible on mobile */
        section[data-testid="stSidebar"] {
            width: 280px;
        }
        
        /* Ensure header doesn't cut off content on mobile */
        header[data-testid="stHeader"] {
            height: 0px !important;
            min-height: 0px !important;
        }
        
        /* Prevent viewport cutoff */
        .main .block-container {
            max-width: none !important;
        }
        
        /* Show mobile title in main area */
        .mobile-title {
            display: block !important;
            margin-top: 1rem !important;
            margin-bottom: 1rem !important;
            padding-top: 1rem !important;
            padding-bottom: 0.5rem !important;
            font-size: 2rem !important;
            font-weight: 600 !important;
            text-align: center;
            line-height: 1.2 !important;
            position: relative !important;
            z-index: 1000 !important;
        }
        
        /* Hide desktop-only elements on mobile */
        .desktop-only {
            display: none !important;
        }
        
        /* Optimize column layout for mobile */
        .row-widget.stSelectbox > div {
            width: 100% !important;
        }
        
        /* Improve chat input on mobile */
        .stChatInput > div {
            width: 100% !important;
        }
        
        /* Better spacing for mobile chat */
        .stChatMessage {
            margin: 0.5rem 0;
        }
        
        /* Compact buttons on mobile */
        .stButton > button {
            width: 100%;
            padding: 0.25rem 0.5rem;
            font-size: 0.9rem;
        }
        
        /* Responsive text sizing */
        h1 {
            font-size: 1.5rem !important;
        }
        h2 {
            font-size: 1.25rem !important;
        }
        h3 {
            font-size: 1.1rem !important;
        }
    }
    
    /* Tablet optimization */
    @media (max-width: 1024px) and (min-width: 769px) {
        .block-container {
            padding-left: 1rem;
            padding-right: 1rem;
        }
    }
</style>
""", unsafe_allow_html=True)

# Mobile title - only shows on mobile devices
st.markdown('<h1 class="mobile-title">MIAgent</h1>', unsafe_allow_html=True)

st.caption("Select vessel type or system to receive targeted regulatory guidance")

# Create vessel type selector - responsive layout
# Use different column layouts for desktop vs mobile
col1, col2, col3 = st.columns([1, 2, 1])

with col1:
    vessel_category = st.selectbox(
        "Category",
        ["Select Category", "Domestic", "International", "System"]
    )

with col2:
    if vessel_category == "Domestic":
        vessel_type = st.selectbox(
            "Vessel Type",
            ["Select Vessel Type", 
             "Cargo Vessel (Subchapter I)",
             "Dangerous Cargo Vessel (Subchapter O)",
             "Offshore Supply Vessel (Subchapter L)", 
             "Passenger Vessel (Subchapter H)",
             "Small Passenger Vessel (Subchapter K)",
             "Small Passenger Vessel (Subchapter T)", 
             "Tank Vessel (Subchapter D)",
             "Towing Vessel (Subchapter M)"]
        )
    elif vessel_category == "International":
        vessel_type = st.selectbox(
            "Vessel Type",
            ["Select Vessel Type",
             "Foreign Chemical Vessel",
             "Foreign Freight Vessel", 
             "Foreign Passenger Vessel",
             "Foreign Tank Vessel"]
        )
    elif vessel_category == "System":
        vessel_type = st.selectbox(
            "System Type",
            ["Select System Type",
             "Electrical",
             "Engineering",
             "Fire Protection",
             "Lifesaving",
             "Manning",
             "Mechanical",
             "Navigation", 
             "Propulsion",
             "Stability"]
        )
    else:
        vessel_type = "Select Vessel Type"

with col3:
    if vessel_category != "Select Category" and vessel_type != "Select Vessel Type" and vessel_type != "Select System Type":
        st.success(f"{vessel_type}")
        
# Store selections in session state
if "vessel_context" not in st.session_state:
    st.session_state.vessel_context = {"category": "", "type": ""}
    
if vessel_category != "Select Category" and vessel_type not in ["Select Vessel Type", "Select System Type"]:
    st.session_state.vessel_context = {"category": vessel_category, "type": vessel_type}
else:
    st.session_state.vessel_context = {"category": "", "type": ""}

st.divider()

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

# Generate intelligent chat title based on conversation context
def generate_chat_title(messages):
    """Generate a concise, contextual title for the chat based on the conversation content."""
    try:
        # Get the first user message and assistant response if available
        user_messages = [msg["content"] for msg in messages if msg["role"] == "user"]
        if not user_messages:
            return "New Chat"
        
        # For longer conversations, use the first few exchanges for context
        context_messages = messages[:4] if len(messages) > 4 else messages
        
        # Create a prompt for title generation
        conversation_text = ""
        for msg in context_messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            content = msg["content"][:200] + "..." if len(msg["content"]) > 200 else msg["content"]
            conversation_text += f"{role}: {content}\n"
        
        # Generate title using OpenAI
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a title generator for maritime regulatory conversations. Create a short, descriptive title (3-7 words) that captures the main topic or question being discussed. Focus on maritime regulations, vessel requirements, safety standards, or inspection topics. Examples: 'Life Ring Requirements', 'Propeller Inspection Standards', 'Towing Vessel Regulations', 'Safety Equipment Guidelines'."
                },
                {
                    "role": "user", 
                    "content": f"Generate a short title for this maritime regulatory conversation:\n\n{conversation_text}"
                }
            ],
            max_tokens=20,
            temperature=0.3
        )
        
        title = response.choices[0].message.content.strip()
        # Remove quotes if present and ensure reasonable length
        title = title.strip('"').strip("'")
        return title[:60] if len(title) > 60 else title
        
    except Exception as e:
        # Fallback to truncated first message if AI fails
        first_message = user_messages[0] if user_messages else "New Chat"
        return first_message[:50] + "..." if len(first_message) > 50 else first_message

# Save current chat before switching
def save_current_chat():
    if st.session_state.messages:
        # Generate intelligent title based on conversation context
        title = generate_chat_title(st.session_state.messages)
        
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
    st.divider()
    
    st.header("Chats")
    
    # New Chat button
    if st.button("New Chat", use_container_width=True):
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
                        f"{chat_data['title']}", 
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
                
                st.caption(f"{chat_data['timestamp']}")
    else:
        st.info("No previous chats")

# Add conversation tips
if len(st.session_state.messages) == 0:
    with st.container():
        st.info("**OCMI Guidance Available:**\n"
                "- **Regulatory Questions**: 'What are the manning requirements for this vessel type?'\n"
                "- **Inspection Guidance**: 'What should I focus on during the safety equipment inspection?'\n"
                "- **Compliance Issues**: 'The vessel has X deficiency - what are the regulatory options?'")

# Chat interface
for i, message in enumerate(st.session_state.messages):
    with st.chat_message(message["role"]):
        if message["role"] == "assistant":
            st.write(message["content"])
            
            # Show if it was a follow-up
            if message.get("is_follow_up"):
                st.success("Follow-up question - used conversation context")
        else:
            st.write(message["content"])

# Chat input
if prompt := st.chat_input("Ask MIAgent a question..."):
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
                st.success("Follow-up question - used conversation context")

# Auto-save current chat when messages are added
if st.session_state.messages:
    save_current_chat()