# MIAgent Streamlit Cloud Deployment Guide

This guide walks you through deploying MIAgent to Streamlit Cloud.

## Prerequisites

1. **GitHub Repository**: Your MIAgent code (✅ Already done!)
2. **Streamlit Cloud Account**: Sign up at [share.streamlit.io](https://share.streamlit.io)
3. **Qdrant Cloud Database**: Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
4. **OpenAI API Key**: From [platform.openai.com](https://platform.openai.com)

## Step 1: Set Up Qdrant Cloud

### Create Qdrant Cloud Cluster
1. Go to [cloud.qdrant.io](https://cloud.qdrant.io)
2. Sign up and create a new cluster
3. Choose **Free Tier** (1GB storage, perfect for testing)
4. Note down:
   - **Cluster URL** (e.g., `https://xyz.us-east4-0.gcp.cloud.qdrant.io:6333`)
   - **API Key** (from cluster settings)

### Upload Your Data to Qdrant Cloud
You'll need to run your embedding scripts locally first, but pointing to the cloud instance:

```python
# Modify embed_46cfr.py and embed_references.py to use cloud Qdrant
from qdrant_client import QdrantClient

qdrant = QdrantClient(
    host="your-cluster-url",
    api_key="your-api-key"
)
```

## Step 2: Deploy to Streamlit Cloud

### Create Streamlit Cloud App
1. Go to [share.streamlit.io](https://share.streamlit.io)
2. Sign in with GitHub
3. Click **"New app"**
4. Configure:
   - **Repository**: `DevinGreenwell/MIAgent`
   - **Branch**: `main`
   - **Main file path**: `chat_app.py`
   - **App URL**: Choose your preferred subdomain

### Add Secrets
In the Streamlit Cloud dashboard:

1. Go to **App settings** → **Secrets**
2. Add the following secrets:

```toml
OPENAI_API_KEY = "sk-your-openai-api-key"
QDRANT_HOST = "your-qdrant-cluster-url"
QDRANT_API_KEY = "your-qdrant-api-key"
```

### Deploy
Click **"Deploy!"** - Streamlit will automatically build and deploy your app.

## Step 3: Data Migration Options

### Option A: Local Upload (Recommended)
1. Set up Qdrant Cloud credentials in your local environment
2. Run embedding scripts to populate cloud database:
```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export QDRANT_HOST="your-cluster-url"
export QDRANT_API_KEY="your-api-key"

# Run embedding scripts (modify them to use cloud config)
python embed_46cfr.py
python embed_references.py
```

### Option B: Cloud Processing
Upload your data files to Streamlit Cloud and process them there (requires modifying scripts to handle cloud file storage).

## Step 4: Testing

1. Visit your deployed app URL
2. Test basic chat functionality
3. Verify citations are working
4. Check that both CFR and reference documents are searchable

## Troubleshooting

### Common Issues

**"Cannot connect to Qdrant"**
- Verify cluster URL and API key in secrets
- Ensure cluster is running (not paused)

**"OpenAI API key not found"**
- Check secrets are properly set in Streamlit Cloud
- Verify API key is valid and has credits

**"No search results"**
- Confirm data was uploaded to cloud Qdrant
- Check collection names match (`46_cfr_chunks`, `reference_documents`)

**App keeps restarting**
- Check logs in Streamlit Cloud dashboard
- Look for Python dependency issues

## Cost Considerations

- **Streamlit Cloud**: Free for public repos
- **Qdrant Cloud**: Free tier (1GB) → $25/month for more storage
- **OpenAI API**: Pay per usage (typically $5-20/month for moderate use)

## Performance Tips

1. **Caching**: App uses `@st.cache_resource` for database connections
2. **Resource Limits**: Streamlit Cloud has memory/CPU limits
3. **Cold Starts**: First request may be slower after inactivity

## Security Notes

- API keys are stored securely in Streamlit secrets
- Database credentials are encrypted
- No sensitive data in repository (handled by .gitignore)

## Next Steps

After deployment, consider:
- Custom domain setup
- Usage analytics
- Performance monitoring
- Scaling to larger Qdrant instance if needed