from fastapi import FastAPI
app = FastAPI(title="pensionlib-api")
@app.get("/")
async def root():
    return {"status": "ok"}
