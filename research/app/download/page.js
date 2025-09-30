"use client";

import { useState, useEffect } from "react";
import Head from "next/head";
import ReactPlayer from "react-player";
import VideoEditor from "../Components/VideoEditor";
import Link from "next/link";
import Cookies from 'js-cookie';

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [vidNumber, setVidNumber] = useState(1);
  const [editedVideos, setEditedVideos] = useState([]);

  useEffect(() => {
    // Load videos from cookies when the component mounts
    const savedVideos = Cookies.get('savedVideos');
    if (savedVideos) {
      setVideos(JSON.parse(savedVideos));
    }
  }, []);

  const saveVideosToCookies = (videos) => {
    Cookies.set('savedVideos', JSON.stringify(videos), { expires: 7 }); // Expires in 7 days
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/tiktok-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, novids: vidNumber }),
      });
      const data = await response.json();
      if (data.videos && data.videos.length > 0) {
        setVideos(data.videos);
        saveVideosToCookies(data.videos);
      } else {
        setVideos([]);
        setMessage(data.message || "No videos found. Please try a different prompt.");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Failed to get videos. Please try again.");
    }
    setLoading(false);
  };

  const handleDownload = (url) => {
    try {
      // Open the video URL in a new tab
      window.open(url, '_blank');
    } catch (error) {
      console.error("Error opening video in new tab:", error);
      setMessage("Failed to open video in new tab. Please try again.");
    }
  };

  const handleDownloadAndEdit = async (url) => {
    try {
      setLoading(true);
      // Download the video
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const { filePath } = await response.json();

      // Edit the video
      const editedResponse = await fetch('/api/edit-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const { editedFilePath } = await editedResponse.json();

      // Add the edited video to the state
      setEditedVideos(prev => [...prev, editedFilePath]);
    } catch (error) {
      console.error("Error processing video:", error);
      setMessage("Failed to process video. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>AI-Powered TikTok Video Downloader</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <br/>
      <Link href={"/"} style={{paddingTop:"60px"}}>Back to homepage</Link>
      <br/><br/>
      <Link href={"/voice"}>Ai voice generation</Link>
      <main>
        <h1 className="text-2xl font-bold text-center my-4">
          TikTok Video Downloader
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col items-center mb-8">
          <input
            type="text"
            value={prompt}
            style={{ color: "black" }}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt to find TikTok videos"
            className="border p-2 mb-4 w-full max-w-lg rounded"
            required
          />
          <div className="mb-4 w-full max-w-lg">
            <label className="block mb-1">Select number of videos (1-10)</label>
            <select
              value={vidNumber}
              onChange={(e) => setVidNumber(Number(e.target.value))}
              className="border p-2 w-full rounded"
              style={{ color: "black" }}
              required
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Searching..." : "Search and Download"}
          </button>
        </form>

        {message && <p className="text-center mt-4 text-red-500">{message}</p>}

        <div className="video-list mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.length > 0 ? (
            videos.map((video, index) => (
              <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="relative">
                  <ReactPlayer
                    url={video.play}
                    controls={true}
                    width="100%"
                    height="auto"
                  />
                  <div className="absolute inset-0 bg-black opacity-50 flex items-center justify-center">
                    <button
                      onClick={() => handleDownload(video.play)}
                      className="bg-blue-500 text-white py-2 px-4 rounded cursor-pointer"
                    >
                      Download Video
                    </button>
                  </div>
                </div>
                {/* <div className="p-4">
                  <h2 className="text-xl font-semibold mb-2" style={{color:"black"}}>Video {index + 1}</h2>
                  <button
                    onClick={() => handleDownloadAndEdit(video.play)}
                    className="bg-green-500 text-white py-2 px-4 rounded cursor-pointer mr-2"
                    disabled={loading}
                  >
                    Download & Edit
                  </button>
                </div> */}
              </div>
            ))
          ) : (
            <h1 className="text-center text-xl">No results found</h1>
          )}
        </div>
        {editedVideos.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Edited Videos</h2>
            <VideoEditor videos={editedVideos} />
          </div>
        )}
      </main>
    </div>
  );
}