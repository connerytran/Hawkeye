

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY pi-requirements.txt .
RUN pip install --no-cache-dir -r pi-requirements.txt
COPY . .
EXPOSE 5000 
CMD ["python", "pi_server.py"]