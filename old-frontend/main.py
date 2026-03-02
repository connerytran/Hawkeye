
import sys
import requests
from PyQt5.QtWidgets import (QApplication, QMainWindow, QLabel, 
                             QWidget, QVBoxLayout, QPushButton, QMessageBox, QInputDialog)
from PyQt5.QtGui import QIcon, QFont
import os
from dotenv import load_dotenv

load_dotenv()

pi_port = os.getenv('pi_port')
num_of_pis = int(os.getenv('num_of_pis'))
pi_hosts = []
online_pis = []
invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*', ' ', '.']


# adds in all ip addresses of pis
for i in range(num_of_pis):
  host = os.getenv(f'pi_host_{i}')
  if host:
    pi_hosts.append(host)
  else: 
    print("No good")





class MainWindow(QMainWindow):
  def __init__(self):
    super().__init__()
    self.setWindowTitle("HAWKEYE GUI")
    self.setGeometry(700, 300, 500, 500)
    self.pi_status_labels = {}
    self.initUI()


  def initUI(self):
    central_widget = QWidget()
    self.setCentralWidget(central_widget)
    layout = QVBoxLayout()
    central_widget.setLayout(layout)

   
    # For each pi, creates a label, and checks the status
    for pi in pi_hosts:
      pi_status = QLabel(f"Pi {pi}: UNAVAILABLE")
      self.pi_status_labels[pi] = pi_status
      layout.addWidget(pi_status)


    self.status_button = QPushButton("Check status")
    self.status_button.clicked.connect(self.check_status)
    layout.addWidget(self.status_button)

    self.pic_button = QPushButton("Take pictures")
    self.pic_button.clicked.connect(self.hawkeye_capture_req)
    self.pic_button.setEnabled(False)
    layout.addWidget(self.pic_button)

    self.stop_button = QPushButton("Stop pictures")
    self.stop_button.clicked.connect(self.hawkeye_stop_req)
    self.stop_button.setEnabled(False)
    layout.addWidget(self.stop_button)

    self.globus_button = QPushButton("Transfer pictures")
    self.globus_button.clicked.connect(self.globus_transfer)
    self.globus_button.setEnabled(False)
    layout.addWidget(self.globus_button)



    self.output_label = QLabel("Check status before beginning.")
    layout.addWidget(self.output_label)






  def hawkeye_capture_req(self):
    """Sends a POST request to the Raspberry Pi to start taking pictures."""

    for pi in online_pis:
      url = f"http://{pi}:{pi_port}/take_pictures"
      
      self.output_label.setText("Sending request to Pi...")
      self.pic_button.setEnabled(False) # Disable the button during the request

      try:
        # The requests.post() function sends an HTTP POST request
        response = requests.post(url, timeout=10) # Set a 10-second timeout
        
        # Check for a successful HTTP status code (200-299)
        if response.status_code == 200:
          result = response.json()
          self.output_label.setText(f"SUCCESS: {result.get('message')}")
        else:
          # Handle non-200 status codes (e.g., 500 server error)
          result = response.json()
          error_message = result.get('message', 'Unknown error occurred.')
          self.output_label.setText(f"ERROR: {error_message}")
          QMessageBox.warning(self, "API Error", f"The server returned an error: {error_message}")

      except requests.exceptions.RequestException as e:
        # Handle network errors (Pi is off, wrong IP, etc.)
        self.output_label.setText(f"ERROR: Could not connect to the Pi.")
        QMessageBox.critical(self, "Network Error", f"Failed to connect to the Raspberry Pi: {e}")

      finally:
        self.pic_button.setEnabled(True) # Re-enable the button






  def hawkeye_stop_req(self):
    """Sends a POST request to the Raspberry Pi to stop taking pictures."""

    for pi in online_pis:
      url = f"http://{pi}:{pi_port}/stop_pictures"
      
      self.output_label.setText("Sending request to Pi...")
      self.stop_button.setEnabled(False) # Disable the button during the request

      try:
        # The requests.post() function sends an HTTP POST request
        response = requests.post(url, timeout=10) # Set a 10-second timeout
        
        # Check for a successful HTTP status code (200-299)
        if response.status_code == 200:
          result = response.json()
          self.output_label.setText(f"SUCCESS: {result.get('message')}")
        else:
          # Handle non-200 status codes (e.g., 500 server error)
          result = response.json()
          error_message = result.get('message', 'Unknown error occurred.')
          self.output_label.setText(f"ERROR: {error_message}")
          QMessageBox.warning(self, "API Error", f"The server returned an error: {error_message}")

      except requests.exceptions.RequestException as e:
        # Handle network errors (Pi is off, wrong IP, etc.)
        self.output_label.setText(f"ERROR: Could not connect to the Pi.")
        QMessageBox.critical(self, "Network Error", f"Failed to connect to the Raspberry Pi: {e}")

      finally:
        self.stop_button.setEnabled(True) # Re-enable the button





  def check_status(self):
    """Sends a GET request to pi to see if is available"""

    flag = False # flag for if any pis are available
    for pi in pi_hosts:

      self.output_label.setText("Checking status...")
      url = f"http://{pi}:{pi_port}/status"
      
      try:
        response = requests.get(url, timeout=2)

        if response.status_code == 200:
          result = response.json()
          self.pi_status_labels[pi].setText(f"Pi {pi}: AVAILABLE")
          online_pis.append(pi)
          flag = True
        else:
          # Handle non-200 status codes (e.g., 500 server error)
          if pi in online_pis:
            online_pis.remove(pi)
          self.pi_status_labels[pi].setText(f"Pi {pi}: UNAVAILABLE")

          result = response.json()
          error_message = result.get('message', 'Unknown error occurred.')
          self.output_label.setText(f"ERROR: {error_message}")
          QMessageBox.warning(self, "API Error", f"The server returned an error: {error_message}")

      except requests.exceptions.RequestException as e:
        # Handle network errors (Pi is off, wrong IP, etc.)

        if pi in online_pis:
          online_pis.remove(pi)
        self.pi_status_labels[pi].setText(f"Pi {pi}: UNAVAILABLE")

        self.output_label.setText(f"ERROR: Could not connect to the Pi.")
        QMessageBox.critical(self, "Network Error", f"Failed to connect to the Raspberry Pi: {e}")

    self.output_label.setText(f"Status check complete.")
    # if any pis are available, then the buttons are enabled
    if flag:
      self.stop_button.setEnabled(True) # enable the button 
      self.pic_button.setEnabled(True) 
      self.globus_button.setEnabled(True) 
    else:
      self.stop_button.setEnabled(False) # disable the button 
      self.pic_button.setEnabled(False) 
      self.globus_button.setEnabled(False) 






  def globus_transfer(self):
    """Sends a POST request to the Raspberry Pi to stop taking pictures."""

    # Gets the VALID foldername from the user
    while True:
      foldername, ok = QInputDialog.getText(self, 'Input Dialog', 'Foldername CANNOT include: <, >, :, ., \", /, \\, |, ?, *, or spaces.' \
        '\nPlease enter a valid foldername:')
      
      if any(char in foldername for char in invalid_chars):
        QMessageBox.warning(self, "ERROR", "Invalid chars detected.")
        continue

      if ok and foldername:
        # The user clicked OK and entered some text
        self.output_label.setText(f"You entered: {foldername}")
        print(f"User input: {foldername}")
        break
      else:
        # The user clicked Cancel or entered nothing
        self.output_label.setText("No folder name was entered.")
        print("User cancelled or entered nothing.")
        return

    # Payload data with the post request
    payload = {
      'foldername': foldername
    }


    for pi in online_pis:
      url = f"http://{pi}:{pi_port}/globus_transfer"
      
      self.output_label.setText("Sending request to Pi...")
      self.stop_button.setEnabled(False) # Disable the button during the request

      try:
        # The requests.post() function sends an HTTP POST request
        response = requests.post(url, json=payload, timeout=60) # Set a 10-second timeout
        
        # Check for a successful HTTP status code (200-299)
        if response.status_code == 200:
          result = response.json()
          self.output_label.setText(f"SUCCESS: {result.get('message')}")
        else:
          # Handle non-200 status codes (e.g., 500 server error)
          result = response.json()
          error_message = result.get('message', 'Unknown error occurred.')
          self.output_label.setText(f"ERROR: {error_message}")
          QMessageBox.warning(self, "API Error", f"The server returned an error: {error_message}")

      except requests.exceptions.RequestException as e:
        # Handle network errors (Pi is off, wrong IP, etc.)
        self.output_label.setText(f"ERROR: Could not connect to the Pi.")
        QMessageBox.critical(self, "Network Error", f"Failed to connect to the Raspberry Pi: {e}")

      finally:
        self.stop_button.setEnabled(True) # Re-enable the button





def main():
  app = QApplication(sys.argv)
  window = MainWindow()
  window.show()
  sys.exit(app.exec_())




if __name__ == "__main__":
  main()