import React, { useState } from 'react';
import axios from 'axios';

export default function VideoConverter({ url, onConvert }) {
  const [converting, setConverting] = useState(false);

  const convertVideo = async () => {
    setConverting(true);
    try {
      const response = await axios.get(`https://api.snaptik.com/video-data?url=${encodeURIComponent(url)}`);
      const mp4Url = response.data.mp4;
      onConvert(mp4Url);
    } catch (error) {
      console.error('Error converting video:', error);
    }
    setConverting(false);
  };

  return (
    <button onClick={convertVideo} disabled={converting}>
      {converting ? 'Converting...' : 'Convert'}
    </button>
  );
}