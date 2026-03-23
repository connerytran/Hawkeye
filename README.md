# Hawkeye 🦅

**Precision Agriculture Imaging System** — NC State University, N.C. Plant Sciences Initiative

Hawkeye is a multi-device field imaging platform that deploys four Raspberry Pi cameras on a tractor boom to capture large volumes of georeferenced field images. Data is automatically transferred to NC State research storage via Globus, and the pipeline is designed for future AI-powered plant detection and counting using YOLOv8.

---

## Architecture

Hawkeye uses a three-tier architecture:

```
React Frontend (TomatoScan)
        ↓
FastAPI Controller (laptop)
        ↓
FastAPI Pi Servers (x4 Raspberry Pis)
```

- **Frontend** — React + Vite dashboard for controlling the Pi fleet, triggering captures, and monitoring transfer status
- **Controller** — FastAPI orchestration layer that broadcasts commands to selected Pis and aggregates results
- **Pi Servers** — FastAPI servers running on each Pi, managing cameras, GPS, and Globus transfers via a `PiCamera` class

---

## Features

### Camera Capture
- Captures images from up to 3 USB cameras simultaneously per Pi
- Camera capture runs in a dedicated background thread using `threading.Thread` and `threading.Event` for cooperative shutdown
- Camera failures surface immediately via thread health monitoring

### GPS + EXIF Metadata
- SparkFun Ultimate GPS Breakout v3 reads NMEA sentences over serial (`/dev/ttyAMA0`)
- `pynmeagps` parses GPRMC sentences in a daemon thread, continuously updating location
- GPS coordinates (lat/lon) converted to DMS rationals and embedded directly into JPEG EXIF data via `piexif`
- Photos are geotagged automatically — no post-processing required

### Globus Transfer
- Migrated from CLI subprocess calls to the Globus Python SDK (`globus_sdk`)
- `TransferClient` maintained as a persistent class attribute on `PiCamera`
- Recursive directory transfers with real-time status polling via Globus task IDs
- Transfer status endpoint exposes live Globus task data (bytes transferred, files, faults, etc.)

### PiCamera Class
- Single class owns all Pi state: capture thread, stop flag, GPS location dict, Globus client, and task ID
- FastAPI endpoints are thin wrappers that delegate to the class
- Clean separation of concerns — camera logic, GPS, and transfer logic are independent

### React Dashboard 
- Per-Pi unit cards with status badges, last response, and individual action buttons
- Bulk actions (Start Capture, Stop Capture, Globus Transfer) across selected Pis
- Folder name input for organizing Globus transfers
- Live log view showing all actions and responses
- Add/remove/rename Pi units dynamically

### Containerization & CI/CD
- Pi server and controller each have their own `Dockerfile` and `docker-compose.yml`
- GitHub Actions automatically builds and pushes Docker images to Docker Hub on merge to `main`
- Watchtower running on each Pi detects new images and automatically pulls and restarts containers
- Full automated deployment pipeline — push code, devices update themselves

---

## Project Structure

```
TomatoImager/
├── pi-server/              # FastAPI server for each Raspberry Pi
│   ├── PiCamera.py         # Core class managing capture, GPS, and transfers
│   ├── pi_server.py        # FastAPI endpoints
│   ├── cam_capture.py      # Camera capture logic
│   ├── gps_reader.py       # NMEA GPS reader
│   ├── Dockerfile
│   └── docker-compose.yml
├── controller/             # FastAPI orchestration layer (laptop)
│   ├── main.py             # FastAPI endpoints
│   ├── Dockerfile
│   └── docker-compose.yml
├── frontend/               # React + Vite dashboard
│   └── src/
│       ├── App.tsx
│       └── components/
└── .github/
    └── workflows/
        ├── deploy-pi.yml       # Builds and pushes Pi server image
        └── deploy-laptop.yml   # Builds and pushes controller image
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Controller | Python, FastAPI, uvicorn |
| Pi Server | Python, FastAPI, OpenCV, piexif, pynmeagps, pyserial |
| Transfer | Globus SDK |
| Containerization | Docker, Docker Compose |
| CI/CD | GitHub Actions, Docker Hub, Watchtower |
| Hardware | Raspberry Pi 4, SparkFun Ultimate GPS Breakout v3, USB cameras |

---

## Getting Started

### Pi Server

```bash
cd pi-server
docker compose up -d
```

Requires a `.env` file with:
```
CLIENT_ID=
SOURCE_COLLECTION=
DEST_COLLECTION=
PI_ID=
PHOTO_DIR=/app/pics/
GLOBUS_SRC_PATH=/home/tomato-imager/TomatoImager/pics/
```

### Controller

```bash
cd controller
docker compose up -d
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Pi Server Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/capture-status` | Returns capture thread status and timestamps |
| POST | `/start-capture` | Starts image capture in background thread |
| POST | `/stop-capture` | Sets stop flag to halt capture |
| POST | `/globus-transfer` | Submits recursive Globus transfer |
| GET | `/transfer-status` | Returns live Globus task status |
| DELETE | `/delete-photos` | Deletes all photos from pics directory |

---

## Roadmap

- [ ] Automated testing (pytest + mocking for hardware)
- [ ] GPS status on frontend
- [ ] Per-camera health status
- [ ] mDNS auto-discovery of Pis on network
- [ ] Dockerize frontend with nginx
- [ ] YOLOv8-track pipeline for plant detection and counting
- [ ] Disease detection (stretch goal)

---

## Author

Connery Tran — NC State University  
N.C. Plant Sciences Initiative  
chtran3@ncsu.edu