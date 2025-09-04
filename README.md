# MIAgent - Maritime Regulatory Assistant

A conversational AI assistant for maritime regulations, providing detailed information about CFR Title 46 (Shipping regulations) and related reference documents including ABS standards, Marine Safety Manual, SOLAS, and NVIC guidelines.

## Features

- **Conversational Interface**: Natural chat-based interactions with maritime regulatory expert
- **Comprehensive Database**: Searches both CFR Title 46 and reference documents
- **Detailed Citations**: Provides precise regulatory citations (e.g., "46 CFR §117.78")
- **Chat History**: Maintains conversation history across sessions
- **Follow-up Context**: Understands follow-up questions and maintains conversation context
- **Multi-Source Search**: Integrates CFR regulations with industry standards and guidelines

## Architecture

- **Frontend**: Streamlit web application
- **AI Model**: GPT-5 Mini with GPT-4 fallback
- **Vector Database**: Qdrant for semantic search
- **Embeddings**: OpenAI text-embedding-3-small
- **Document Sources**: 
  - CFR Title 46 (14,156+ chunks)
  - Reference documents (12,809+ chunks)

## Local Setup

### Prerequisites

- Python 3.8+
- OpenAI API key
- Qdrant (can run locally via Docker)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/DevinGreenwell/MIAgent.git
cd MIAgent
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up Qdrant (using Docker):
```bash
docker run -p 6333:6333 qdrant/qdrant
```

5. Add your OpenAI API key:
```bash
echo "your-api-key-here" > API.txt
```

6. Process and embed documents (if you have the source documents):
```bash
# Process reference documents
python process_references.py

# Embed reference documents
python embed_references.py

# CFR documents should be processed similarly
python embed_46cfr.py
```

7. Run the application:
```bash
streamlit run chat_app.py
```

## Usage

1. Open your browser to `http://localhost:8501`
2. Start chatting about maritime regulations
3. Ask follow-up questions for deeper exploration
4. Use the sidebar to manage chat history

### Example Questions

- "What are the requirements for life jackets on recreational boats?"
- "What ABS standards apply to hull construction?"
- "What SOLAS requirements apply to passenger ships?"
- "What about commercial vessels?" (follow-up question)

## Document Sources

- **CFR Title 46**: Official U.S. shipping regulations
- **ABS Standards**: American Bureau of Shipping standards
- **Marine Safety Manual (MSM)**: Coast Guard safety manual
- **SOLAS**: Safety of Life at Sea international standards
- **NVIC**: Navigation and Vessel Inspection Circulars
- **Coast Guard Policy Letters**: Regulatory guidance

## Technical Details

### Database Collections
- `46_cfr_chunks`: CFR Title 46 document chunks
- `reference_documents`: Additional maritime reference documents

### Key Components
- `chat_app.py`: Main Streamlit application with conversational interface
- `app.py`: Basic Q&A interface (legacy)
- `process_references.py`: PDF processing and text extraction
- `embed_references.py`: Document embedding into vector database

### Features
- **Conversational Memory**: Maintains context across exchanges
- **Follow-up Detection**: Automatically detects and handles follow-up questions
- **Multi-Model Fallback**: GPT-5 Mini with GPT-4 backup for reliability
- **Citation Enhancement**: Provides detailed, actionable regulatory citations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational and research purposes. Maritime regulations and standards are public domain, but please verify all regulatory information with official sources.

## Disclaimer

This tool provides information from maritime regulations and standards for reference purposes only. Always consult official regulatory sources and qualified maritime professionals for compliance and safety decisions.