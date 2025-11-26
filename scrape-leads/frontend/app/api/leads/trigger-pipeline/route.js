// app/api/leads/trigger-pipeline/route.js
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST() {
  const PYTHON_SCRIPT = join(process.cwd(), 'scrape-leads', 'run_lead_pipeline.py');
  
  if (!fs.existsSync(PYTHON_SCRIPT)) {
    return NextResponse.json({ error: 'Pipeline script not found' }, { status: 404 });
  }

  try {
    console.log('[Pipeline] Starting lead pipeline...');
    const { stdout } = await execAsync(`python3 "${PYTHON_SCRIPT}"`, {
      timeout: 600000,
      cwd: process.cwd(),
    });

    return NextResponse.json({
      success: true,
      message: 'Pipeline completed successfully',
    });
  } catch (error) {
    console.error('[Pipeline] Failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Pipeline failed',
      },
      { status: 500 }
    );
  }
}