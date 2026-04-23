import globus_sdk
from globus_sdk import TransferClient
from globus_sdk.globus_app import UserApp
import os
from dotenv import load_dotenv
from datetime import datetime
from threading import Event, Thread
import cam_capture
from utils import gps_reader
import shutil

load_dotenv(dotenv_path="/home/tomato-imager/TomatoImager/.env")

PHOTO_DIR = os.getenv('PHOTO_DIR', '/home/tomato-imager/TomatoImager/pics/')
GLOBUS_SRC_PATH = os.getenv("GLOBUS_SRC_PATH","/home/tomato-imager/TomatoImager/pics/")
DEST_PATH ="/rs1/shares/cals-research-station/clinton/hawkeye/"
CLIENT_ID = os.getenv('CLIENT_ID')
SOURCE_COLLECTION = os.getenv('SOURCE_COLLECTION')
DEST_COLLECTION = os.getenv('DEST_COLLECTION')
PI_ID = os.getenv('PI_ID')



class PiCamera:

    def __init__(self):
        self.capture_thread: Thread = None
        self.capture_start_time: datetime = None
        self.capture_end_time: datetime = None
        self.task_id: str = None
        self.stop_flag = Event()

        app = UserApp('Pi-Globus-Transfer', client_id=CLIENT_ID)
        self.transfer_client = TransferClient(app=app)
        self.transfer_client.add_app_data_access_scope(DEST_COLLECTION)

        ## Runs the thread that updates current_location
        self.current_location = {'lon': None, 'lat': None}                
        gps_thread = Thread(target=gps_reader.main, args=(self.current_location,), daemon=True)
        gps_thread.start()


    def start_capture(self):

        if self.capture_thread is not None and self.capture_thread.is_alive():
            return {"error": "Capture already in progress"}
        try:
            self.stop_flag.clear()  # Ensure stop flag is clear before starting
            self.capture_thread = Thread(target=cam_capture.main, args=(self.stop_flag, self.current_location))
            self.capture_thread.start()
            self.capture_start_time = datetime.now()
            self.capture_end_time = None
            return {"message": "Taking pictures now."}
        except Exception as e:
            self.capture_thread = None
            self.capture_start_time = None
            self.capture_end_time = None
            return {"error": f"Failed to start capture: {str(e)}"}



    def stop_capture(self):

        if self.capture_thread is None or not self.capture_thread.is_alive():
            return {"error": "Capture already stopped"}
        try:
            self.stop_flag.set()
            self.capture_end_time = datetime.now()
            return {"message": "Capture stopped."}
        except Exception as e:
            return {"error": f"Failed to stop capture: {str(e)}"}
        

    def delete_photos(self):
        for folder in os.listdir(PHOTO_DIR):
            folder_path = os.path.join(PHOTO_DIR, folder)
            if os.path.isdir(folder_path):
                shutil.rmtree(folder_path)
        return {"message": "Photos deleted."}

    def get_capture_status(self):
        capture_status = ""
        if self.capture_thread is None: 
            capture_status = "Capture never started"
        elif self.capture_thread.is_alive():
            capture_status = "Capturing"
        else:
            capture_status = "Not capturing"
        return {
            "capture_status": capture_status,
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
        transfer_request.add_item(GLOBUS_SRC_PATH, dest_path, recursive=True) # Add transfer item with recursive flag for directories

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
            data = status.data
            return {
                'status': data['status'],
                'nice_status': data['nice_status'],
                'task_id': data['task_id'],
                'files': data['files'],
                'files_transferred': data['files_transferred'],
                'bytes_transferred': data['bytes_transferred'],
                'subtasks_succeeded': data['subtasks_succeeded'],
                'subtasks_total': data['subtasks_total'],
                'faults': data['faults'],
                'fatal_error': data['fatal_error'],
                'completion_time': data['completion_time'],
                'request_time': data['request_time'],
                'effective_bytes_per_second': data['effective_bytes_per_second'],
            }
        except Exception as e:
            return {"error": f"Failed to get transfer status: {str(e)}"}