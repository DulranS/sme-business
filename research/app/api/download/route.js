import axios from 'axios';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { url } = req.body;

  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const fileName = `video_${Date.now()}.mp4`;
    const filePath = path.join(process.cwd(), 'public', 'downloads', fileName);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    res.status(200).json({ filePath });
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ message: 'Failed to download video' });
  }
}