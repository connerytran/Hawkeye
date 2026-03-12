# TomatoImager — Next Steps Checklist

## 🔐 Immediate Blockers
- [x] Run `globus login` and complete browser authentication
- [x] Manually test `python3 globus_transfer.py test` and confirm files land at NC State

## 🔧 Refactor Pi Server
- [ ] Install Globus Python SDK — `pip install globus-sdk --break-system-packages`
- [ ] Design `PiCamera` class — write out attributes and method signatures before any logic
- [ ] Migrate capture logic into the class
- [ ] Migrate Globus transfer into the class using the SDK (replace subprocess CLI calls)
- [ ] Update FastAPI endpoints to use the `PiCamera` instance
- [ ] Test each endpoint manually

## ⚙️ Reliability
- [ ] Create a systemd service file for the FastAPI Pi server so it starts on boot

## 🖥️ Laptop Backend + Frontend
- [ ] Wire up the laptop backend to the working Pi endpoints
- [ ] Connect the TomatoScan frontend to the laptop backend
