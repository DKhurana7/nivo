FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libsndfile1 && rm -rf /var/lib/apt/lists/*
COPY agent/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY agent ./agent
RUN useradd --create-home worker && mkdir -p /app/data /app/models && chown -R worker:worker /app
USER worker
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "agent.worker", "start"]
