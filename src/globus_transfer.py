
import globus_sdk
from globus_sdk.globus_app import UserApp
import os

CLIENT_ID = os.getenv('CLIENT_ID')
COLLECTION_ID = os.getenv('COLLECTION_ID')
SRC_PATH = os.getenv('PICS_PATH')
DEST_PATH = os.getenv('DEST_PATH')



def main ():
    with UserApp('Pi-Globus-Transfer', 
                 client_id=CLIENT_ID) as app:
        with globus_sdk.TransferClient(app=app) as client:
            submit_transfer(client)


def submit_transfer(transfer_client: globus_sdk.TransferClient):
    transfer_client.add_app_data_access_scope()
    transfer_client.add_app_data_access_scope()

    transfer_request = globus_sdk.TransferData(CLIENT_ID,
                                               COLLECTION_ID)
    transfer_request.add_item(SRC_PATH, DEST_PATH)

    task = transfer_client.submit_transfer(transfer_request)

if __name__ == '__main__':
    main()
    