import { useState } from 'react';

function App() {
  return (
    <div>
      <h1>TomatoImager Dashboard</h1>
      <PiCard piName="Pi 1" piIp="192.168.1.10" />
    </div>
  );
}





function PiCard({ piName, piIp }) {
  const [status, setStatus] = useState('idle');
  const [imageCount, setImageCount] = useState(0);
  const [isSelected, setIsSelected] = useState(false); // useState triggers a re-render, inside () is what it initializes as



    const handleGetStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/status', {
        method: 'GET'
      });
      
      const data = await response.json();
      console.log(data)
      setStatus(data.results['localhost'].message || JSON.stringify(data.results['localhost']));    } catch (error) {
      console.error('Error:', error);
    }
  };



  return (
    <div style={{ border: '1px solid black', padding: '10px', margin: '10px' }}>
      <h2>{piName}</h2>
      <p>IP: {piIp}</p>
      <p>Status: {status}</p>
      <p>Images: {imageCount}</p>
      
      <input 
        type="checkbox"
        checked={isSelected}
        onChange={() => setIsSelected(!isSelected)}
      /> Select
      
      <button onClick={() => setStatus('capturing')}>
        Simulate Capture
      </button>

      <button onClick={() => setImageCount(imageCount + 1)}>
        Add Image Count
      </button>

      <button onClick={handleGetStatus}>
        Get Status
      </button>

    </div>
  );
}

export default App;