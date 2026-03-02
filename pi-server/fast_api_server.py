from fastapi import FastAPI
from fastapi import HTTPException
from datetime import datetime
from pydantic import BaseModel
import uuid
import subprocess
import uvicorn


app = FastAPI()


src_dir_path = "/home/tomato-imager/TomatoImager/src/"
venv_python = "/home/tomato-imager/TomatoImager/venv/bin/python"


class CaptureState:
    """
    """

    def __init__(self):
        self.is_capturing = False
        self.start_time = None


    def start_capture(self):
        self.is_capturing = True
        self.start_time = datetime.now()

    def stop_capture(self):
        self.is_capturing = False

    def get_status(self):

        return {
            "is_capturing" : self.is_capturing, 
            "start_time" : self.start_time.isoformat() if self.start_time else None
            }

class UploadState:

    def __init__(self):
        self.upload_status = 'idle' # or uploading, success, failed
        self.job_id = None
        self.error_string = None


    def start_job(self, job_id):
        self.upload_status = 'uploading'
        self.job_id = job_id

    def complete_job(self, success, error_message=None):
        self.upload_status = 'success' if success else 'failed'
        self.error_string = error_message

    def get_status(self):

        return {
            "upload_status": self.upload_status, 
            "job_id": self.job_id,
            "error_string": self.error_string
            }


# Pydantic validates and parses data automatically. Here we specify that we want a foldername field that must be a str 
class GlobusTransferRequest(BaseModel):
    foldername: str



# ===== STATE INSTANCES =====
capture_state = CaptureState()
upload_state = UploadState()




# -------- returns status of capture ---------
@app.get("/status")
async def get_status():

    is_capturing, start_time = capture_state.get_status().values()

    return {
        "is_capturing": is_capturing,
        "start_time": start_time
    }


# ------- Takes pictures ---------------
@app.post("/start-capture")
async def start_capture():
    if capture_state.is_capturing:
        raise HTTPException(status_code=400, detail="Capture already in progress")
        
    try:
        subprocess.Popen([venv_python, 'usb_cam.py'], cwd=src_dir_path)
        capture_state.start_capture()
        return {"message": "Taking pictures now."}
    except Exception as e:
        capture_state.stop_capture()  # Reset state if it fails
        raise HTTPException(status_code=500, detail=f"Failed to start capture: {str(e)}")
     



# ---------- Stops pictures -----------
@app.post("/stop-capture")
async def stop_capture():
    if not capture_state.is_capturing:
        raise HTTPException(status_code=400, detail="Capture already stopped")    

    try:
        subprocess.run([venv_python, 'stop_sig.py'], cwd=src_dir_path)
        capture_state.stop_capture()
        return {"message": "Capture stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop capture: {str(e)}")




# ------------ Globus Transfer ----------
@app.post("/globus-transfer")
async def globus_transfer(request: GlobusTransferRequest):

    if upload_state.upload_status == 'uploading':
        raise HTTPException(status_code=400, detail='Upload already in progress.')
    
    job_id = str(uuid.uuid4())
    upload_state.start_job(job_id)

    try:
        subprocess.Popen([venv_python, 'globus_transfer.py', request.foldername], cwd=src_dir_path) # Eventually should store result for debugging
        return {'message': 'Transfer started.', 'job_id' : job_id} # problem, I don't really know when the job is done or not. I have to check globus for that
    except Exception as e:
        upload_state.complete_job(success=False, error_message=str(e))
        raise HTTPException(status_code=500, detail='Failed to start transfer.')




# ------------ Globus Transfer ----------
@app.get("/upload-status")
async def upload_status():

    status = upload_state.get_status().values()

    return {
        **status,
        'timestamp' : datetime.now().isoformat()
    }



if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=5000)
