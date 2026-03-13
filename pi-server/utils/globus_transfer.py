
import globus_sdk
from globus_sdk.globus_app import UserApp
import os
from dotenv import load_dotenv

load_dotenv()

SOURCE_COLLECTION = os.getenv('SOURCE_COLLECTION')
CLIENT_ID = os.getenv('CLIENT_ID')
DEST_COLLECTION = os.getenv('DEST_COLLECTION')
SRC_PATH = os.getenv('PICS_PATH')
DEST_PATH = os.getenv('DEST_PATH')



def main ():
    app = UserApp('Pi-Globus-Transfer', client_id=CLIENT_ID)
    transfer_client = globus_sdk.TransferClient(app=app)
    submit_transfer(transfer_client)


def submit_transfer(transfer_client: globus_sdk.TransferClient):

    # transfer_client.add_app_data_access_scope(SOURCE_COLLECTION)
    transfer_client.add_app_data_access_scope(DEST_COLLECTION)

    transfer_request = globus_sdk.TransferData(source_endpoint=SOURCE_COLLECTION, destination_endpoint=DEST_COLLECTION)
    transfer_request.add_item(SRC_PATH, DEST_PATH)

    task = transfer_client.submit_transfer(transfer_request)

    print(task.data.get('message'))
    print(f'{dict(task.data)}\n\n\n')
    

    task_id = task['task_id']
    status = transfer_client.get_task(task_id)
    print(dict(status.data))


if __name__ == '__main__':
    main()
    