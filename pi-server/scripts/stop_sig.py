
import os
from dotenv import load_dotenv

load_dotenv()

stop_path = os.getenv('stop_path')

try:
  with open(stop_path, 'w') as f:
    # You can write some content, or leave it empty.
    pass
  print(f"File '{stop_path}' created successfully.")

except OSError as e:
  print(f"Error creating file: {e}")






