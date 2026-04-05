

import sys
from unittest.mock import patch, MagicMock

# Mock all Pi-specific modules before importing PiCamera
sys.modules['globus_sdk'] = MagicMock()
sys.modules['globus_sdk.globus_app'] = MagicMock()
sys.modules['cam_capture'] = MagicMock()
sys.modules['cv2'] = MagicMock()
sys.modules['piexif'] = MagicMock()
sys.modules['serial'] = MagicMock()
sys.modules['pynmeagps'] = MagicMock()
sys.modules['utils.gps_reader'] = MagicMock()

from PiCamera import PiCamera
class TestPiCamera:
    
    def setup_method(self):
        self.camera = self.test_picamera_initializes()

    def test_picamera_initializes(self):
        with patch('PiCamera.UserApp') as mock_app:
            with patch('PiCamera.TransferClient') as mock_client:
                with patch('PiCamera.Thread') as mock_thread:
                    camera = PiCamera()
                    assert camera is not None

    # def test_start_capture(self):
    #     with patch('PiCamera.Thread') as mock_thread:
    #         mock_thread_instance = MagicMock()
    #         mock_thread.return_value = mock_thread_instance
    #         response = self.camera.start_capture()
    #         assert "message" in response
    #         assert response["message"] == "Taking pictures now."
    #         mock_thread.assert_called_once()
