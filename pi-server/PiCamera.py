import globus_sdk
from globus_sdk import TransferClient
from globus_sdk.globus_app import UserApp
import os
from dotenv import load_dotenv
from datetime import datetime
from threading import Event, Thread
import cam_capture

load_dotenv(dotenv_path="/home/tomato-imager/TomatoImager/.env")

SRC_PATH = "/home/tomato-imager/TomatoImager/pics/"
DEST_PATH ="/rs1/shares/cals-research-station/clinton/hawkeye/"
CLIENT_ID = os.getenv('CLIENT_ID')
SOURCE_COLLECTION = os.getenv('SOURCE_COLLECTION')
DEST_COLLECTION = os.getenv('DEST_COLLECTION')
PI_ID = os.getenv('PI_ID')



class PiCamera:

    def __init__(self):
        self.is_capturing: bool = False
        self.capture_start_time: datetime = None
        self.capture_end_time: datetime = None
        self.task_id: str = None
        self.stop_flag = Event()

        app = UserApp('Pi-Globus-Transfer', client_id=CLIENT_ID)
        self.transfer_client = TransferClient(app=app)
        self.transfer_client.add_app_data_access_scope(DEST_COLLECTION)



    def start_capture(self):

        if self.is_capturing:
            return {"error": "Capture already in progress"}
        try:
            self.stop_flag.clear()  # Ensure stop flag is clear before starting
            thread = Thread(target=cam_capture.main, args=(self.stop_flag,))
            thread.start()
            self.is_capturing = True
            self.capture_start_time = datetime.now()
            self.capture_end_time = None
            return {"message": "Taking pictures now."}
        except Exception as e:
            self.is_capturing = False
            self.capture_start_time = None
            self.capture_end_time = None
            return {"error": f"Failed to start capture: {str(e)}"}



    def stop_capture(self):

        if not self.is_capturing:
            return {"error": "Capture already stopped"}
        try:
            self.stop_flag.set()
            self.is_capturing = False
            self.capture_end_time = datetime.now()
            return {"message": "Capture stopped."}
        except Exception as e:
            return {"error": f"Failed to stop capture: {str(e)}"}
        

    def get_capture_status(self):
        return {
            "is_capturing": self.is_capturing,
            "capture_start_time": self.capture_start_time,
            "capture_end_time": self.capture_end_time
        }
    


    def globus_transfer(self, foldername: str):

        # Check if a transfer is already in progress
        if self.task_id:

            try:
                task_status = self.transfer_client.get_task(self.task_id).data['status']
                if task_status == 'ACTIVE':   # Check if transfer is still active
                    return {"error": "Transfer already in progress"}
            except Exception as e:
                return {"error": f"Failed transfer status precheck: {str(e)}"}

        transfer_request = globus_sdk.TransferData(source_endpoint=SOURCE_COLLECTION, 
                                                    destination_endpoint=DEST_COLLECTION) # Create transfer request
        dest_path = os.path.join(DEST_PATH, foldername, PI_ID) # Append foldername and pi id to destination path
        transfer_request.add_item(SRC_PATH, dest_path, recursive=True) # Add transfer item with recursive flag for directories

        try:
            task = self.transfer_client.submit_transfer(transfer_request) # Submit transfer request
            self.task_id = task['task_id'] # Updates task ID for tracking
            return {"message": f"Transfer submitted with task ID: {self.task_id}"}       
        except Exception as e:  
            self.task_id = None  # Reset task ID on failure
            return {"error": f"Failed to submit transfer: {str(e)}"}
        
    
    def get_transfer_status(self):
        if not self.task_id:
            return {"error": "No transfer initiated"}

        try:
            status = self.transfer_client.get_task(self.task_id)
            return dict(status.data)
        except Exception as e:
            return {"error": f"Failed to get transfer status: {str(e)}"}