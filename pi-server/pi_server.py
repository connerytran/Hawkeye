from fastapi import FastAPI
from fastapi import HTTPException
from PiCamera import PiCamera
import uvicorn


app = FastAPI()
Pi_Camera = PiCamera()


@app.get("/status")
async def get_status():

    capture_status = Pi_Camera.get_capture_status()
    return capture_status


@app.post("/start-capture")
async def start_capture():

    if Pi_Camera.is_capturing:
        raise HTTPException(status_code=400, detail="Capture already in progress")
    
    try:
        Pi_Camera.start_capture()
        return {"message": "Taking pictures now."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start capture: {str(e)}")
     



@app.post("/stop-capture")
async def stop_capture():

    if not Pi_Camera.is_capturing:
        raise HTTPException(status_code=400, detail="Capture already stopped")    

    try:
        Pi_Camera.stop_capture()
        return {"message": "Capture stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop capture: {str(e)}")




@app.post("/globus-transfer")
async def globus_transfer(foldername: str):

    if not _is_valid_foldername(foldername):
        raise HTTPException(status_code=400, detail="Folder name invalid")

    result = Pi_Camera.globus_transfer(foldername)
    return result



@app.get("/upload-status")
async def upload_status():

    upload_status = Pi_Camera.get_transfer_status()
    
    return upload_status


def _is_valid_foldername(name: str) -> bool:
    # Basic validation: non-empty, no path separators, reasonable length
    if not name or len(name) > 255 or '/' in name or '\\' in name \
        or ':' in name or '*' in name or '?' in name \
        or '"' in name or '<' in name or '>' in name or '|' in name \
        or name.endswith(' ') or name.endswith('.'):
        return False
    return True


if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=5000)
