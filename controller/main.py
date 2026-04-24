import asyncio
import httpx
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from zeroconf import Zeroconf, ServiceBrowser, ServiceStateChange, IPVersion
import socket


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

# A class that inherits pydantic BaseModel, automatically structures API requests
class PiRequest(BaseModel):
    pis: list[str]

class GlobusRequest(BaseModel):
    pis: list[str]
    foldername: str


async def _pi_request(method: str, pi: str, path: str, **kwargs) -> tuple[str, dict, str]:
    """Shared helper. Fires one async HTTP request to a single Pi.
    Returns (hostname, result, status) so each endpoint can preserve the original status field.
    All endpoints use asyncio.gather() to call this in parallel across all Pis."""
    url = f"http://{pi}:{PI_PORT}{path}"
    try:
        async with httpx.AsyncClient() as client:
            response = await getattr(client, method)(url, **kwargs)
            # Check for a successful HTTP status code
            if response.status_code == 200:
                return pi, response.json(), 'success'
            else:
                # Handle non-200 status codes (e.g., 500 server error) PI DOES RESPOND
                return pi, {'error': response.json()}, 'Pi Response: error'
    except Exception as e:
        error_msg = str(e) if str(e) else type(e).__name__
        return pi, {"error": error_msg}, 'Error: pi did not respond'


def _compile(responses: list[tuple[str, dict, str]]) -> dict:
    """Converts list of (hostname, result, status) tuples into the
    {status, results} shape the frontend expects. Status reflects the last response,
    matching the original sequential behavior."""
    results = {}
    status = None
    for pi, result, s in responses:
        results[pi] = result
        status = s
    return {'status': status, 'results': results}


def _get_local_ip() -> str:
    """Returns the laptop's outbound IPv4 address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    finally:
        s.close()


@app.post('/capture-status')
async def capture_status(request: PiRequest):
    # Fire all Pi requests in parallel using asyncio.gather()
    responses = await asyncio.gather(*[_pi_request('get', pi, '/capture-status', timeout=3) for pi in request.pis])
    return _compile(responses)


@app.post('/start-capture')
async def start_capture(request: PiRequest):
    # Fire all Pi requests in parallel using asyncio.gather()
    responses = await asyncio.gather(*[_pi_request('post', pi, '/start-capture', timeout=3) for pi in request.pis])
    return _compile(responses)


@app.post('/stop-capture')
async def stop_capture(request: PiRequest):
    # Fire all Pi requests in parallel using asyncio.gather()
    responses = await asyncio.gather(*[_pi_request('post', pi, '/stop-capture', timeout=3) for pi in request.pis])
    return _compile(responses)


@app.delete('/delete-photos')
async def delete_photos(request: PiRequest):
    # Fire all Pi requests in parallel using asyncio.gather()
    responses = await asyncio.gather(*[_pi_request('delete', pi, '/delete-photos', timeout=3) for pi in request.pis])
    return _compile(responses)


@app.post('/globus-transfer')
async def globus_transfer(request: GlobusRequest):
    # Fire all Pi requests in parallel using asyncio.gather()
    responses = await asyncio.gather(*[
        _pi_request('post', pi, '/globus-transfer', json={'foldername': request.foldername}, timeout=3)
        for pi in request.pis
    ])
    return _compile(responses)


@app.post('/transfer-status')
async def transfer_status(request: PiRequest):
    # Fire all Pi requests in parallel using asyncio.gather()
    responses = await asyncio.gather(*[_pi_request('get', pi, '/transfer-status', timeout=3) for pi in request.pis])
    return _compile(responses)


@app.get('/discover-pis')
async def discover_pis():
    discovered_pis = []

    def on_service_state_change(zeroconf, service_type, name, state_change, **kwargs):
        if state_change == ServiceStateChange.Added:
            info = zeroconf.get_service_info(service_type, name)
            if info:
                ip_address = socket.inet_ntoa(info.addresses[0])
                discovered_pis.append({
                    'hostname': name,
                    'ip': ip_address,
                    'port': info.port
                })

    local_ip = _get_local_ip()
    zc = Zeroconf(ip_version=IPVersion.V4Only, interfaces=[local_ip])  # socket that does the listening for the service discovery
    browser = ServiceBrowser(zc, "_hawkeye._tcp.local.", handlers=[on_service_state_change])  # ServiceBrowser listens for services of type "_hawkeye._tcp.local." and calls the handler when a service is added

    await asyncio.sleep(3)
    zc.close()

    return {'pis': discovered_pis}


if __name__ == "__main__":
    uvicorn.run(app, host='0.0.0.0', port=8000)