
import asyncio

from fastapi import FastAPI
import requests
from pydantic import BaseModel
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from zeroconf import Zeroconf, ServiceBrowser, ServiceStateChange, IPVersion
import socket
import time
import ipaddress


app = FastAPI()

# Add CORS middleware. Allows for requests from different ports/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (dev only, not for production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PI_PORT = 5000
pi_hosts = ['localhost']



# A class that inherets pydantic BaseModel, automatically structures API requests
class PiRequest(BaseModel):
    pis: list[str]

class GlobusRequest(BaseModel):
    pis: list[str]
    foldername: str



@app.post('/capture-status')
async def capture_status(request: PiRequest):
    """
    TODO
    """
    pis = request.pis
    if pis is None:
        pis = pi_hosts
    results = {}
    status = None

    for pi in pis: 
        url = f"http://{pi}:{PI_PORT}/capture-status"
        
        try:
            #The requests.get() function sends an HTTP GET request
            response = requests.get(url, timeout=3) # Set a 5-second timeout

            # Check for a successful HTTP status code 
            if response.status_code == 200:
                results[pi] = response.json() 
                status = 'success'
            else:
                # Handle non-200 status codes (e.g., 500 server error) PI DOES RESPOND
                results[pi] = {'error' : response.json()}
                status = 'Pi Response: error'

        except Exception as e:
            # Handle network errors (Pi is off, wrong IP, etc.) PI DOESN'T RESPOND
            results[pi] = {"error": str(e)}
            status = 'Error: pi did not respond'

    return {
        'status' : status,
       'results' : results
    }





@app.post('/start-capture')
async def start_capture(request: PiRequest):
    """
    TODO
    """
    pis = request.pis 
    results = {}
    status = None

    for pi in pis: 
        url = f"http://{pi}:{PI_PORT}/start-capture"
        
        try:
            #The requests.post() function sends an HTTP POST request
            response = requests.post(url, timeout=3) # Set a 5-second timeout

            # Check for a successful HTTP status code 
            if response.status_code == 200:
                results[pi] = response.json() 
                status = 'success'

            else:
                # Handle non-200 status codes (e.g., 500 server error)
                results[pi] = {'error' : response.json()}
                status = 'Pi Response: error'

        except Exception as e:
            # Handle network errors (Pi is off, wrong IP, etc.)
            results[pi] = {"error": str(e)}
            status = 'Error: pi did not respond'

    return {
        'status' : status,
        'results' : results
    }



@app.post('/stop-capture')
async def stop_capture(request: PiRequest):
    """
    TODO
    """
    pis = request.pis 
    results = {}
    status = None

    for pi in pis: 
        url = f"http://{pi}:{PI_PORT}/stop-capture"
        
        try:
            #The requests.post() function sends an HTTP POST request
            response = requests.post(url, timeout=3) 

            # Check for a successful HTTP status code 
            if response.status_code == 200:
                results[pi] = response.json() 
                status = 'success'

            else:
                # Handle non-200 status codes (e.g., 500 server error)
                results[pi] = {'error' : response.json()}
                status = 'Pi Response: error'

        except Exception as e:
            # Handle network errors (Pi is off, wrong IP, etc.)
            results[pi] = {"error": str(e)}
            status = 'Error: pi did not respond'

    return {
        'status' : status,
        'results' : results
    }


@app.delete('/delete-photos')
async def delete_photos(request: PiRequest):
    """
    TODO
    """
    pis = request.pis
    if pis is None:
        pis = pi_hosts
    results = {}
    status = None

    for pi in pis: 
        url = f"http://{pi}:{PI_PORT}/delete-photos"
        
        try:
            #The requests.get() function sends an HTTP GET request
            response = requests.delete(url, timeout=3) # Set a 5-second timeout

            # Check for a successful HTTP status code 
            if response.status_code == 200:
                results[pi] = response.json() 
                status = 'success'
            else:
                # Handle non-200 status codes (e.g., 500 server error) PI DOES RESPOND
                results[pi] = {'error' : response.json()}
                status = 'Pi Response: error'

        except Exception as e:
            # Handle network errors (Pi is off, wrong IP, etc.) PI DOESN'T RESPOND
            results[pi] = {"error": str(e)}
            status = 'Error: pi did not respond'

    return {
        'status' : status,
       'results' : results
    }



@app.post('/globus-transfer')
async def globus_transfer(request: GlobusRequest):
    """
    TODO
    """
    pis = request.pis 
    results = {}
    foldername = request.foldername
    status = None

    for pi in pis: 
        url = f"http://{pi}:{PI_PORT}/globus-transfer"
        
        try:
            #The requests.post() function sends an HTTP POST request
            response = requests.post(url, json={'foldername': foldername}, timeout=3) 

            # Check for a successful HTTP status code 
            if response.status_code == 200:
                results[pi] = response.json() 
                status = 'success'

            else:
                # Handle non-200 status codes (e.g., 500 server error)
                results[pi] = {'error' : response.json()}
                status = 'Pi Response: error'

        except Exception as e:
            # Handle network errors (Pi is off, wrong IP, etc.)
            results[pi] = {"error": str(e)}
            status = 'Error: pi did not respond'

    return {
        'status' : status,
        'results' : results
    }



@app.post('/transfer-status')
async def transfer_status(request: PiRequest):
    """
    TODO
    """
    pis = request.pis
    if pis is None:
        pis = pi_hosts
    results = {}
    status = None

    for pi in pis: 
        url = f"http://{pi}:{PI_PORT}/transfer-status"
        
        try:
            #The requests.get() function sends an HTTP GET request
            response = requests.get(url, timeout=3) # Set a 5-second timeout

            # Check for a successful HTTP status code 
            if response.status_code == 200:
                results[pi] = response.json() 
                status = 'success'
            else:
                # Handle non-200 status codes (e.g., 500 server error) PI DOES RESPOND
                results[pi] = {'error' : response.json()}
                status = 'Pi Response: error'

        except Exception as e:
            # Handle network errors (Pi is off, wrong IP, etc.) PI DOESN'T RESPOND
            results[pi] = {"error": str(e)}
            status = 'Error: pi did not respond'

    return {
        'status' : status,
       'results' : results
    }

def _get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    finally:
        s.close()


@app.get('/discover-pis')
async def discover_pis():
    discovered_pis = []


    def on_service_state_change(zeroconf, service_type, name, state_change, **kwargs):
        if state_change == ServiceStateChange.Added:
            info = zeroconf.get_service_info(service_type, name)
            if info:
                ip_address = socket.inet_ntoa(info.addresses[0])
                discovered_pis.append(
                    {'hostname': name, 
                     'ip': ip_address,
                     'port': info.port}
                )


    local_ip = _get_local_ip()            
    zc = Zeroconf(ip_version=IPVersion.V4Only, interfaces=[local_ip])         # socket that does the listening for the service discovery
    browser = ServiceBrowser(zc, "_hawkeye._tcp.local.", handlers=[on_service_state_change])    # ServiceBrowser listens for services of type "_hawkeye._tcp.local." and calls the handler function when a service is added
    print(f"Discovered: {discovered_pis}")

    await asyncio.sleep(3)
    zc.close()
                
    return {'pis': discovered_pis}


if __name__ == "__main__":
    uvicorn.run(app, host='0.0.0.0', port=8000)