
from serial import Serial
from pynmeagps import NMEAReader



def main(current_location: dict = None):

    stream = Serial('/dev/ttyAMA0', 9600, timeout=3)
    reader = NMEAReader(stream)

    while 1:
        try:
            raw_data, parsed_data = reader.read()
            if parsed_data is not None and parsed_data.msgID == 'RMC':
                current_location['lon'] = parsed_data.lon
                current_location['lat'] = parsed_data.lat
        except Exception as e:
            print(f"GPS read error: {e}")


if __name__ == '__main__':
    main()