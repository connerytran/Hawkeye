from threading import Event
import cv2
import time
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

PHOTO_DIR = "/home/tomato-imager/TomatoImager/pics/"
num_of_cams = 3
timestamp = datetime.now().strftime("%m-%d-%Y_%H-%M-%S")

# CAM CTRLS =========
width = 1920
height = 1080
exposure = 1
gain = 0
brightness = 0
contrast = 32
pic_num = 0
# ===================


def intialize_cam(cam_idx):
    """
    Initializes the camera given the index, creates and returns a cap object

    Params:
    cam_idx (int): idx for accessing each of the cameras
    """

    cap = cv2.VideoCapture(cam_idx)
    if not cap.isOpened():
        print('Cannot open camera')
        return None

    set_cam_ctrls(cap, width, height, exposure, gain, brightness, contrast)

    return cap



def take_picture(cap, cam_idx, photo_dir):
    """
    Given the camera, it will take a picture and save it to a folder

    Params:
    cap (cv2 VideoCapture): capture object for taking pictures
    """
    global pic_num
    save_path = photo_dir

    # creates the directories if not exist
    save_path += f"cam{cam_idx}/"
    if save_path:
        os.makedirs(save_path, exist_ok=True)

    print(f"Camera {cam_idx} taking pic")
    start_time = time.perf_counter()
    ret, frame = cap.read()
    if not ret:
        print("Cannot recieve frame.")
    else:
        end_time = time.perf_counter()
        duration = end_time - start_time
        print(f"Camera {cam_idx} pic taken in {duration} seconds")

        start_time = time.perf_counter()
        cv2.imwrite(f'{save_path}{timestamp}_cam{cam_idx}_{str(pic_num)}.jpg', frame) # pics/cam1/timestamp_cam1_
        end_time = time.perf_counter()
        duration = end_time - start_time
        pic_num += 1
        print(f"Camera {cam_idx} pic saved in {duration} seconds")





def set_cam_ctrls(cap, width, height, exposure, gain, brightness, contrast):
    """
    Given the params and capture obj, will set the desired controls for the cap

    Params:
    cap (cv2 VideoCapture):
    width
    height
    exposure
    gain
    brihgtness
    contrast
    """

    # cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

    cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 3) # 3 is on, 1 is manual
    cap.set(cv2.CAP_PROP_EXPOSURE, exposure)

    # cap.set(cv2.CAP_PROP_GAIN, gain)

    # cap.set(cv2.CAP_PROP_BRIGHTNESS, brightness)
    # cap.set(cv2.CAP_PROP_CONTRAST, contrast)

    # v4l2-ctl --list-devices
    # v4l2-ctl -d /dev/video2 --list-ctrls
    # -menus
    # v4l2-ctl -d /dev/video2 -c exposure_dynamic_framerate=0



def main(stop_flag: Event):

    caps_array = []
    try:
        
        if stop_flag.is_set():
            print("Stop flag set, exiting capture loop.")
            return

        # Initializes all cams
        for cam_idx in range(0, num_of_cams * 2, 2):
            cap = intialize_cam(cam_idx)
            if cap is not None:
                caps_array.append(cap)
            else:
                print(f'Unable to initialize cam {cam_idx}')


        while True:
            
            for cam_idx, cap in enumerate(caps_array):
                take_picture(cap, cam_idx, PHOTO_DIR)
            
            if stop_flag.is_set():
                print("Stop flag set, exiting capture loop.")
                break

    
    except KeyboardInterrupt:
        for cap in caps_array:
            cap.release()

    finally:
        for cap in caps_array:
            cap.release()


