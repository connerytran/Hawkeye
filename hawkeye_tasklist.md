# Hawkeye — Next Steps Checklist 3/11

## 🔐 Immediate Blockers
- [x] Run `globus login` and complete browser authentication
- [x] Manually test `python3 globus_transfer.py test` and confirm files land at NC State

## 🔧 Refactor Pi Server
- [x] Install Globus Python SDK — `pip install globus-sdk --break-system-packages`
- [x] Design `PiCamera` class — write out attributes and method signatures before any logic
- [x] Migrate capture logic into the class
- [x] Migrate Globus transfer into the class using the SDK (replace subprocess CLI calls)
- [x] Update FastAPI endpoints to use the `PiCamera` instance
- [ ] Update usb_cam.py to make it importable. That way we can properly know if start_capture works.
- [ ] Test each endpoint manually

## ⚙️ Reliability
- [ ] Create a systemd service file for the FastAPI Pi server so it starts on boot

## 🖥️ Laptop Backend + Frontend
- [ ] Wire up the laptop backend to the working Pi endpoints
- [ ] Connect the Hawkeye frontend to the laptop backend
