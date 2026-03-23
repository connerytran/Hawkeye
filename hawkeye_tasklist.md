# Hawkeye — Next Steps Checklist

## ✅ Completed
- [x] Run `globus login` and complete browser authentication
- [x] Manually test Globus transfer and confirm files land at NC State
- [x] Install Globus Python SDK
- [x] Design and build `PiCamera` class
- [x] Migrate capture logic into the class (threading)
- [x] Migrate Globus transfer into the class using the SDK
- [x] Update FastAPI endpoints to use the `PiCamera` instance
- [x] Test each endpoint manually
- [x] Integrate NMEA/GPS reading into PiCamera
- [x] Embed GPS coordinates into image EXIF via piexif
- [x] Wire up laptop backend to Pi endpoints
- [x] Connect TomatoScan frontend to laptop backend

## 🚀 Sprint 1 — Containerization and CI/CD
- [x] Install Docker on laptop
- [x] Install Docker on Pi
- [x] Write Dockerfile for Pi server
- [x] Write Dockerfile for laptop backend
- [x] Test both containers run locally
- [x] Push images to Docker Hub manually
- [x] Set up branching strategy (feature → dev → main)
- [x] Set up GitHub Actions workflow — run tests on every push
- [x] Set up GitHub Actions to build and push Docker images to Docker Hub on merge to main (dev right now)
- [x] Add Docker Hub credentials to GitHub secrets
- [ ] Install and configure Watchtower on Pi
- [ ] Test full automated update cycle end to end

## 🧪 Sprint 2 — Automated Testing
- [ ] Write unit tests for `PiCamera` methods using mocking
- [ ] Write API endpoint tests for Pi server
- [ ] Write API endpoint tests for laptop backend
- [ ] Wire tests into GitHub Actions to block failed deployments

## 🛠️ Sprint 2.5 — System Polish
- [ ] Add GPS status to Pi card on frontend
- [ ] Add cancel Globus transfer endpoint and UI
- [ ] Add per-camera status to Pi server and frontend
- [ ] Implement mDNS auto-discovery for Pis
- [ ] Create systemd service for Pi server (post-Docker stabilization)

## 🌱 Sprint 3 — YOLO Pipeline
- [ ] Add video capture mode to `cam_capture.py`
- [ ] Label field images using Roboflow
- [ ] Train YOLOv8 model on labeled data
- [ ] Run inference and count plants