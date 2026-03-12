
import globus_sdk
from globus_sdk.globus_app import UserApp
import os
from dotenv import load_dotenv
from datetime import datetime



class PiCamera:

    def __init__(self):
        self.is_capturing: bool = False
        self.capture_start_time: datetime = None
        self.capture_end_time: datetime = None
        self.task_id: str = None
        self.transfer_client: TransferClient = None

    def start_capture(self, path):
        print(f"Capturing image and saving to {path}")

