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
    Tracks the current state of image capture on this Pi.

    Attributes:
        is_capturing (bool): True if a capture session is currently running.
        start_time (datetime | None): Timestamp of when the current capture session started,
            or None if no session has been started.
    """

    def __init__(self):
        self.is_capturing = False
        self.start_time = None


    def start_capture(self):
        """Sets is_capturing to True and records the current time as start_time."""
        self.is_capturing = True
        self.start_time = datetime.now()

    def stop_capture(self):
        """Sets is_capturing to False. Does not clear start_time."""
        self.is_capturing = False

    def get_status(self):
        """
        Returns the current capture state as a dict.

        Returns:
            dict: {
                "is_capturing" (bool): Whether capture is active.
                "start_time" (str | None): ISO 8601 timestamp of session start, or None.
            }
        """

        return {
            "is_capturing" : self.is_capturing, 
            "start_time" : self.start_time.isoformat() if self.start_time else None
            }

class UploadState:
    """
    Tracks the state of a Globus file transfer job on this Pi.

    Attributes:
        upload_status (str): Current transfer state. One of: 'idle', 'uploading', 'success', 'failed'.
        job_id (str | None): UUID assigned to the most recent transfer job, or None if no job has run.
        error_string (str | None): Error message from the most recent failed job, or None.
    """

    def __init__(self):
        self.upload_status = 'idle' # or uploading, success, failed
        self.job_id = None
        self.error_string = None


    def start_job(self, job_id):
        """
        Marks a new transfer job as in-progress.

        Args:
            job_id (str): UUID string identifying this transfer job.
        """
        self.upload_status = 'uploading'
        self.job_id = job_id

    def complete_job(self, success, error_message=None):
        """
        Marks the current transfer job as finished.

        Args:
            success (bool): True sets status to 'success', False sets it to 'failed'.
            error_message (str | None): Optional error details if the job failed.
        """
        self.upload_status = 'success' if success else 'failed'
        self.error_string = error_message

    def get_status(self):
        """
        Returns the current upload state as a dict.

        Returns:
            dict: {
                "upload_status" (str): 'idle', 'uploading', 'success', or 'failed'.
                "job_id" (str | None): UUID of the most recent job, or None.
                "error_string" (str | None): Error message if last job failed, else None.
            }
        """

        return {
            "upload_status": self.upload_status, 
            "job_id": self.job_id,
            "error_string": self.error_string
            }


# Pydantic validates and parses data automatically. Here we specify that we want a foldername field that must be a str
class GlobusTransferRequest(BaseModel):
    """
    Request body for the /globus-transfer endpoint.

    Attributes:
        foldername (str): Name of the local folder on the Pi to transfer via Globus.
            Passed as a CLI argument to globus_transfer.py.
    """
    foldername: str



# ===== STATE INSTANCES =====
capture_state = CaptureState()
upload_state = UploadState()




@app.get("/status")
async def get_status():
    """
    Returns the current capture status of this Pi.

    Returns:
        200 dict: {
            "is_capturing" (bool): Whether a capture session is currently running.
            "start_time" (str | None): ISO 8601 timestamp of when capture started, or None.
        }
    """

    is_capturing, start_time = capture_state.get_status().values()

    return {
        "is_capturing": is_capturing,
        "start_time": start_time
    }


@app.post("/start-capture")
async def start_capture():
    """
    Starts image capture by launching usb_cam.py as a background subprocess.

    Returns:
        200 dict: {"message": "Taking pictures now."}
    Raises:
        400: If capture is already in progress.
        500: If the subprocess fails to launch.
    """
    if capture_state.is_capturing:
        raise HTTPException(status_code=400, detail="Capture already in progress")
        
    try:
        subprocess.Popen([venv_python, 'usb_cam.py'], cwd=src_dir_path)
        capture_state.start_capture()
        return {"message": "Taking pictures now."}
    except Exception as e:
        capture_state.stop_capture()  # Reset state if it fails
        raise HTTPException(status_code=500, detail=f"Failed to start capture: {str(e)}")
     



@app.post("/stop-capture")
async def stop_capture():
    """
    Stops an active capture session by running stop_sig.py as a blocking subprocess.

    Returns:
        200 dict: {"message": "Capture stopped."}
    Raises:
        400: If no capture is currently in progress.
        500: If the stop script fails to run.
    """
    if not capture_state.is_capturing:
        raise HTTPException(status_code=400, detail="Capture already stopped")    

    try:
        subprocess.run([venv_python, 'stop_sig.py'], cwd=src_dir_path)
        capture_state.stop_capture()
        return {"message": "Capture stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop capture: {str(e)}")




@app.post("/globus-transfer")
async def globus_transfer(request: GlobusTransferRequest):
    """
    Starts a Globus file transfer by launching globus_transfer.py as a background subprocess.

    Args (request body):
        foldername (str): Name of the local folder on the Pi to transfer.

    Returns:
        200 dict: {
            "message": "Transfer started.",
            "job_id" (str): UUID assigned to this transfer job.
        }
    Raises:
        400: If a transfer is already in progress.
        500: If the subprocess fails to launch.

    Note:
        The transfer runs asynchronously. Poll /upload-status to check progress.
    """

    if upload_state.upload_status == 'uploading':
        raise HTTPException(status_code=400, detail='Upload already in progress.')
    
    job_id = str(uuid.uuid4())
    upload_state.start_job(job_id)

    try:
        pOpen = subprocess.Popen([venv_python, 'globus_transfer.py', request.foldername], cwd=src_dir_path,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE) # Eventually should store result for debugging
        return {'message': pOpen.stdout, 'job_id' : job_id} # problem, I don't really know when the job is done or not. I have to check globus for that
    except Exception as e:
        upload_state.complete_job(success=False, error_message=str(e))
        raise HTTPException(status_code=500, detail='Failed to start transfer.')




@app.get("/upload-status")
async def upload_status():
    """
    Returns the current Globus transfer status.

    Returns:
        200 dict: {
            "upload_status" (str): 'idle', 'uploading', 'success', or 'failed'.
            "job_id" (str | None): UUID of the most recent transfer job, or None.
            "error_string" (str | None): Error message if last job failed, else None.
            "timestamp" (str): ISO 8601 timestamp of when this status was queried.
        }
    """

    status = upload_state.get_status().values()

    return {
        **status,
        'timestamp' : datetime.now().isoformat()
    }



if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=5000)
