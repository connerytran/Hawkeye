# TomatoImager — Next Steps Checklist

## 🔐 Immediate Blockers
- [x] Run `globus login` and complete browser authentication
- [x] Manually test `python3 globus_transfer.py test` and confirm files land at NC State

## 🔧 Refactor Pi Server
- [x] Install Globus Python SDK — `pip install globus-sdk --break-system-packages`
- [x] Design `PiCamera` class — write out attributes and method signatures before any logic
- [x] Migrate capture logic into the class
- [x] Migrate Globus transfer into the class using the SDK (replace subprocess CLI calls)
- [x] Update FastAPI endpoints to use the `PiCamera` instance
- [ ] Test each endpoint manually

## 📍 GPS + Image Metadata
- [ ] Integrate NMEA reading into PiCamera so location data is captured during each session
- [ ] Embed GPS coordinates into image metadata via piexif + sidecar JSON

## 🗑️ Photo Management
- [ ] Add `delete_photos()` method to PiCamera to clear pics before a new capture run

## 🖥️ Laptop Backend + Frontend
- [ ] Wire up the laptop backend to the working Pi endpoints
- [ ] Connect the TomatoScan frontend to the laptop backend

## ⚙️ Reliability
- [ ] Create a systemd service file for the FastAPI Pi server so it starts on boot
