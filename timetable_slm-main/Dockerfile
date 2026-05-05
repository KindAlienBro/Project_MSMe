FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Expose both ports (7860 = FastAPI/public, 8501 = Streamlit/internal)
EXPOSE 7860
EXPOSE 8501

# Start FastAPI on 7860 (public) + Streamlit on 8501 (internal/background)
CMD streamlit run app.py --server.port 8501 --server.address 0.0.0.0 & \
    uvicorn api:app --host 0.0.0.0 --port 7860
