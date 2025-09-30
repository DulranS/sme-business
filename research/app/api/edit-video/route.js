import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { filePath } = req.body;

  try {
    const inputPath = filePath;
    const outputFileName = `edited_${path.basename(filePath)}`;
    const outputPath = path.join(process.cwd(), 'public', 'edited', outputFileName);

    // Example FFmpeg command to add a watermark
    const command = `ffmpeg -i ${inputPath} -vf "drawtext=text='Edited':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/2" -codec:a copy ${outputPath}`;

    await execPromise(command);

    res.status(200).json({ editedFilePath: `/edited/${outputFileName}` });
  } catch (error) {
    console.error('Error editing video:', error);
    res.status(500).json({ message: 'Failed to edit video' });
  }
}