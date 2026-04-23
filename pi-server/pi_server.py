from fastapi import FastAPI
from fastapi import HTTPException
from PiCamera import PiCamera
from pydantic import BaseModel
from utils.validators import _is_valid_foldername
import uvicorn
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceInfo, IPVersion
from contextlib import asynccontextmanager
import socket
import os


## Using Zeroconf to broadcase the tcp service to be picked up via mDNS
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    zc = AsyncZeroconf(ip_version=IPVersion.V4Only)
    hostname = socket.gethostname()
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('8.8.8.8', 80))
    local_ip = s.getsockname()[0]
    s.close()
    
    info = AsyncServiceInfo(
        "_hawkeye._tcp.local.",
        f"{hostname}._hawkeye._tcp.local.",
        addresses=[socket.inet_aton(local_ip)],
        port=5000,
        properties={"pi_id": os.getenv("PI_ID", hostname)},
        server=f"{hostname}.local.",
    )
    await zc.async_register_service(info)
    
    yield  # server runs here
    
    # --- SHUTDOWN ---
    await zc.async_unregister_service(info)
    await zc.async_close()


app = FastAPI(lifespan=lifespan)
Pi_Camera = PiCamera()


class GlobusRequest(BaseModel):
    foldername: str


@app.get("/capture-status")
async def get_status():

    capture_status = Pi_Camera.get_capture_status()
    return capture_status


@app.post("/start-capture")
async def start_capture():

    if Pi_Camera.capture_thread is not None and Pi_Camera.capture_thread.is_alive():
        raise HTTPException(status_code=400, detail="Capture already in progress")
    
    try:
        Pi_Camera.start_capture()
        return {"message": "Attempted capture script."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start capture: {str(e)}")
     



@app.post("/stop-capture")
async def stop_capture():

    if Pi_Camera.capture_thread is None or not Pi_Camera.capture_thread.is_alive():
        raise HTTPException(status_code=400, detail="Capture already stopped")    

    try:
        Pi_Camera.stop_capture()
        return {"message": "Capture stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop capture: {str(e)}")



@app.delete("/delete-photos")
async def delete_photos():
    message = Pi_Camera.delete_photos()
    return message


@app.post("/globus-transfer")
async def globus_transfer(request: GlobusRequest):
    foldername = request.foldername
    if not _is_valid_foldername(foldername):
        raise HTTPException(status_code=400, detail="Folder name invalid")

    result = Pi_Camera.globus_transfer(foldername)
    return result



@app.get("/transfer-status")
async def transfer_status():
    transfer_status = Pi_Camera.get_transfer_status()
    return transfer_status




if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=5000)
